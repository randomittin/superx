#!/usr/bin/env bash
# planning.sh — File-based planning state management for superx
#
# Manages a .planning/ directory inside any project directory.
# Provides functions to init, read, update, lock, and query planning state.
#
# Files managed:
#   PROJECT.md       — Vision, constraints, tech stack
#   REQUIREMENTS.md  — Scoped features (v1, v2, out-of-scope)
#   STATE.md         — Living memory: phase, decisions, blockers, metrics
#   CONTEXT.md       — Per-phase user preferences
#   PLAN-{phase}.md  — Task specs with structured task blocks
#   SUMMARY-{phase}.md — Execution results with commit hashes
#
# Usage:
#   source bin/lib/planning.sh
#   planning_init /path/to/project
#   planning_state_read /path/to/project
#   planning_state_update /path/to/project phase "implementation"
#   planning_lock /path/to/project
#   planning_unlock /path/to/project
#   planning_phase_status /path/to/project alpha
#
# Constraints:
#   - Pure bash + sed/awk/grep/date. No Python, no Node, no jq.
#   - Locking via mkdir (atomic on all filesystems).
#   - STATE.md YAML frontmatter is rebuilt from body on every write.
#   - All paths are absolute.

set -euo pipefail

# ── Internal helpers ─────────────────────────────────────────────────

_planning_dir() {
  local project_dir="$1"
  echo "${project_dir}/.planning"
}

_state_file() {
  local project_dir="$1"
  echo "${project_dir}/.planning/STATE.md"
}

_lock_path() {
  local project_dir="$1"
  echo "${project_dir}/.planning/STATE.md.lock"
}

_timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

_date_stamp() {
  date -u +"%Y-%m-%d"
}

# Get the age of a file/directory in seconds.
# Handles both macOS (stat -f) and Linux (stat -c).
_file_age_seconds() {
  local path="$1"
  local mtime now
  now=$(date +%s)
  mtime=$(stat -f %m "$path" 2>/dev/null || stat -c %Y "$path" 2>/dev/null || echo "$now")
  echo $(( now - mtime ))
}

# Extract a field value from STATE.md body content.
# Looks for lines like "**Phase:** value" or "- **Phase:** value"
# Returns the value portion, trimmed.
_state_body_field() {
  local state_file="$1"
  local field_name="$2"
  if [ ! -f "$state_file" ]; then
    echo ""
    return
  fi
  # Match "**Field:** value" or "- **Field:** value", case-insensitive on field name
  sed -n "s/^[[:space:]]*[-*]*[[:space:]]*\*\*${field_name}:\*\*[[:space:]]*//Ip" "$state_file" | head -1 | sed 's/[[:space:]]*$//'
}

# Count lines matching a pattern in a section of STATE.md
_state_count_items() {
  local state_file="$1"
  local section_heading="$2"
  local pattern="${3:-.}"
  if [ ! -f "$state_file" ]; then
    echo "0"
    return
  fi
  # Extract lines between the section heading and the next ## heading, count matching lines
  awk -v heading="$section_heading" -v pat="$pattern" '
    BEGIN { in_section = 0; count = 0 }
    /^## / {
      if (in_section) exit
      if (index($0, heading) > 0) in_section = 1
      next
    }
    in_section && /^[[:space:]]*-/ && match($0, pat) { count++ }
    END { print count }
  ' "$state_file"
}

# Count completed tasks: lines containing [x] in a section
_state_count_done() {
  local state_file="$1"
  local section_heading="$2"
  if [ ! -f "$state_file" ]; then
    echo "0"
    return
  fi
  awk -v heading="$section_heading" '
    BEGIN { in_section = 0; count = 0 }
    /^## / {
      if (in_section) exit
      if (index($0, heading) > 0) in_section = 1
      next
    }
    in_section && /\[x\]/ { count++ }
    END { print count }
  ' "$state_file"
}

