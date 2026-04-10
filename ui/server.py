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
CHECKPOINT_FILE = Path("superx-checkpoint.json")
GITHUB_CONFIG_FILE = Path("superx-github.json")
session_lock = threading.Lock()
MAX_HISTORY_SESSIONS = 50

# GitHub / project directory config (persisted)
configured_project_path: str = ""  # where Claude writes code
configured_github_url: str = ""


def _load_github_config():
    global configured_project_path, configured_github_url
    if GITHUB_CONFIG_FILE.exists():
        try:
            d = json.loads(GITHUB_CONFIG_FILE.read_text())
            configured_project_path = d.get("path", "")
            configured_github_url = d.get("url", "")
        except Exception:
            pass


def _save_github_config():
    GITHUB_CONFIG_FILE.write_text(json.dumps({
        "path": configured_project_path,
        "url": configured_github_url,
    }))


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


def save_checkpoint():
    """Save current execution state so it can be resumed after crash/restart."""
    if current_phase == "idle":
        # Clear checkpoint when idle
        if CHECKPOINT_FILE.exists():
            CHECKPOINT_FILE.unlink()
        return
    data = {
        "phase": current_phase,
        "original_prompt": original_prompt_text,
        "refined_prompt": refined_prompt_text,
        "last_response": last_response_text,
        "images": prompt_images_list,
        "timestamp": time.time(),
        "cwd": os.getcwd(),
    }
    CHECKPOINT_FILE.write_text(json.dumps(data, indent=2))


def load_checkpoint():
    """Load checkpoint if it exists."""
    if not CHECKPOINT_FILE.exists():
        return None
    try:
        return json.loads(CHECKPOINT_FILE.read_text())
    except (json.JSONDecodeError, KeyError):
        return None


def clear_checkpoint():
    """Remove checkpoint file."""
    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()


def resume_from_checkpoint(checkpoint: dict):
    """Resume execution from a saved checkpoint."""
    global current_phase, original_prompt_text, refined_prompt_text, last_response_text, prompt_images_list

    phase = checkpoint.get("phase", "idle")
    original_prompt_text = checkpoint.get("original_prompt", "")
    refined_prompt_text = checkpoint.get("refined_prompt", "")
    last_response_text = checkpoint.get("last_response", "")
    prompt_images_list = checkpoint.get("images", [])

    add_timeline_event({
        "agent": "superx",
        "type": "warning",
        "message": f"Resuming from checkpoint (phase: {phase})",
    })

    if phase == "refining":
        # Re-run refinement
        start_claude(original_prompt_text, prompt_images_list)
    elif phase == "planning":
        # Re-run planning with the refined prompt
        prompt = refined_prompt_text or original_prompt_text
        start_planning(prompt, prompt_images_list)
    elif phase == "executing":
        # Resume execution
        prompt = refined_prompt_text or original_prompt_text
        execute_approved_plan(prompt)


_recent_msg_keys: list = []  # exact first-200-char strings for dedup
_last_timeline_key: str = ""  # last added event key for consecutive dedup

