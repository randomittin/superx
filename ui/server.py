#!/usr/bin/env python3
"""superx pixel art dashboard — local web server with SSE and process management."""

import base64
import json
import os
import queue
import subprocess
import sys
import tempfile
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
from pathlib import Path

PORT = int(os.environ.get("SUPERX_PORT", 8080))
STATIC_DIR = Path(__file__).parent / "static"
STATE_FILE = Path(os.environ.get("SUPERX_STATE_FILE", "superx-state.json"))
PLUGIN_DIR = Path(__file__).parent.parent
UPLOAD_DIR = Path(tempfile.gettempdir()) / "superx-uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Shared state
event_queues: list[queue.Queue] = []
claude_process: subprocess.Popen | None = None
terminal_lines: list[str] = []
terminal_lock = threading.Lock()
MAX_TERMINAL_LINES = 500
pending_prompts: dict[int, str] = {}  # stores original prompt awaiting approval
# Phase tracking: idle → refining → planning → executing
current_phase = "idle"
original_prompt_text = ""
refined_prompt_text = ""
prompt_images_list: list[str] = []
last_response_text = ""  # latest full text from claude (set at end of streaming)
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
    # Find the user's original task prompt for the title
    task_summary = ""
    for evt in timeline_events:
        msg = evt.get("message", "")
        # Look for the user task submission
        if msg.startswith("Task:"):
            task_summary = msg[5:].strip()
            break
    # Fallback: look for the longest markdown message (the plan)
    if not task_summary:
        for evt in timeline_events:
            if evt.get("markdown"):
                # Extract first heading from markdown
                lines = evt.get("message", "").split("\n")
                for line in lines:
                    stripped = line.strip().lstrip("#").strip()
                    if stripped and len(stripped) > 5:
                        task_summary = stripped[:120]
                        break
                if task_summary:
                    break
    # Final fallback
    if not task_summary and timeline_events:
        for evt in timeline_events:
            msg = evt.get("message", "")
            if not msg.startswith("$") and not msg.startswith("Using skill") and len(msg) > 10:
                task_summary = msg[:120]
                break
    if not task_summary:
        task_summary = "Untitled session"

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


_recent_event_hashes: set = set()