# Rebuild YAML frontmatter from body content and write back to STATE.md.
# This is the source-of-truth guarantee: frontmatter is always derived, never edited directly.
_rebuild_frontmatter() {
  local state_file="$1"
  if [ ! -f "$state_file" ]; then
    return 1
  fi

  # Extract values from body
  local phase current_task updated_at
  phase=$(_state_body_field "$state_file" "Phase")
  current_task=$(_state_body_field "$state_file" "Current task")
  updated_at=$(_timestamp)

  # Count decisions and blockers from their sections
  local decisions_count blockers_count
  decisions_count=$(_state_count_items "$state_file" "Decisions")
  blockers_count=$(_state_count_items "$state_file" "Blockers")

  # Default phase if empty
  if [ -z "$phase" ]; then
    phase="init"
  fi

  # Extract body: everything after the closing --- of frontmatter, or the whole file if no frontmatter
  local body
  if head -1 "$state_file" | grep -q '^---$'; then
    # Has frontmatter — extract body after second ---
    body=$(awk 'BEGIN{c=0} /^---$/{c++; if(c==2){found=1; next}} found{print}' "$state_file")
  else
    # No frontmatter — whole file is body
    body=$(cat "$state_file")
  fi

  # Write new file: frontmatter + body
  local tmp
  tmp=$(mktemp)
  cat > "$tmp" <<FRONTMATTER
---
phase: "${phase}"
current_task: "${current_task}"
decisions_count: ${decisions_count}
blockers_count: ${blockers_count}
updated_at: "${updated_at}"
---
FRONTMATTER
  echo "$body" >> "$tmp"
  mv "$tmp" "$state_file"
}


# ── Public API ───────────────────────────────────────────────────────

# planning_init <project_dir>
#   Create .planning/ directory with an initial PROJECT.md and STATE.md.
#   Idempotent: skips files that already exist.
planning_init() {
  local project_dir="${1:?planning_init requires project_dir}"
  local planning_dir
  planning_dir=$(_planning_dir "$project_dir")

  mkdir -p "$planning_dir"

  # PROJECT.md — vision and constraints template
  if [ ! -f "${planning_dir}/PROJECT.md" ]; then
    cat > "${planning_dir}/PROJECT.md" <<'TEMPLATE'
# Project

## Vision

<!-- One sentence: what does this project do and for whom? -->

## Constraints

<!-- Non-negotiable boundaries: budget, timeline, compliance, etc. -->

## Tech Stack

<!-- Languages, frameworks, infrastructure decisions -->

## Repository

<!-- Repo URL, branch strategy, CI/CD notes -->
TEMPLATE
    echo "Created ${planning_dir}/PROJECT.md" >&2
  fi

  # REQUIREMENTS.md — scoped features template
  if [ ! -f "${planning_dir}/REQUIREMENTS.md" ]; then
    cat > "${planning_dir}/REQUIREMENTS.md" <<'TEMPLATE'
# Requirements

## v1 — Must Have

<!-- Features required for first usable release -->

## v2 — Next

<!-- Features planned for the following iteration -->

## Out of Scope

<!-- Explicitly excluded to prevent scope creep -->
TEMPLATE
    echo "Created ${planning_dir}/REQUIREMENTS.md" >&2
  fi

  # STATE.md — living memory
  if [ ! -f "${planning_dir}/STATE.md" ]; then
    local ts
    ts=$(_timestamp)
    cat > "${planning_dir}/STATE.md" <<STATE_TEMPLATE
---
phase: "init"
current_task: ""
decisions_count: 0
blockers_count: 0
updated_at: "${ts}"
---

# Planning State

## Status

- **Phase:** init
- **Current task:**
- **Started:** ${ts}

## Decisions

<!-- Log of key decisions with rationale -->

## Blockers

<!-- Active blockers preventing progress -->

## Metrics

- **Tasks planned:** 0
- **Tasks completed:** 0
- **Phases completed:** 0
STATE_TEMPLATE
    echo "Created ${planning_dir}/STATE.md" >&2
  fi

  # CONTEXT.md — per-phase user preferences
  if [ ! -f "${planning_dir}/CONTEXT.md" ]; then
    cat > "${planning_dir}/CONTEXT.md" <<'TEMPLATE'
# Context

<!-- User preferences and constraints captured before each planning phase -->

## Preferences

## Notes
TEMPLATE
    echo "Created ${planning_dir}/CONTEXT.md" >&2
  fi

  echo "Planning initialized at ${planning_dir}" >&2
}