def add_timeline_event(event: dict):
    """Add a timeline event and persist. Deduplicates aggressively."""
    global _last_timeline_key
    msg = event.get("message", "")
    key = msg.strip()[:200] if msg else ""
    agent = event.get("agent", "")

    # Skip exact duplicates (same first 200 chars)
    if key and len(key) > 20 and key in _recent_msg_keys:
        return

    # Skip consecutive duplicate from same agent (even partial match)
    if key and _last_timeline_key and agent:
        if key == _last_timeline_key:
            return
        # If new message starts with or is contained in last message
        if len(key) > 30 and (key.startswith(_last_timeline_key[:80]) or _last_timeline_key.startswith(key[:80])):
            return

    # Track for dedup
    if key and len(key) > 20:
        _recent_msg_keys.append(key)
        if len(_recent_msg_keys) > 150:
            _recent_msg_keys.pop(0)
        _last_timeline_key = key

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
    file_write_count = 0  # track file writes for auto-checkpoint

    def flush_text_to_timeline():
        """Push accumulated assistant text to the timeline if it's new."""
        nonlocal flushed_text
        text = current_turn_text.strip()
        if not text or len(text) <= 20:
            return
        # Skip if same as last flush or if new text is just more of the same
        if text == flushed_text:
            return
        if flushed_text and text.startswith(flushed_text[:100]):
            return
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
                        # Auto-checkpoint every 5 file writes
                        file_write_count += 1
                        if file_write_count % 5 == 0 and configured_project_path:
                            threading.Thread(
                                target=_auto_checkpoint_git,
                                args=(file_write_count,),
                                daemon=True,
                            ).start()
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
            search_dir = configured_project_path or os.getcwd()
            plan_files = sorted(
                glob.glob(os.path.join(search_dir, "docs/superpowers/plans/*.md")),
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

    # Final checkpoint when execution completes
    if current_phase == "executing" and configured_project_path:
        threading.Thread(
            target=_auto_checkpoint_git,
            args=(file_write_count,),
            daemon=True,
        ).start()

    # Phase-aware completion events
    if current_phase == "refining":
        push_event("prompt_refined", {"status": "awaiting_approval"})
    elif current_phase == "planning":
        push_event("plan_ready", {"status": "awaiting_approval"})
    elif current_phase == "executing":
        # Reset to idle and clear checkpoint so resume bar doesn't show
        current_phase = "idle"
        if CHECKPOINT_FILE.exists():
            CHECKPOINT_FILE.unlink()

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


def _auto_checkpoint_git(file_count: int):
    """Auto-commit in the project directory as a checkpoint."""
    cwd = configured_project_path
    if not cwd or not os.path.isdir(os.path.join(cwd, ".git")):
        return
    try:
        subprocess.run(["git", "add", "-A"], capture_output=True, text=True, cwd=cwd)
        r = subprocess.run(
            ["git", "commit", "-m", f"superx auto-checkpoint: {file_count} files written"],
            capture_output=True, text=True, cwd=cwd,
        )
        if r.returncode == 0:
            add_timeline_event({
                "agent": "superx",
                "type": "warning",
                "message": f"Auto-checkpoint saved ({file_count} files)",
            })
            # Only re-save state if we're still actively executing — otherwise a
            # slow git commit from a previous run could resurrect a stale
            # checkpoint after the main thread has already cleared it.
            if current_phase == "executing":
                save_checkpoint()
    except Exception:
        pass


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

    work_dir = configured_project_path or os.getcwd()
    claude_process = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, cwd=work_dir,
    )
    t = threading.Thread(target=stream_claude_output, args=(claude_process,), daemon=True)
    t.start()