def add_timeline_event(event: dict):
    """Add a timeline event and persist. Deduplicates exact content."""
    msg = event.get("message", "")
    content_hash = hash(msg[:300]) if msg else 0
    if content_hash in _recent_event_hashes and len(msg) > 30:
        return  # skip duplicate
    _recent_event_hashes.add(content_hash)
    # Keep set bounded
    if len(_recent_event_hashes) > 200:
        _recent_event_hashes.clear()

    timeline_events.append(event)
    if len(timeline_events) > MAX_TIMELINE_EVENTS:
        timeline_events.pop(0)
    push_event("timeline", event)
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

    Claude's conversational text is shown in the timeline as superx speaking,
    not just tool actions. Text is flushed to timeline when Claude transitions
    from speaking to using a tool, or at the end of a turn.
    """
    last_text = ""
    current_turn_text = ""  # full text of the current assistant turn
    flushed_text = ""  # what we already pushed to timeline
    last_seen_text = ""  # survives turn resets — the latest text from any turn

    def flush_text_to_timeline():
        """Push accumulated assistant text to the timeline if it's new."""
        nonlocal flushed_text
        text = current_turn_text.strip()
        if text and text != flushed_text and len(text) > 20:
            is_long = len(text) > 100 or "\n" in text
            add_timeline_event({
                "agent": "superx",
                "type": "info",
                "message": text,
                "markdown": is_long,
            })
            flushed_text = text

    for raw_line in iter(proc.stdout.readline, ""):
        raw_line = raw_line.rstrip("\n")
        if not raw_line:
            continue

        # Try to parse as JSON
        try:
            obj = json.loads(raw_line)
        except (json.JSONDecodeError, TypeError):
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
                    # Stream sends cumulative text — extract new portion for terminal
                    if text and text != last_text:
                        new_part = text[len(last_text):] if text.startswith(last_text) else text
                        last_text = text
                        current_turn_text = text
                        last_seen_text = text  # always keep latest across turns
                        if new_part.strip():
                            _terminal_append(new_part.strip())

                elif block_type == "tool_use":
                    # Flush any pending text to timeline before the tool action
                    flush_text_to_timeline()

                    tool_name = block.get("name", "unknown")
                    tool_input = block.get("input", {})
                    # Format tool use nicely
                    if tool_name == "Agent":
                        desc = tool_input.get("description", tool_input.get("prompt", "")[:60])
                        agent_type = tool_input.get("subagent_type", "general")
                        _terminal_append(f"[Agent] {desc}")
                        add_timeline_event({
                            "agent": "superx",
                            "type": "info",
                            "message": f"Spawning agent: {desc}"
                        })
                        # Create a unique agent ID and push spawn event
                        import hashlib
                        agent_id = f"agent-{hashlib.md5(desc.encode()).hexdigest()[:6]}"
                        short_name = desc[:20] if len(desc) > 20 else desc
                        push_event("agent_spawn", {"id": agent_id, "name": short_name, "desc": desc, "type": agent_type})
                        push_event("agent_status", {"agent": agent_id, "status": "running"})
                        push_event("agent_status", {"agent": "superx", "status": "running"})
                    elif tool_name == "Bash":
                        cmd = tool_input.get("command", "")[:80]
                        _terminal_append(f"$ {cmd}")
                        add_timeline_event({
                            "agent": "coder",
                            "type": "info",
                            "message": f"$ {cmd}"
                        })
                        push_event("agent_status", {"agent": "coder", "status": "running"})
                    elif tool_name in ("Write", "Edit"):
                        fpath = tool_input.get("file_path", "")
                        fname = fpath.split("/")[-1] if fpath else "unknown"
                        _terminal_append(f"[{tool_name}] {fname}")
                        add_timeline_event({
                            "agent": "coder",
                            "type": "info",
                            "message": f"{tool_name}: {fname}"
                        })
                        push_event("agent_status", {"agent": "coder", "status": "running"})
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
                        push_event("agent_status", {"agent": "superx", "status": "running"})
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
                _terminal_append(f"  -> {short}")

        # Reset text tracking between assistant turns
        if msg_type != "assistant" and last_text:
            last_text = ""

    proc.wait()

    global last_response_text

    # Flush the final text block to timeline
    # Use last_seen_text (survives turn resets) if current_turn_text was cleared
    final_text = current_turn_text.strip() or last_seen_text.strip()
    if final_text and final_text != flushed_text and len(final_text) > 20:
        is_long = len(final_text) > 100 or "\n" in final_text
        add_timeline_event({
            "agent": "superx",
            "type": "info",
            "message": final_text,
            "markdown": is_long,
        })

    # Store the last response for phase transitions
    last_response_text = last_seen_text.strip()

    # If planning phase, check if a plan .md file was written but only a summary shown
    if current_phase == "planning" and last_response_text:
        # If the response is just a summary (mentions "saved to" but plan not inline),
        # try to read the actual plan file and show it
        if "saved to" in last_response_text.lower() and len(last_response_text) < 2000:
            import glob
            plan_files = sorted(
                glob.glob(os.path.join(os.getcwd(), "docs/superpowers/plans/*.md")),
                key=os.path.getmtime, reverse=True
            )
            if plan_files:
                try:
                    plan_content = Path(plan_files[0]).read_text()
                    if len(plan_content) > 100:
                        add_timeline_event({
                            "agent": "superx",
                            "type": "info",
                            "message": plan_content.strip(),
                            "markdown": True,
                        })
                        last_response_text = plan_content.strip()
                except Exception:
                    pass

    # Phase-aware completion events
    if current_phase == "refining":
        push_event("prompt_refined", {"status": "awaiting_approval"})
    elif current_phase == "planning":
        push_event("plan_ready", {"status": "awaiting_approval"})

    push_event("agent_status", {"agent": "superx", "status": "idle"})
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


def _build_image_note(images: list) -> str:
    """Build prompt suffix for attached images."""
    if not images:
        return ""
    note = "\n\nAttached images (use Read tool to view):\n"
    for img in images:
        note += f"- {img}\n"
    return note


def _spawn_claude(prompt: str, images: list = None):
    """Low-level: spawn claude process with given prompt and optional images."""
    global claude_process
    prompt += _build_image_note(images or [])

    cmd = [
        "claude",
        "--dangerously-skip-permissions",
        "-p", prompt,
        "--plugin-dir", str(PLUGIN_DIR),
        "--output-format", "stream-json",
        "--verbose",
    ]

    claude_process = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, cwd=os.getcwd(),
    )
    t = threading.Thread(target=stream_claude_output, args=(claude_process,), daemon=True)
    t.start()


