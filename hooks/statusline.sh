#!/usr/bin/env bash
# statusline.sh — superx HUD for Claude Code's status bar
# Outputs: [SUPERX] phase | agents | tokens | wave
# Called by Claude Code via settings.json statusline config

PROJECT="${1:-.}"
PLANNING="$PROJECT/.planning"

# Phase
PHASE="idle"
if [ -f "$PLANNING/STATE.md" ]; then
  PHASE=$(grep -m1 "^current_phase:" "$PLANNING/STATE.md" 2>/dev/null | sed 's/current_phase: *//' || echo "idle")
fi

# Wave progress
WAVE_INFO=""
for plan in "$PLANNING"/PLAN-*.md; do
  [ -f "$plan" ] || continue
  phase_num=$(basename "$plan" | grep -o '[0-9]*')
  total=$(grep -c "^### Task:" "$plan" 2>/dev/null || echo 0)
  done_count=0
  for summary in "$PLANNING"/SUMMARY-"$phase_num"-wave-*.md; do
    [ -f "$summary" ] || continue
    done_count=$((done_count + $(grep -c "| DONE |" "$summary" 2>/dev/null || echo 0)))
  done
  WAVE_INFO="$done_count/$total"
  break
done

# Dispatch queue
DISPATCH=""
if [ -f "$PLANNING/dispatch/queue.jsonl" ]; then
  pending=$(grep -c '"pending"' "$PLANNING/dispatch/queue.jsonl" 2>/dev/null || echo 0)
  running=$(grep -c '"in-progress"' "$PLANNING/dispatch/queue.jsonl" 2>/dev/null || echo 0)
  DISPATCH="${running}run/${pending}q"
fi

# Output compact line
printf "[SUPERX] %s" "$PHASE"
[ -n "$WAVE_INFO" ] && printf " | %s tasks" "$WAVE_INFO"
[ -n "$DISPATCH" ] && printf " | %s" "$DISPATCH"
printf "\n"