# planning_state_read <project_dir>
#   Read STATE.md and output current phase + progress as JSON.
#   Output: {"phase":"...","current_task":"...","decisions":N,"blockers":N,"updated_at":"..."}
planning_state_read() {
  local project_dir="${1:?planning_state_read requires project_dir}"
  local state_file
  state_file=$(_state_file "$project_dir")

  if [ ! -f "$state_file" ]; then
    echo '{"error":"STATE.md not found. Run planning_init first."}' >&2
    return 1
  fi

  # Read from frontmatter (which is always in sync with body)
  local phase current_task decisions_count blockers_count updated_at

  phase=$(awk '/^---$/{c++; next} c==1 && /^phase:/{gsub(/^phase:[[:space:]]*"?/,""); gsub(/"$/,""); print; exit}' "$state_file")
  current_task=$(awk '/^---$/{c++; next} c==1 && /^current_task:/{gsub(/^current_task:[[:space:]]*"?/,""); gsub(/"$/,""); print; exit}' "$state_file")
  decisions_count=$(awk '/^---$/{c++; next} c==1 && /^decisions_count:/{gsub(/^decisions_count:[[:space:]]*/,""); print; exit}' "$state_file")
  blockers_count=$(awk '/^---$/{c++; next} c==1 && /^blockers_count:/{gsub(/^blockers_count:[[:space:]]*/,""); print; exit}' "$state_file")
  updated_at=$(awk '/^---$/{c++; next} c==1 && /^updated_at:/{gsub(/^updated_at:[[:space:]]*"?/,""); gsub(/"$/,""); print; exit}' "$state_file")

  # Also pull metrics from body
  local tasks_planned tasks_completed phases_completed
  tasks_planned=$(_state_body_field "$state_file" "Tasks planned")
  tasks_completed=$(_state_body_field "$state_file" "Tasks completed")
  phases_completed=$(_state_body_field "$state_file" "Phases completed")

  # Escape any double quotes in string values for valid JSON
  current_task=$(echo "$current_task" | sed 's/"/\\"/g')

  # Output JSON (hand-built to avoid jq dependency)
  cat <<JSON
{
  "phase": "${phase:-init}",
  "current_task": "${current_task}",
  "decisions": ${decisions_count:-0},
  "blockers": ${blockers_count:-0},
  "tasks_planned": ${tasks_planned:-0},
  "tasks_completed": ${tasks_completed:-0},
  "phases_completed": ${phases_completed:-0},
  "updated_at": "${updated_at}"
}
JSON
}


# planning_state_update <project_dir> <key> <value>
#   Update a field in STATE.md body content, then rebuild frontmatter.
#   Supported keys: phase, current_task, decision, blocker, tasks_planned,
#                   tasks_completed, phases_completed
planning_state_update() {
  local project_dir="${1:?planning_state_update requires project_dir}"
  local key="${2:?planning_state_update requires key}"
  local value="${3:?planning_state_update requires value}"
  local state_file
  state_file=$(_state_file "$project_dir")

  if [ ! -f "$state_file" ]; then
    echo "Error: STATE.md not found. Run planning_init first." >&2
    return 1
  fi

  local tmp
  tmp=$(mktemp)

  case "$key" in
    phase)
      # Replace "**Phase:** ..." line in body
      sed "s/^\([[:space:]]*[-*]*[[:space:]]*\)\*\*Phase:\*\*.*/\1**Phase:** ${value}/" "$state_file" > "$tmp"
      mv "$tmp" "$state_file"
      ;;
    current_task)
      sed "s/^\([[:space:]]*[-*]*[[:space:]]*\)\*\*Current task:\*\*.*/\1**Current task:** ${value}/" "$state_file" > "$tmp"
      mv "$tmp" "$state_file"
      ;;
    tasks_planned)
      sed "s/^\([[:space:]]*[-*]*[[:space:]]*\)\*\*Tasks planned:\*\*.*/\1**Tasks planned:** ${value}/" "$state_file" > "$tmp"
      mv "$tmp" "$state_file"
      ;;
    tasks_completed)
      sed "s/^\([[:space:]]*[-*]*[[:space:]]*\)\*\*Tasks completed:\*\*.*/\1**Tasks completed:** ${value}/" "$state_file" > "$tmp"
      mv "$tmp" "$state_file"
      ;;
    phases_completed)
      sed "s/^\([[:space:]]*[-*]*[[:space:]]*\)\*\*Phases completed:\*\*.*/\1**Phases completed:** ${value}/" "$state_file" > "$tmp"
      mv "$tmp" "$state_file"
      ;;
    decision)
      # Append a decision entry to the Decisions section
      local ts
      ts=$(_date_stamp)
      awk -v entry="- [${ts}] ${value}" -v found=0 '
        /^## Decisions/ { print; found=1; next }
        found && /^$/ && !inserted { print entry; inserted=1 }
        found && /^## / && !inserted { print entry; print ""; inserted=1 }
        { print }
        END { if (found && !inserted) print entry }
      ' "$state_file" > "$tmp"
      mv "$tmp" "$state_file"
      ;;
    blocker)
      # Append a blocker entry to the Blockers section
      local ts
      ts=$(_date_stamp)
      awk -v entry="- [${ts}] ${value}" -v found=0 '
        /^## Blockers/ { print; found=1; next }
        found && /^$/ && !inserted { print entry; inserted=1 }
        found && /^## / && !inserted { print entry; print ""; inserted=1 }
        { print }
        END { if (found && !inserted) print entry }
      ' "$state_file" > "$tmp"
      mv "$tmp" "$state_file"
      ;;
    *)
      echo "Error: Unknown key '${key}'. Supported: phase, current_task, decision, blocker, tasks_planned, tasks_completed, phases_completed" >&2
      rm -f "$tmp"
      return 1
      ;;
  esac

  # Rebuild frontmatter from body content (source-of-truth guarantee)
  _rebuild_frontmatter "$state_file"
}