def start_claude(prompt: str, images: list = None):
    """Start with prompt refinement phase."""
    global current_phase, original_prompt_text, prompt_images_list

    if claude_process and claude_process.poll() is None:
        push_event("error", "Claude is already running. Wait for it to finish.")
        return

    current_phase = "refining"
    original_prompt_text = prompt
    prompt_images_list = images or []

    refine_prompt = (
        "You are a senior prompt engineer. Improve the following user prompt that "
        "will be given to a CTO-level coding assistant. Make it:\n\n"
        "1. CLEARER — remove ambiguity, be specific about what to build\n"
        "2. STRUCTURED — use markdown with sections, bullet points\n"
        "3. COMPLETE — fill reasonable gaps (tech stack preferences, deployment, testing)\n"
        "4. ACTIONABLE — explicit requirements with acceptance criteria\n"
        "5. CONCISE — no fluff, every sentence adds value\n\n"
        "Return ONLY the improved prompt. No preamble like 'Here is the improved prompt'. "
        "No explanations. Just the refined prompt in clean markdown.\n\n"
        "---\n"
        "Original prompt:\n" + prompt
    )

    push_event("process", {"status": "starting", "prompt": prompt})
    push_event("agent_status", {"agent": "superx", "status": "running"})

    with terminal_lock:
        terminal_lines.clear()
        terminal_lines.append(f"$ superx: {prompt}")
        if images:
            terminal_lines.append(f"  [{len(images)} image(s) attached]")
        terminal_lines.append("")
        terminal_lines.append("=== REFINING PROMPT ===")
        terminal_lines.append("")

    _spawn_claude(refine_prompt, images)


def start_planning(prompt: str, images: list = None):
    """Run the planning phase with the refined prompt."""
    global current_phase

    if claude_process and claude_process.poll() is None:
        push_event("error", "Claude is already running.")
        return

    current_phase = "planning"

    plan_prompt = (
        "IMPORTANT: Present a comprehensive execution plan before writing any code. "
        "Think like a CTO planning a production system.\n\n"
        "FIRST: Spawn parallel Agent subprocesses to research ALL independent aspects simultaneously. "
        "For example, spawn separate agents to: analyze external repos, check APIs/docs, "
        "review existing code patterns, research deployment options. Do NOT do research sequentially "
        "when it can be parallelized.\n\n"
        "CHECKPOINT: Save ALL research findings to .md files in docs/analysis/ directory. "
        "For each external repo, API, codebase, or documentation source, create a separate .md file "
        "(e.g., docs/analysis/repo-name.md, docs/analysis/api-name.md). "
        "This avoids repeating research efforts in future runs.\n\n"
        "Your plan MUST cover:\n\n"
        "1. ASSUMPTIONS — what you're assuming, what needs confirmation\n"
        "2. ARCHITECTURE — tech stack, system design, data flow\n"
        "3. INFRASTRUCTURE — hosting, CI/CD pipelines, deployment strategy, "
        "environment management, DNS/SSL, monitoring/observability, error tracking\n"
        "4. SECURITY — auth, rate limiting, CORS, CSP, secrets management\n"
        "5. SUB-PROJECTS — decomposition with dependency graph, agent assignments, "
        "parallelism opportunities\n"
        "6. EACH SUB-PROJECT must have: scope, agent, expected outcome, "
        "acceptance criteria (testable done conditions), risks and mitigations\n"
        "7. TESTING STRATEGY — unit, integration, E2E, visual regression\n"
        "8. DEPLOYMENT PIPELINE — PR checks, preview deploys, staging, production, rollback\n"
        "9. AGENT DISPATCH SUMMARY — phase table with parallelism\n"
        "10. WHAT'S NEEDED FROM USER — blockers, decisions, credentials, assets\n\n"
        "Use markdown with clear headers, tables, and code blocks for structure. "
        "Make reasonable assumptions and note them explicitly. "
        "Do NOT ask clarifying questions. Do NOT start implementing.\n\n"
        "CRITICAL: You MUST present the FULL plan in your response text. "
        "Do NOT just save it to a file and show a summary. "
        "The user needs to see the complete plan in the chat to review and approve it. "
        "You may ALSO save it to a file, but the full plan must appear in your response.\n\n"
        "End with exactly: ---PLAN READY---\n\n"
        "User task: " + prompt
    )

    push_event("process", {"status": "starting", "prompt": "Planning..."})
    push_event("agent_status", {"agent": "superx", "status": "running"})

    with terminal_lock:
        terminal_lines.append("")
        terminal_lines.append("=== PLANNING ===")
        terminal_lines.append("")

    _spawn_claude(plan_prompt, images)


