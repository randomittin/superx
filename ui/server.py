#!/usr/bin/env python3
"""superx pixel art dashboard — local web server with SSE and process management."""

import json
import os
import queue
import subprocess
import sys
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

PORT = int(os.environ.get("SUPERX_PORT", 8080))
STATIC_DIR = Path(__file__).parent / "static"
STATE_FILE = Path(os.environ.get("SUPERX_STATE_FILE", "superx-state.json"))
PLUGIN_DIR = Path(__file__).parent.parent

# Shared state
event_queues: list[queue.Queue] = []
claude_process: subprocess.Popen | None = None
terminal_lines: list[str] = []
terminal_lock = threading.Lock()
MAX_TERMINAL_LINES = 500


def watch_state_file():
    """Poll superx-state.json and push changes to all SSE clients."""
    last_mtime = 0
    last_content = ""
    while True:
        try:
            if STATE_FILE.exists():
                mtime = STATE_FILE.stat().st_mtime
                if mtime != last_mtime:
                    last_mtime = mtime
                    content = STATE_FILE.read_text()
                    if content != last_content:
                        last_content = content
                        try:
                            state = json.loads(content)
                            push_event("state", state)
                        except json.JSONDecodeError:
                            pass
        except Exception:
            pass
        time.sleep(0.5)


def push_event(event_type: str, data):
    """Push an SSE event to all connected clients."""
    payload = {"type": event_type, "data": data, "timestamp": time.time()}
    dead = []
    for q in event_queues:
        try:
            q.put_nowait(payload)
        except queue.Full:
            dead.append(q)
    for q in dead:
        event_queues.remove(q)


def stream_claude_output(proc: subprocess.Popen):
    """Read claude stdout line by line and push to terminal + events."""
    for line in iter(proc.stdout.readline, ""):
        line = line.rstrip("\n")
        with terminal_lock:
            terminal_lines.append(line)
            if len(terminal_lines) > MAX_TERMINAL_LINES:
                terminal_lines.pop(0)
        push_event("terminal", line)
    proc.wait()
    push_event("process", {"status": "exited", "code": proc.returncode})


def start_claude(prompt: str):
    """Spawn claude with superx plugin and all permissions."""
    global claude_process

    if claude_process and claude_process.poll() is None:
        push_event("error", "Claude is already running. Wait for it to finish.")
        return

    cmd = [
        "claude",
        "--dangerously-skip-permissions",
        "-p", prompt,
        "--plugin-dir", str(PLUGIN_DIR),
        "--output-format", "text",
    ]

    push_event("process", {"status": "starting", "prompt": prompt})

    with terminal_lock:
        terminal_lines.clear()
        terminal_lines.append(f"$ superx: {prompt}")
        terminal_lines.append("")

    claude_process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=os.getcwd(),
    )

    t = threading.Thread(target=stream_claude_output, args=(claude_process,), daemon=True)
    t.start()


def init_state_if_needed():
    """Initialize superx-state.json if it doesn't exist."""
    if not STATE_FILE.exists():
        state_bin = PLUGIN_DIR / "bin" / "superx-state"
        if state_bin.exists():
            subprocess.run([str(state_bin), "init"], capture_output=True)
        else:
            # Fallback: create minimal state inline
            STATE_FILE.write_text(json.dumps({
                "version": "1.1.0",
                "project": {"name": "", "phase": "idle", "autonomy_level": 2},
                "plan": {"sub_projects": [], "dependency_graph": {}},
                "conflict_log": [], "agent_history": [],
                "quality_gates": {"tests_passing": False, "lint_clean": False,
                                  "last_review": None, "conflict_reflection_done": True, "dirty": False},
                "maintainer": {"enabled": False, "issue_sources": [], "pending_fixes": [], "release_queue": []},
                "communication_log": [],
                "budget": {"total_tokens": 0, "total_agents_spawned": 0, "token_limit": None, "warn_at_percent": 80}
            }, indent=2))


class DashboardHandler(SimpleHTTPRequestHandler):
    """Serves static files and API endpoints."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def do_GET(self):
        if self.path == "/api/events":
            self.handle_sse()
        elif self.path == "/api/state":
            self.handle_state()
        elif self.path == "/api/terminal":
            self.handle_terminal()
        elif self.path == "/":
            self.path = "/index.html"
            super().do_GET()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == "/api/prompt":
            self.handle_prompt()
        elif self.path == "/api/stop":
            self.handle_stop()
        else:
            self.send_error(404)

    def handle_sse(self):
        """Server-Sent Events endpoint."""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        q = queue.Queue(maxsize=100)
        event_queues.append(q)

        # Send current state immediately
        if STATE_FILE.exists():
            try:
                state = json.loads(STATE_FILE.read_text())
                self.wfile.write(f"event: state\ndata: {json.dumps(state)}\n\n".encode())
                self.wfile.flush()
            except Exception:
                pass

        try:
            while True:
                try:
                    event = q.get(timeout=15)
                    event_str = json.dumps(event)
                    self.wfile.write(f"event: {event['type']}\ndata: {event_str}\n\n".encode())
                    self.wfile.flush()
                except queue.Empty:
                    self.wfile.write(b": keepalive\n\n")
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            if q in event_queues:
                event_queues.remove(q)

    def handle_state(self):
        """Return current superx-state.json."""
        if STATE_FILE.exists():
            content = STATE_FILE.read_text()
            self.send_json(200, json.loads(content))
        else:
            self.send_json(200, {"error": "No state file found"})

    def handle_terminal(self):
        """Return terminal buffer."""
        with terminal_lock:
            lines = list(terminal_lines)
        self.send_json(200, {"lines": lines})

    def handle_prompt(self):
        """Accept a prompt and start claude."""
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode()
        try:
            data = json.loads(body)
            prompt = data.get("prompt", "").strip()
            if not prompt:
                self.send_json(400, {"error": "Empty prompt"})
                return
            start_claude(prompt)
            self.send_json(200, {"status": "started", "prompt": prompt})
        except json.JSONDecodeError:
            self.send_json(400, {"error": "Invalid JSON"})

    def handle_stop(self):
        """Stop the running claude process."""
        global claude_process
        if claude_process and claude_process.poll() is None:
            claude_process.terminate()
            push_event("process", {"status": "stopped"})
            self.send_json(200, {"status": "stopped"})
        else:
            self.send_json(200, {"status": "not_running"})

    def send_json(self, code: int, data: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        pass


def main():
    init_state_if_needed()

    watcher = threading.Thread(target=watch_state_file, daemon=True)
    watcher.start()

    server = HTTPServer(("0.0.0.0", PORT), DashboardHandler)
    print(f"\033[35m")
    print(f"  ╔══════════════════════════════════════╗")
    print(f"  ║   superx dashboard                   ║")
    print(f"  ║   http://localhost:{PORT}              ║")
    print(f"  ║   Press Ctrl+C to stop               ║")
    print(f"  ╚══════════════════════════════════════╝")
    print(f"\033[0m")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        if claude_process and claude_process.poll() is None:
            claude_process.terminate()
        server.shutdown()


if __name__ == "__main__":
    main()
