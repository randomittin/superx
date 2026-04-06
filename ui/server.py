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
from socketserver import ThreadingMixIn
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
pending_prompts: dict[int, str] = {}  # stores original prompt awaiting approval
timeline_events: list[dict] = []  # persisted timeline events
MAX_TIMELINE_EVENTS = 200
SESSION_FILE = Path("superx-session.json")
HISTORY_FILE = Path("superx-history.json")
session_lock = threading.Lock()
MAX_HISTORY_SESSIONS = 50


def save_session():
    """Persist timeline events and terminal lines to disk."""
    with session_lock:
        data = {
            "timeline": timeline_events[-MAX_TIMELINE_EVENTS:],
            "terminal": terminal_lines[-MAX_TERMINAL_LINES:],
            "pending_prompt": pending_prompts.get(0, None),
            "saved_at": time.time(),
        }
        SESSION_FILE.write_text(json.dumps(data))


def archive_session():
    """Save current session to history before clearing."""
    if not timeline_events:
        return
    # Find the first user task message for summary
    task_summary = ""
    for evt in timeline_events:
        msg = evt.get("message", "")
        if msg.startswith("Task:"):
            task_summary = msg[5:].strip()
            break
    if not task_summary and timeline_events:
        task_summary = timeline_events[0].get("message", "")[:100]

    entry = {
        "timestamp": time.time(),
        "task": task_summary,
        "event_count": len(timeline_events),
        "timeline": timeline_events[-MAX_TIMELINE_EVENTS:],
        "terminal": terminal_lines[-MAX_TERMINAL_LINES:],
    }

    history = []
    if HISTORY_FILE.exists():
        try:
            history = json.loads(HISTORY_FILE.read_text())
        except (json.JSONDecodeError, TypeError):
            history = []

    history.insert(0, entry)
    history = history[:MAX_HISTORY_SESSIONS]
    HISTORY_FILE.write_text(json.dumps(history))


def load_session():
    """Restore session from disk on startup."""
    global timeline_events
    if SESSION_FILE.exists():
        try:
            data = json.loads(SESSION_FILE.read_text())
            timeline_events = data.get("timeline", [])
            restored_terminal = data.get("terminal", [])
            with terminal_lock:
                terminal_lines.clear()
                terminal_lines.extend(restored_terminal)
            pending = data.get("pending_prompt")
            if pending:
                pending_prompts[0] = pending
        except (json.JSONDecodeError, KeyError):
            pass