def execute_approved_plan(original_prompt: str):
    """Execute after user approves the plan."""
    if claude_process and claude_process.poll() is None:
        push_event("error", "Claude is already running.")
        return

    exec_prompt = (
        "The user has approved your plan. Now execute it fully. "
        "The original task was: " + original_prompt
    )

    push_event("process", {"status": "starting", "prompt": "Executing approved plan..."})

    with terminal_lock:
        terminal_lines.append("")
        terminal_lines.append("=== PLAN APPROVED — EXECUTING ===")
        terminal_lines.append("")

    _spawn_claude(exec_prompt)


def revise_refinement(original_prompt: str, feedback: str, images: list = None):
    """Re-run prompt refinement with user feedback."""
    global current_phase

    if claude_process and claude_process.poll() is None:
        push_event("error", "Claude is already running.")
        return

    current_phase = "refining"

    # Include the previous refined version so Claude can update it
    prev_refined = last_response_text or original_prompt
    revise_prompt = (
        "You previously refined a user prompt into this version:\n\n"
        "---BEGIN REFINED PROMPT---\n"
        f"{prev_refined}\n"
        "---END REFINED PROMPT---\n\n"
        "The user reviewed it and wants these changes:\n\n"
        f'"{feedback}"\n\n'
        "Return ONLY the updated refined prompt with the user's changes applied. "
        "No preamble, no explanations — just the prompt."
    )

    add_timeline_event({
        "agent": "superx",
        "type": "warning",
        "message": f"Revising prompt: {feedback}",
        "useMono": True,
    })

    push_event("process", {"status": "starting", "prompt": "Revising prompt..."})
    push_event("agent_status", {"agent": "superx", "status": "running"})

    with terminal_lock:
        terminal_lines.append("")
        terminal_lines.append(f"=== REVISING PROMPT: {feedback} ===")
        terminal_lines.append("")

    _spawn_claude(revise_prompt, images)


def revise_plan(original_prompt: str, feedback: str, images: list = None):
    """Re-run planning with user feedback."""
    global current_phase
    current_phase = "planning"
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

    push_event("process", {"status": "starting", "prompt": "Revising plan..."})

    with terminal_lock:
        terminal_lines.append("")
        terminal_lines.append("=== REVISING PLAN ===")
        if images:
            terminal_lines.append(f"  [{len(images)} image(s) attached]")
        terminal_lines.append("")

    _spawn_claude(revise_prompt, images)


