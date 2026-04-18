#!/usr/bin/env bash
# dispatch.sh — File-based async task queue for parallel agent coordination.
# Tasks are JSONL entries in .planning/dispatch/queue.jsonl
# Concurrency: directory-based locks (atomic mkdir)

DISPATCH_DIR=""

dispatch_init() {
  local proj="$1"
  DISPATCH_DIR="$proj/.planning/dispatch"
  mkdir -p "$DISPATCH_DIR"
  touch "$DISPATCH_DIR/queue.jsonl"
}

dispatch_add() {
  # Add a task to the queue
  local proj="$1" task_id="$2" wave="$3" agent="$4" description="$5"
  local dir="$proj/.planning/dispatch"
  local entry="{\"id\":\"$task_id\",\"wave\":$wave,\"agent\":\"$agent\",\"desc\":\"$description\",\"status\":\"pending\",\"ts\":$(date +%s)}"
  # Atomic append with lock
  _dispatch_lock "$dir"
  echo "$entry" >> "$dir/queue.jsonl"
  _dispatch_unlock "$dir"
}

dispatch_claim() {
  # Claim the next pending task for a given agent
  local proj="$1" agent="$2"
  local dir="$proj/.planning/dispatch"
  _dispatch_lock "$dir"
  # Find first pending task, mark as in-progress
  local line=$(grep '"status":"pending"' "$dir/queue.jsonl" | head -1)
  if [ -n "$line" ]; then
    local task_id=$(echo "$line" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    sed -i '' "s/\"id\":\"$task_id\",\(.*\)\"status\":\"pending\"/\"id\":\"$task_id\",\1\"status\":\"in-progress\",\"claimed_by\":\"$agent\"/" "$dir/queue.jsonl" 2>/dev/null || \
    sed -i "s/\"id\":\"$task_id\",\(.*\)\"status\":\"pending\"/\"id\":\"$task_id\",\1\"status\":\"in-progress\",\"claimed_by\":\"$agent\"/" "$dir/queue.jsonl"
    _dispatch_unlock "$dir"
    echo "$task_id"
  else
    _dispatch_unlock "$dir"
    echo ""
  fi
}

dispatch_complete() {
  # Mark a task as completed
  local proj="$1" task_id="$2"
  local dir="$proj/.planning/dispatch"
  _dispatch_lock "$dir"
  sed -i '' "s/\"id\":\"$task_id\",\(.*\)\"status\":\"in-progress\"/\"id\":\"$task_id\",\1\"status\":\"completed\"/" "$dir/queue.jsonl" 2>/dev/null || \
  sed -i "s/\"id\":\"$task_id\",\(.*\)\"status\":\"in-progress\"/\"id\":\"$task_id\",\1\"status\":\"completed\"/" "$dir/queue.jsonl"
  _dispatch_unlock "$dir"
}

dispatch_fail() {
  # Mark a task as failed
  local proj="$1" task_id="$2"
  local dir="$proj/.planning/dispatch"
  _dispatch_lock "$dir"
  sed -i '' "s/\"id\":\"$task_id\",\(.*\)\"status\":\"in-progress\"/\"id\":\"$task_id\",\1\"status\":\"failed\"/" "$dir/queue.jsonl" 2>/dev/null || \
  sed -i "s/\"id\":\"$task_id\",\(.*\)\"status\":\"in-progress\"/\"id\":\"$task_id\",\1\"status\":\"failed\"/" "$dir/queue.jsonl"
  _dispatch_unlock "$dir"
}

dispatch_status() {
  # Print queue status as JSON
  local proj="$1"
  local dir="$proj/.planning/dispatch"
  local pending=$(grep -c '"status":"pending"' "$dir/queue.jsonl" 2>/dev/null || echo 0)
  local running=$(grep -c '"status":"in-progress"' "$dir/queue.jsonl" 2>/dev/null || echo 0)
  local done=$(grep -c '"status":"completed"' "$dir/queue.jsonl" 2>/dev/null || echo 0)
  local failed=$(grep -c '"status":"failed"' "$dir/queue.jsonl" 2>/dev/null || echo 0)
  printf '{"pending":%s,"running":%s,"completed":%s,"failed":%s}\n' "$pending" "$running" "$done" "$failed"
}

_dispatch_lock() {
  local dir="$1"
  local i=0
  while [ $i -lt 10 ]; do
    mkdir "$dir/.lock" 2>/dev/null && return 0
    sleep 0.2
    i=$((i + 1))
  done
  return 1
}

_dispatch_unlock() {
  rm -rf "$1/.lock"
}

# CLI interface
if [ "${1:-}" = "init" ]; then dispatch_init "${2:-.}"
elif [ "${1:-}" = "add" ]; then dispatch_add "${2:-.}" "$3" "$4" "$5" "$6"
elif [ "${1:-}" = "claim" ]; then dispatch_claim "${2:-.}" "$3"
elif [ "${1:-}" = "complete" ]; then dispatch_complete "${2:-.}" "$3"
elif [ "${1:-}" = "fail" ]; then dispatch_fail "${2:-.}" "$3"
elif [ "${1:-}" = "status" ]; then dispatch_status "${2:-.}"
fi