def add_timeline_event(event: dict):
    """Add a timeline event and persist."""
    timeline_events.append(event)
    if len(timeline_events) > MAX_TIMELINE_EVENTS:
        timeline_events.pop(0)
    push_event("timeline", event)
    # Save async to avoid blocking
    threading.Thread(target=save_session, daemon=True).start()


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
    """Read claude stdout (stream-json format) and push parsed events.

    Stream-json lines are JSON objects. We extract meaningful content
    and push it to both the terminal (formatted) and timeline (events).
    """
    last_text = ""

    for raw_line in iter(proc.stdout.readline, ""):
        raw_line = raw_line.rstrip("\n")
        if not raw_line:
            continue

        # Try to parse as JSON
        try:
            obj = json.loads(raw_line)
        except (json.JSONDecodeError, TypeError):
            # Plain text fallback
            _terminal_append(raw_line)
            continue

        if not isinstance(obj, dict):
            _terminal_append(raw_line)
            continue

        msg_type = obj.get("type", "")
        msg = obj.get("message", {})
        content = msg.get("content", []) if isinstance(msg, dict) else []

        # Extract text content from assistant messages
        if msg_type == "assistant" and content:
            for block in content:
                if not isinstance(block, dict):
                    continue
                block_type = block.get("type", "")

                if block_type == "text":
                    text = block.get("text", "")
                    # Only show new text (stream sends cumulative)
                    if text and text != last_text:
                        new_part = text[len(last_text):] if text.startswith(last_text) else text
                        last_text = text
                        if new_part.strip():
                            _terminal_append(new_part.strip())
                            # Detect plan content and send as rich plan event
                            lower = new_part.lower()
                            if any(kw in lower for kw in ["sub-project", "dependency", "wave ", "phase ", "## plan", "decompos"]):
                                add_timeline_event({
                                    "agent": "architect",
                                    "type": "warning",
                                    "message": new_part.strip()[:300]
                                })
                            elif any(kw in lower for kw in ["quality gate", "test", "lint", "review"]):
                                add_timeline_event({
                                    "agent": "test-runner",
                                    "type": "info",
                                    "message": new_part.strip()[:200]
                                })
                            elif any(kw in lower for kw in ["design", "ui/ux", "component", "layout", "color"]):
                                add_timeline_event({
                                    "agent": "design",
                                    "type": "info",
                                    "message": new_part.strip()[:200]
                                })
                            else:
                                add_timeline_event({
                                    "agent": "superx",
                                    "type": "info",
                                    "message": new_part.strip()[:200]
                                })

                elif block_type == "tool_use":
                    tool_name = block.get("name", "unknown")
                    tool_input = block.get("input", {})
                    # Format tool use nicely
                    if tool_name == "Agent":
                        desc = tool_input.get("description", tool_input.get("prompt", "")[:60])
                        _terminal_append(f"[Agent] {desc}")
                        add_timeline_event({
                            "agent": "superx",
                            "type": "info",
                            "message": f"Spawning agent: {desc}"
                        })
                    elif tool_name == "Bash":
                        cmd = tool_input.get("command", "")[:80]
                        _terminal_append(f"$ {cmd}")
                        add_timeline_event({
                            "agent": "coder",
                            "type": "info",
                            "message": f"$ {cmd}"
                        })
                    elif tool_name in ("Write", "Edit"):
                        fpath = tool_input.get("file_path", "")
                        fname = fpath.split("/")[-1] if fpath else "unknown"
                        _terminal_append(f"[{tool_name}] {fname}")
                        add_timeline_event({
                            "agent": "coder",
                            "type": "info",
                            "message": f"{tool_name}: {fname}"
                        })
                    elif tool_name == "Read":
                        fpath = tool_input.get("file_path", "")
                        fname = fpath.split("/")[-1] if fpath else "unknown"
                        _terminal_append(f"[Read] {fname}")
                    elif tool_name == "Skill":
                        skill = tool_input.get("skill", "unknown")
                        _terminal_append(f"[Skill] {skill}")
                        add_timeline_event({
                            "agent": "superx",
                            "type": "info",
                            "message": f"Using skill: {skill}"
                        })
                    elif tool_name in ("TaskCreate", "TaskUpdate"):
                        subject = tool_input.get("subject", tool_input.get("status", ""))
                        _terminal_append(f"[Task] {subject}")
                        add_timeline_event({
                            "agent": "superx",
                            "type": "warning",
                            "message": f"Task: {subject}"
                        })
                    elif tool_name in ("Grep", "Glob"):
                        pattern = tool_input.get("pattern", "")
                        _terminal_append(f"[{tool_name}] {pattern}")
                    else:
                        _terminal_append(f"[{tool_name}]")

        # Tool results
        elif msg_type == "result":
            result_text = obj.get("result", "")
            if isinstance(result_text, str) and result_text.strip():
                short = result_text.strip()[:150]
                _terminal_append(f"  → {short}")

        # Reset text tracking between messages
        if msg_type != "assistant":
            last_text = ""

    proc.wait()
    # If there's a pending prompt, this was a plan phase — show approval UI
    if pending_prompts.get(0):
        push_event("plan_ready", {"status": "awaiting_approval"})
    push_event("process", {"status": "exited", "code": proc.returncode})


_last_session_save = 0

def _terminal_append(line: str):
    """Add a line to the terminal buffer and push to clients."""
    global _last_session_save
    with terminal_lock:
        terminal_lines.append(line)
        if len(terminal_lines) > MAX_TERMINAL_LINES:
            terminal_lines.pop(0)
    push_event("terminal", line)
    # Throttled session save (every 2 seconds max)
    now = time.time()
    if now - _last_session_save > 2:
        _last_session_save = now
        threading.Thread(target=save_session, daemon=True).start()


def start_claude(prompt: str):
    """Spawn claude with superx plugin and all permissions."""
    global claude_process

    if claude_process and claude_process.poll() is None:
        push_event("error", "Claude is already running. Wait for it to finish.")
        return

    # Phase 1: Plan only — do not execute, do not ask questions
    plan_prompt = (
        "IMPORTANT: Present a clear execution plan before writing any code. "
        "List sub-projects, dependency order, which agents handle each part, "
        "and expected outcome. Use clear headers and bullet points. "
        "Do NOT ask clarifying questions — make reasonable assumptions and note them. "
        "Do NOT start implementing. ONLY output the plan then stop. "
        "End with exactly: ---PLAN READY---\n\n"
        "User task: " + prompt
    )

    # Store the original prompt for execution after approval
    pending_prompts[0] = prompt

    cmd = [
        "claude",
        "--dangerously-skip-permissions",
        "-p", plan_prompt,
        "--plugin-dir", str(PLUGIN_DIR),
        "--output-format", "stream-json",
        "--verbose",
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


def execute_approved_plan(original_prompt: str):
    """Execute after user approves the plan."""
    global claude_process

    if claude_process and claude_process.poll() is None:
        push_event("error", "Claude is already running.")
        return

    exec_prompt = (
        "The user has approved your plan. Now execute it fully. "
        "The original task was: " + original_prompt
    )

    cmd = [
        "claude",
        "--dangerously-skip-permissions",
        "-p", exec_prompt,
        "--plugin-dir", str(PLUGIN_DIR),
        "--output-format", "stream-json",
        "--verbose",
    ]

    push_event("process", {"status": "starting", "prompt": "Executing approved plan..."})

    with terminal_lock:
        terminal_lines.append("")
        terminal_lines.append("=== PLAN APPROVED — EXECUTING ===")
        terminal_lines.append("")

    claude_process = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, cwd=os.getcwd(),
    )
    t = threading.Thread(target=stream_claude_output, args=(claude_process,), daemon=True)
    t.start()