def continue_on_terminal():
    """Open the system terminal with claude --continue."""
    cwd = os.getcwd()
    # macOS: open Terminal.app with claude --continue
    script = f'tell application "Terminal" to do script "cd {cwd} && claude --continue"'
    subprocess.Popen(["osascript", "-e", script])


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
        elif self.path == "/api/upload":
            self.handle_upload()
        elif self.path == "/api/continue":
            self.handle_continue()
        elif self.path == "/api/github":
            self.handle_github()
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
            images = data.get("images", [])
            if not prompt:
                self.send_json(400, {"error": "Empty prompt"})
                return
            start_claude(prompt, images)
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
        """Phase-aware approve: refined prompt → plan, plan → execute."""
        global current_phase, refined_prompt_text
        if current_phase == "refining":
            # Approved the refined prompt — move to planning
            refined_prompt_text = last_response_text or original_prompt_text
            add_timeline_event({
                "agent": "superx", "type": "success",
                "message": "Refined prompt approved"
            })
            start_planning(refined_prompt_text, prompt_images_list)
            self.send_json(200, {"status": "planning"})
        elif current_phase == "planning":
            # Approved the plan — execute
            prompt = refined_prompt_text or original_prompt_text
            execute_approved_plan(prompt)
            self.send_json(200, {"status": "executing"})
        else:
            self.send_json(400, {"error": "Nothing to approve"})

    def handle_revise(self):
        """Phase-aware revise: re-refine prompt or revise plan."""
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode()
        try:
            data = json.loads(body)
            feedback = data.get("feedback", "").strip()
            images = data.get("images", [])
            if not feedback:
                self.send_json(400, {"error": "Provide feedback"})
                return
            if current_phase == "refining":
                # Re-refine with feedback
                revise_refinement(original_prompt_text, feedback, images)
                self.send_json(200, {"status": "re-refining"})
            elif current_phase == "planning":
                prompt = refined_prompt_text or original_prompt_text
                revise_plan(prompt, feedback, images)
                self.send_json(200, {"status": "revising"})
            else:
                self.send_json(400, {"error": "Nothing to revise"})
        except json.JSONDecodeError:
            self.send_json(400, {"error": "Invalid JSON"})

    def handle_github(self):
        """Set GitHub remote and commit+push using SSH (matching gh config)."""
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode()
        try:
            data = json.loads(body)
            url = data.get("url", "").strip()
            if not url:
                self.send_json(400, {"error": "No URL provided"})
                return

            cwd = os.getcwd()
            steps = []

            # Extract owner/repo from any URL format
            repo_slug = url.replace("https://github.com/", "").replace("http://github.com/", "")
            repo_slug = repo_slug.replace("github.com/", "").replace("git@github.com:", "")
            repo_slug = repo_slug.rstrip("/").rstrip(".git")

            # Use SSH URL since gh is configured for SSH protocol
            ssh_url = f"git@github.com:{repo_slug}.git"

            # Init git if needed
            if not os.path.isdir(os.path.join(cwd, ".git")):
                subprocess.run(["git", "init"], capture_output=True, text=True, cwd=cwd)
                steps.append("git init")

            # Set remote to SSH URL
            subprocess.run(["git", "remote", "remove", "origin"],
                           capture_output=True, text=True, cwd=cwd)
            subprocess.run(["git", "remote", "add", "origin", ssh_url],
                           capture_output=True, text=True, cwd=cwd)
            steps.append(f"remote: {repo_slug} (SSH)")

            # Stage all, commit
            subprocess.run(["git", "add", "-A"], capture_output=True, text=True, cwd=cwd)
            r = subprocess.run(["git", "commit", "-m", "superx: commit via dashboard"],
                               capture_output=True, text=True, cwd=cwd)
            commit_msg = r.stdout.strip()[:80] or r.stderr.strip()[:80]
            steps.append(f"commit: {commit_msg}")

            # Push via SSH
            r = subprocess.run(["git", "push", "-u", "origin", "HEAD"],
                               capture_output=True, text=True, cwd=cwd)

            if r.returncode == 0:
                steps.append("push: success")
                self.send_json(200, {"status": "pushed", "steps": steps})
            else:
                steps.append(f"push: {r.stderr.strip()[:120]}")
                self.send_json(200, {"status": "push_failed", "steps": steps,
                                     "error": r.stderr.strip()[:200]})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def handle_upload(self):
        """Accept image upload as base64 JSON, save to temp dir."""
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode()
        try:
            data = json.loads(body)
            name = data.get("name", "image.png")
            b64 = data.get("data", "")
            if not b64:
                self.send_json(400, {"error": "No image data"})
                return
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            img_bytes = base64.b64decode(b64)
            safe_name = "".join(c for c in name if c.isalnum() or c in "._-")
            fname = f"{int(time.time())}_{safe_name}"
            fpath = UPLOAD_DIR / fname
            fpath.write_bytes(img_bytes)
            self.send_json(200, {"path": str(fpath)})
        except Exception as e:
            self.send_json(400, {"error": str(e)})

    def handle_continue(self):
        """Open system terminal with claude --continue."""
        continue_on_terminal()
        self.send_json(200, {"status": "opening_terminal"})

    def handle_stop(self):
        """Stop the running claude process, archive, and clear the session."""
        global claude_process
        if claude_process and claude_process.poll() is None:
            claude_process.terminate()
        # Archive before clearing
        archive_session()
        # Clear session
        timeline_events.clear()
        _recent_event_hashes.clear()
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