# planning_lock <project_dir>
#   Acquire .planning/STATE.md.lock using atomic mkdir.
#   Retries 10 times with ~200ms sleep. Breaks stale locks older than 10 seconds.
#   Returns 0 on success, 1 on failure.
planning_lock() {
  local project_dir="${1:?planning_lock requires project_dir}"
  local lock_path
  lock_path=$(_lock_path "$project_dir")
  local max_attempts=10
  local attempt=0

  while [ "$attempt" -lt "$max_attempts" ]; do
    if mkdir "$lock_path" 2>/dev/null; then
      # Store our PID for ownership tracking
      echo $$ > "${lock_path}/pid"
      return 0
    fi

    attempt=$((attempt + 1))

    # Stale lock detection: break locks older than 10 seconds
    if [ -d "$lock_path" ]; then
      local age
      age=$(_file_age_seconds "$lock_path")
      if [ "$age" -gt 10 ]; then
        echo "Breaking stale planning lock (${age}s old)" >&2
        rm -rf "$lock_path"
        if mkdir "$lock_path" 2>/dev/null; then
          echo $$ > "${lock_path}/pid"
          return 0
        fi
      fi
    fi

    # Sleep ~200ms (bash doesn't do fractional sleep on all systems)
    # Use perl as a portable fractional-sleep fallback
    if command -v perl >/dev/null 2>&1; then
      perl -e 'select(undef,undef,undef,0.2)'
    else
      sleep 1
    fi
  done

  echo "Error: Could not acquire planning lock after ${max_attempts} attempts" >&2
  return 1
}


# planning_unlock <project_dir>
#   Release the lock acquired by planning_lock.
planning_unlock() {
  local project_dir="${1:?planning_unlock requires project_dir}"
  local lock_path
  lock_path=$(_lock_path "$project_dir")

  if [ -d "$lock_path" ]; then
    rm -rf "$lock_path"
  fi
}