def start_claude(prompt: str, images: list = None):
    """Start with prompt refinement phase."""
    global current_phase, original_prompt_text, prompt_images_list

    if claude_process and claude_process.poll() is None:
        push_event("error", "Claude is already running. Wait for it to finish.")
        return

    # Clear any stale checkpoint from a previous task before writing the new one.
    # This prevents a leftover "resume" bar from popping up if the previous task
    # finished but didn't clean up its checkpoint for any reason.
    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()

    current_phase = "refining"
    original_prompt_text = prompt
    prompt_images_list = images or []
    save_checkpoint()

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
    save_checkpoint()

    work_dir = configured_project_path or os.getcwd()
    plan_prompt = (
        "IMPORTANT: Present a comprehensive execution plan before writing any code. "
        "Think like a CTO planning a production system.\n\n"
        f"PROJECT DIRECTORY: {work_dir} — ALL code, configs, docs MUST go here.\n\n"
        "FIRST: Spawn parallel Agent subprocesses to research ALL independent aspects simultaneously. "
        "For example, spawn separate agents to: analyze external repos, check APIs/docs, "
        "review existing code patterns, research deployment options. Do NOT do research sequentially "
        "when it can be parallelized. ALWAYS use multiple agents in parallel.\n\n"
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
    global current_phase
    if claude_process and claude_process.poll() is None:
        push_event("error", "Claude is already running.")
        return

    current_phase = "executing"
    save_checkpoint()

    work_dir = configured_project_path or os.getcwd()
    exec_prompt = (
        "The user has approved your plan. Execute it NOW with maximum parallelism.\n\n"
        "CRITICAL RULES:\n"
        f"1. ALL code and files MUST be written to: {work_dir}\n"
        "2. SPAWN PARALLEL AGENTS for every independent task. Use the Agent tool aggressively. "
        "If two tasks don't depend on each other, run them simultaneously. "
        "For example: UI, API, config, tests, and docs can all be built in parallel.\n"
        "3. After each major milestone (package created, service wired, tests passing), "
        "run: git add -A && git commit -m 'checkpoint: <description>' "
        f"in {work_dir} to checkpoint progress.\n"
        "4. Save all research, decisions, and architecture notes to docs/ as .md files.\n"
        "5. Create or update CLAUDE.md in the project root with project conventions.\n"
        "6. Create or update README.md in the project root with:\n"
        "   - Project name and description\n"
        "   - Prerequisites (Node version, package manager, etc.)\n"
        "   - Installation steps (git clone, install deps)\n"
        "   - How to run in development mode\n"
        "   - How to build for production\n"
        "   - How to run tests\n"
        "   - Environment variables needed (.env setup)\n"
        "   - Project structure overview\n"
        "   - Deployment instructions\n"
        "   Keep it concise and actionable. Use code blocks for commands.\n\n"
        "FINAL CHECKPOINT (CRITICAL — do this ONCE when all work is done):\n"
        "When you have completed ALL implementation work, do these steps EXACTLY ONCE then STOP:\n"
        f"1. Run: cd {work_dir} && git add -A && git commit -m 'final: all deliverables complete'\n"
        "2. Write your final response as a DELIVERABLES SUMMARY in this exact markdown format:\n\n"
        "# Deliverables Complete\n\n"
        "- [x] Deliverable 1 description\n"
        "- [x] Deliverable 2 description\n"
        "- [x] ... (one line per major item)\n\n"
        "## How to Run\n"
        "```bash\n"
        "# step-by-step commands to install and run\n"
        "```\n\n"
        "## How to Test\n"
        "```bash\n"
        "# commands to run tests\n"
        "```\n\n"
        "DO NOT run any more completeness checks after this. DO NOT loop back to verify. "
        "DO NOT spawn more agents after the final commit. Just output the summary and STOP. "
        "If something is incomplete, note it as '- [ ] Item (not done: reason)' and still STOP.\n\n"
        "The original task was: " + original_prompt
    )

    push_event("process", {"status": "starting", "prompt": "Executing approved plan..."})
    push_event("agent_status", {"agent": "superx", "status": "running"})

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
        "CRITICAL: You MUST present the FULL updated plan in your response text. "
        "Do NOT just save it to a file and show a summary. "
        "Show the complete revised plan with all sections so the user can review it. "
        "DO NOT start implementing. "
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
    cwd = configured_project_path or os.getcwd()
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
        elif self.path == "/api/checkpoint":
            self.handle_checkpoint_get()
        elif self.path == "/api/history":
            self.handle_history()
        elif self.path.startswith("/api/history/"):
            self.handle_history_detail()
        elif self.path == "/api/github":
            self.send_json(200, {
                "url": configured_github_url,
                "path": configured_project_path,
            })
        elif self.path == "/api/project":
            self.send_json(200, {
                "path": configured_project_path,
                "url": configured_github_url,
            })
        elif self.path == "/api/project-structure":
            self.handle_project_structure()
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
        elif self.path == "/api/resume":
            self.handle_resume()
        elif self.path == "/api/project":
            self.handle_set_project()
        elif self.path.startswith("/api/history/") and self.path.endswith("/rename"):
            self.handle_history_rename()
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

        # Replay "awaiting approval" event if we're stuck in that state.
        # Without this, a client that (re)connects AFTER prompt_refined/plan_ready
        # already fired would never know to show the approval panel.
        try:
            is_running = claude_process is not None and claude_process.poll() is None
            if not is_running and current_phase in ("refining", "planning"):
                event_name = "prompt_refined" if current_phase == "refining" else "plan_ready"
                replay = json.dumps({"type": event_name, "data": {"status": "awaiting_approval"}})
                self.wfile.write(f"event: {event_name}\ndata: {replay}\n\n".encode())
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
        # If we're in refining/planning phase and the process is done, the UI
        # should show the approval panel. current_phase is the source of truth.
        awaiting_approval = (not running) and current_phase in ("refining", "planning")
        self.send_json(200, {
            "timeline": timeline_events[-MAX_TIMELINE_EVENTS:],
            "terminal": term,
            "running": running,
            "pending_plan": has_pending or awaiting_approval,
            "phase": current_phase,
        })

    def handle_checkpoint_get(self):
        """Return checkpoint data if resumable."""
        cp = load_checkpoint()
        if cp and cp.get("phase", "idle") != "idle":
            import datetime
            ts = cp.get("timestamp", 0)
            ago = datetime.datetime.now() - datetime.datetime.fromtimestamp(ts)
            mins = int(ago.total_seconds() / 60)
            self.send_json(200, {
                "resumable": True,
                "phase": cp["phase"],
                "prompt": cp.get("original_prompt", "")[:100],
                "minutes_ago": mins,
            })
        else:
            self.send_json(200, {"resumable": False})

    def handle_resume(self):
        """Resume from checkpoint."""
        cp = load_checkpoint()
        if not cp:
            self.send_json(400, {"error": "No checkpoint found"})
            return
        resume_from_checkpoint(cp)
        self.send_json(200, {"status": "resuming", "phase": cp.get("phase", "")})

    def handle_prompt(self):
        """Accept a prompt and start claude. Requires project directory to be set."""
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode()
        try:
            data = json.loads(body)
            prompt = data.get("prompt", "").strip()
            images = data.get("images", [])
            if not prompt:
                self.send_json(400, {"error": "Empty prompt"})
                return
            if not configured_project_path:
                self.send_json(400, {"error": "Set a project directory first (click GitHub icon)"})
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

    def handle_history_rename(self):
        """Rename a past session's task label."""
        try:
            parts = self.path.split("/")
            idx = int(parts[3])
        except (ValueError, IndexError):
            self.send_json(400, {"error": "Invalid index"})
            return
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode()
        body = json.loads(raw) if raw else {}
        new_name = body.get("name", "").strip()
        if not new_name:
            self.send_json(400, {"error": "Name required"})
            return
        if not HISTORY_FILE.exists():
            self.send_json(404, {"error": "No history"})
            return
        try:
            full = json.loads(HISTORY_FILE.read_text())
            if 0 <= idx < len(full):
                full[idx]["task"] = new_name
                HISTORY_FILE.write_text(json.dumps(full))
                self.send_json(200, {"status": "ok", "name": new_name})
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
        """Set GitHub remote, persist config, and commit+push using SSH."""
        global configured_project_path, configured_github_url
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode()
        try:
            data = json.loads(body)
            url = data.get("url", "").strip()
            local_path = data.get("path", "").strip()
            if not url:
                self.send_json(400, {"error": "No URL provided"})
                return

            # Resolve and persist project path
            cwd = os.path.expanduser(local_path) if local_path else configured_project_path or os.getcwd()
            if not os.path.isdir(cwd):
                self.send_json(400, {"error": f"Directory not found: {cwd}"})
                return

            # Persist config so Claude spawns in this directory
            configured_project_path = cwd
            configured_github_url = url
            _save_github_config()

            steps = []

            # Extract owner/repo from any URL format
            repo_slug = url.replace("https://github.com/", "").replace("http://github.com/", "")
            repo_slug = repo_slug.replace("github.com/", "").replace("git@github.com:", "")
            repo_slug = repo_slug.rstrip("/").rstrip(".git")

            ssh_url = f"git@github.com:{repo_slug}.git"

            # Init git if needed
            if not os.path.isdir(os.path.join(cwd, ".git")):
                subprocess.run(["git", "init"], capture_output=True, text=True, cwd=cwd)
                steps.append("git init")

            # Set remote — only change if different
            current_remote = subprocess.run(
                ["git", "remote", "get-url", "origin"],
                capture_output=True, text=True, cwd=cwd).stdout.strip()
            if current_remote != ssh_url:
                subprocess.run(["git", "remote", "remove", "origin"],
                               capture_output=True, text=True, cwd=cwd)
                subprocess.run(["git", "remote", "add", "origin", ssh_url],
                               capture_output=True, text=True, cwd=cwd)
                steps.append(f"remote: {repo_slug} (SSH)")
            else:
                steps.append(f"remote: {repo_slug} (unchanged)")

            # Detect branch
            branch = subprocess.run(["git", "branch", "--show-current"],
                capture_output=True, text=True, cwd=cwd).stdout.strip()
            if not branch:
                subprocess.run(["git", "rebase", "--abort"],
                               capture_output=True, text=True, cwd=cwd)
                subprocess.run(["git", "checkout", "main"],
                               capture_output=True, text=True, cwd=cwd)
                branch = "main"

            # Stage all, commit
            subprocess.run(["git", "add", "-A"], capture_output=True, text=True, cwd=cwd)
            r = subprocess.run(["git", "commit", "-m", "superx: commit via dashboard"],
                               capture_output=True, text=True, cwd=cwd)
            commit_msg = r.stdout.strip()[:80] or r.stderr.strip()[:80]
            steps.append(f"commit: {commit_msg}")

            # Pull rebase to sync, abort on conflict
            r = subprocess.run(["git", "pull", "--rebase", "origin", branch],
                               capture_output=True, text=True, cwd=cwd)
            if r.returncode == 0:
                steps.append("sync: ok")
            else:
                subprocess.run(["git", "rebase", "--abort"],
                               capture_output=True, text=True, cwd=cwd)
                steps.append("sync: skipped")

            # Always try to push — let the result tell us what happened
            r = subprocess.run(["git", "push", "-u", "origin", branch],
                               capture_output=True, text=True, cwd=cwd)

            output = (r.stdout + r.stderr).strip()
            if r.returncode == 0 or "Everything up-to-date" in output:
                pushed_something = "up-to-date" not in output.lower()
                steps.append("push: " + ("success" if pushed_something else "up-to-date"))
                self.send_json(200, {
                    "status": "pushed" if pushed_something else "nothing_to_push",
                    "steps": steps
                })
            else:
                steps.append(f"push: {r.stderr.strip()[:120]}")
                self.send_json(200, {"status": "push_failed", "steps": steps,
                                     "error": r.stderr.strip()[:200]})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def handle_project_structure(self):
        """Scan project directory and return top-level packages/apps as map items."""
        if not configured_project_path or not os.path.isdir(configured_project_path):
            self.send_json(200, {"items": []})
            return
        items = []
        root = configured_project_path
        # Look for common monorepo patterns: apps/*, packages/*, src/*
        for subdir in ["apps", "packages", "src", "services", "libs"]:
            container = os.path.join(root, subdir)
            if os.path.isdir(container):
                for name in sorted(os.listdir(container)):
                    full = os.path.join(container, name)
                    if os.path.isdir(full) and not name.startswith("."):
                        # Count files to estimate progress
                        file_count = sum(1 for _, _, files in os.walk(full)
                                        for f in files if not f.startswith("."))
                        has_src = os.path.isdir(os.path.join(full, "src"))
                        items.append({
                            "id": f"{subdir}/{name}",
                            "name": name,
                            "category": subdir,
                            "files": file_count,
                            "has_src": has_src,
                            "status": "complete" if file_count > 3 else
                                      "in_progress" if file_count > 0 else "pending",
                        })
        # Also check for root-level config files as a "config" building
        root_configs = [f for f in os.listdir(root)
                       if os.path.isfile(os.path.join(root, f))
                       and not f.startswith(".")]
        if root_configs:
            items.insert(0, {
                "id": "root/config",
                "name": "config",
                "category": "root",
                "files": len(root_configs),
                "has_src": False,
                "status": "complete" if len(root_configs) > 2 else "in_progress",
            })
        # docs directory
        docs = os.path.join(root, "docs")
        if os.path.isdir(docs):
            doc_count = sum(1 for _, _, files in os.walk(docs) for f in files)
            items.append({
                "id": "docs",
                "name": "docs",
                "category": "docs",
                "files": doc_count,
                "has_src": False,
                "status": "complete" if doc_count > 0 else "pending",
            })
        self.send_json(200, {"items": items})

    def handle_set_project(self):
        """Set the project working directory."""
        global configured_project_path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode()
        try:
            data = json.loads(body)
            path = os.path.expanduser(data.get("path", "").strip())
            if not path:
                self.send_json(400, {"error": "No path provided"})
                return
            if not os.path.isdir(path):
                self.send_json(400, {"error": f"Not a directory: {path}"})
                return
            configured_project_path = path
            _save_github_config()
            self.send_json(200, {"status": "ok", "path": path})
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
        # Clear session and checkpoint
        global current_phase
        current_phase = "idle"
        clear_checkpoint()
        timeline_events.clear()
        _recent_msg_keys.clear()
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
    _load_github_config()

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