def revise_plan(original_prompt: str, feedback: str):
    """Re-run planning with user feedback."""
    global claude_process

    if claude_process and claude_process.poll() is None:
        push_event("error", "Claude is already running.")
        return

    revise_prompt = (
        "The user reviewed your plan and wants changes. Here's their feedback:\n\n"
        f'"{feedback}"\n\n'
        "Please revise the plan based on this feedback. "
        "Present the updated plan. DO NOT start implementing. "
        "End your response with: ---PLAN READY---\n\n"
        "Original task: " + original_prompt
    )

    pending_prompts[0] = original_prompt

    cmd = [
        "claude",
        "--dangerously-skip-permissions",
        "-p", revise_prompt,
        "--plugin-dir", str(PLUGIN_DIR),
        "--output-format", "stream-json",
        "--verbose",
    ]

    push_event("process", {"status": "starting", "prompt": "Revising plan..."})

    with terminal_lock:
        terminal_lines.append("")
        terminal_lines.append("=== REVISING PLAN ===")
        terminal_lines.append("")

    claude_process = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, cwd=os.getcwd(),
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
        elif self.path == "/api/session":
            self.handle_session()
        elif self.path == "/api/history":
            self.handle_history()
        elif self.path.startswith("/api/history/"):
            self.handle_history_detail()
        elif self.path == "/":
            self.path = "/index.html"
            super().do_GET()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == "/api/prompt":
            self.handle_prompt()
        elif self.path == "/api/approve":
            self.handle_approve()
        elif self.path == "/api/revise":
            self.handle_revise()
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

    def handle_session(self):
        """Return full session state for restore after refresh."""
        with terminal_lock:
            term = list(terminal_lines)
        running = claude_process is not None and claude_process.poll() is None
        has_pending = bool(pending_prompts.get(0))
        self.send_json(200, {
            "timeline": timeline_events[-MAX_TIMELINE_EVENTS:],
            "terminal": term,
            "running": running,
            "pending_plan": has_pending,
        })

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

    def handle_history(self):
        """Return list of past sessions (summary only)."""
        history = []
        if HISTORY_FILE.exists():
            try:
                full = json.loads(HISTORY_FILE.read_text())
                for i, entry in enumerate(full):
                    history.append({
                        "index": i,
                        "timestamp": entry.get("timestamp", 0),
                        "task": entry.get("task", ""),
                        "event_count": entry.get("event_count", 0),
                    })
            except (json.JSONDecodeError, TypeError):
                pass
        self.send_json(200, {"sessions": history})

    def handle_history_detail(self):
        """Return a specific past session by index."""
        try:
            idx = int(self.path.split("/")[-1])
        except ValueError:
            self.send_json(400, {"error": "Invalid index"})
            return
        if not HISTORY_FILE.exists():
            self.send_json(404, {"error": "No history"})
            return
        try:
            full = json.loads(HISTORY_FILE.read_text())
            if 0 <= idx < len(full):
                self.send_json(200, full[idx])
            else:
                self.send_json(404, {"error": "Session not found"})
        except (json.JSONDecodeError, TypeError):
            self.send_json(500, {"error": "Corrupt history"})

    def handle_approve(self):
        """User approved the plan — execute it."""
        original = pending_prompts.get(0, "")
        if not original:
            self.send_json(400, {"error": "No pending plan to approve"})
            return
        execute_approved_plan(original)
        pending_prompts.pop(0, None)
        self.send_json(200, {"status": "executing"})

    def handle_revise(self):
        """User wants to revise the plan."""
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode()
        try:
            data = json.loads(body)
            feedback = data.get("feedback", "").strip()
            if not feedback:
                self.send_json(400, {"error": "Provide feedback for revision"})
                return
            original = pending_prompts.get(0, "")
            if not original:
                self.send_json(400, {"error": "No pending plan to revise"})
                return
            revise_plan(original, feedback)
            self.send_json(200, {"status": "revising"})
        except json.JSONDecodeError:
            self.send_json(400, {"error": "Invalid JSON"})

    def handle_stop(self):
        """Stop the running claude process, archive, and clear the session."""
        global claude_process
        if claude_process and claude_process.poll() is None:
            claude_process.terminate()
        # Archive before clearing
        archive_session()
        # Clear session
        timeline_events.clear()
        with terminal_lock:
            terminal_lines.clear()
        pending_prompts.clear()
        if SESSION_FILE.exists():
            SESSION_FILE.unlink()
        push_event("process", {"status": "stopped"})
        self.send_json(200, {"status": "stopped"})

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
    load_session()

    watcher = threading.Thread(target=watch_state_file, daemon=True)
    watcher.start()

    class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
        daemon_threads = True

    server = ThreadedHTTPServer(("0.0.0.0", PORT), DashboardHandler)
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