# planning_phase_status <project_dir> <phase>
#   Check what artifacts exist for a given phase.
#   Output: JSON with boolean fields for each artifact type.
planning_phase_status() {
  local project_dir="${1:?planning_phase_status requires project_dir}"
  local phase="${2:?planning_phase_status requires phase}"
  local planning_dir
  planning_dir=$(_planning_dir "$project_dir")

  local has_project="false"
  local has_requirements="false"
  local has_state="false"
  local has_context="false"
  local has_plan="false"
  local has_summary="false"

  [ -f "${planning_dir}/PROJECT.md" ] && has_project="true"
  [ -f "${planning_dir}/REQUIREMENTS.md" ] && has_requirements="true"
  [ -f "${planning_dir}/STATE.md" ] && has_state="true"
  [ -f "${planning_dir}/CONTEXT.md" ] && has_context="true"
  [ -f "${planning_dir}/PLAN-${phase}.md" ] && has_plan="true"
  [ -f "${planning_dir}/SUMMARY-${phase}.md" ] && has_summary="true"

  # Determine overall readiness
  local ready="false"
  if [ "$has_project" = "true" ] && [ "$has_requirements" = "true" ] && [ "$has_plan" = "true" ]; then
    ready="true"
  fi

  local complete="false"
  if [ "$has_summary" = "true" ]; then
    complete="true"
  fi

  cat <<JSON
{
  "phase": "${phase}",
  "has_project": ${has_project},
  "has_requirements": ${has_requirements},
  "has_state": ${has_state},
  "has_context": ${has_context},
  "has_plan": ${has_plan},
  "has_summary": ${has_summary},
  "ready": ${ready},
  "complete": ${complete}
}
JSON
}


# ── Plan file helpers ────────────────────────────────────────────────

# planning_create_plan <project_dir> <phase>
#   Create a PLAN-{phase}.md with a template for structured task blocks.
planning_create_plan() {
  local project_dir="${1:?planning_create_plan requires project_dir}"
  local phase="${2:?planning_create_plan requires phase}"
  local planning_dir
  planning_dir=$(_planning_dir "$project_dir")
  local plan_file="${planning_dir}/PLAN-${phase}.md"

  if [ -f "$plan_file" ]; then
    echo "PLAN-${phase}.md already exists. Skipping." >&2
    return 0
  fi

  local ts
  ts=$(_timestamp)
  cat > "$plan_file" <<TEMPLATE
# Plan: ${phase}

Created: ${ts}

## Tasks

<!-- Each task uses structured XML-like blocks for machine-readability.
     Add tasks below using this format:

<task id="1">
  <name>Task title</name>
  <wave>1</wave>
  <dependencies></dependencies>
  <read_first>files to read before starting</read_first>
  <action>what to do</action>
  <acceptance_criteria>how to know it's done</acceptance_criteria>
  <verify>command or check to run</verify>
  <done>false</done>
</task>

-->
TEMPLATE
  echo "Created ${plan_file}" >&2
}


# planning_create_summary <project_dir> <phase>
#   Create a SUMMARY-{phase}.md template for execution results.
planning_create_summary() {
  local project_dir="${1:?planning_create_summary requires project_dir}"
  local phase="${2:?planning_create_summary requires phase}"
  local planning_dir
  planning_dir=$(_planning_dir "$project_dir")
  local summary_file="${planning_dir}/SUMMARY-${phase}.md"

  local ts
  ts=$(_timestamp)
  cat > "$summary_file" <<TEMPLATE
# Summary: ${phase}

Completed: ${ts}

## Results

<!-- Task outcomes, one per task -->

## Commits

<!-- Relevant commit hashes with descriptions -->

## Notes

<!-- Anything worth carrying forward to the next phase -->
TEMPLATE
  echo "Created ${summary_file}" >&2
}


# planning_list_phases <project_dir>
#   List all phases that have PLAN or SUMMARY files.
#   Output: one phase name per line.
planning_list_phases() {
  local project_dir="${1:?planning_list_phases requires project_dir}"
  local planning_dir
  planning_dir=$(_planning_dir "$project_dir")

  if [ ! -d "$planning_dir" ]; then
    return 0
  fi

  # Extract phase names from PLAN-*.md and SUMMARY-*.md filenames
  local phases=""
  for f in "${planning_dir}"/PLAN-*.md "${planning_dir}"/SUMMARY-*.md; do
    if [ -f "$f" ]; then
      local basename
      basename=$(basename "$f")
      # Strip PLAN- or SUMMARY- prefix and .md suffix
      local phase_name
      phase_name=$(echo "$basename" | sed 's/^PLAN-//; s/^SUMMARY-//; s/\.md$//')
      phases="${phases}${phase_name}"$'\n'
    fi
  done

  # Deduplicate and sort
  echo "$phases" | sort -u | grep -v '^$'
}


# planning_task_count <project_dir> <phase>
#   Count total and completed tasks in a PLAN file.
#   Output: JSON {"total":N,"done":N,"remaining":N}
planning_task_count() {
  local project_dir="${1:?planning_task_count requires project_dir}"
  local phase="${2:?planning_task_count requires phase}"
  local planning_dir
  planning_dir=$(_planning_dir "$project_dir")
  local plan_file="${planning_dir}/PLAN-${phase}.md"

  if [ ! -f "$plan_file" ]; then
    echo '{"total":0,"done":0,"remaining":0}'
    return 0
  fi

  local total done_count remaining
  total=$(grep -c '<task ' "$plan_file" 2>/dev/null || true)
  done_count=$(grep -c '<done>true</done>' "$plan_file" 2>/dev/null || true)
  : "${total:=0}"
  : "${done_count:=0}"
  remaining=$((total - done_count))

  cat <<JSON
{"total":${total},"done":${done_count},"remaining":${remaining}}
JSON
}


# planning_mark_task_done <project_dir> <phase> <task_id>
#   Mark a task as done in the PLAN file by setting <done>true</done>.
planning_mark_task_done() {
  local project_dir="${1:?planning_mark_task_done requires project_dir}"
  local phase="${2:?planning_mark_task_done requires phase}"
  local task_id="${3:?planning_mark_task_done requires task_id}"
  local planning_dir
  planning_dir=$(_planning_dir "$project_dir")
  local plan_file="${planning_dir}/PLAN-${phase}.md"

  if [ ! -f "$plan_file" ]; then
    echo "Error: PLAN-${phase}.md not found." >&2
    return 1
  fi

  local tmp
  tmp=$(mktemp)
  # Find the task block with the matching id, then flip its <done> to true
  awk -v tid="$task_id" '
    /<task / && index($0, "id=\"" tid "\"") > 0 { in_task = 1 }
    in_task && /<done>/ { gsub(/<done>false<\/done>/, "<done>true</done>") }
    /<\/task>/ { in_task = 0 }
    { print }
  ' "$plan_file" > "$tmp"
  mv "$tmp" "$plan_file"
}


# ── CLI dispatch (when run as a script, not sourced) ─────────────────

if [[ "${BASH_SOURCE[0]:-}" == "${0}" ]]; then
  case "${1:-}" in
    init)
      planning_init "${2:?project_dir required}"
      ;;
    read)
      planning_state_read "${2:?project_dir required}"
      ;;
    update)
      planning_state_update "${2:?project_dir required}" "${3:?key required}" "${4:?value required}"
      ;;
    lock)
      planning_lock "${2:?project_dir required}"
      ;;
    unlock)
      planning_unlock "${2:?project_dir required}"
      ;;
    phase-status)
      planning_phase_status "${2:?project_dir required}" "${3:?phase required}"
      ;;
    create-plan)
      planning_create_plan "${2:?project_dir required}" "${3:?phase required}"
      ;;
    create-summary)
      planning_create_summary "${2:?project_dir required}" "${3:?phase required}"
      ;;
    list-phases)
      planning_list_phases "${2:?project_dir required}"
      ;;
    task-count)
      planning_task_count "${2:?project_dir required}" "${3:?phase required}"
      ;;
    mark-done)
      planning_mark_task_done "${2:?project_dir required}" "${3:?phase required}" "${4:?task_id required}"
      ;;
    help|--help|-h|"")
      cat <<'USAGE'
planning.sh — File-based planning state management

Usage (as script):
  planning.sh init <project_dir>
  planning.sh read <project_dir>
  planning.sh update <project_dir> <key> <value>
  planning.sh lock <project_dir>
  planning.sh unlock <project_dir>
  planning.sh phase-status <project_dir> <phase>
  planning.sh create-plan <project_dir> <phase>
  planning.sh create-summary <project_dir> <phase>
  planning.sh list-phases <project_dir>
  planning.sh task-count <project_dir> <phase>
  planning.sh mark-done <project_dir> <phase> <task_id>

Usage (sourced):
  source planning.sh
  planning_init /path/to/project
  planning_state_read /path/to/project
  # ... etc
USAGE
      ;;
    *)
      echo "Unknown command: ${1}" >&2
      echo "Run 'planning.sh help' for usage." >&2
      exit 1
      ;;
  esac
fi
