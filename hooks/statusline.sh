#!/usr/bin/env bash
# statusline.sh — superx HUD for Claude Code's status bar
# Outputs a SINGLE line: [SUPERX] phase | tasks | dispatch | goal | token-bar | gates
# Called by Claude Code via settings.json statusline config.
# Hard rules: never error, never block the status bar, degrade gracefully if
# jq/python3 absent. All rendering is shell-side — zero model involvement.

PROJECT="${1:-.}"
PLANNING="$PROJECT/.planning"
STATE_JSON="$PROJECT/superx-state.json"

# ── Color detection (mirrors install.sh) ──
if [[ "${COLORTERM:-}" == "truecolor" || "${COLORTERM:-}" == "24bit" || "${TERM:-}" == *256color* ]]; then
  C='\033[38;2;0;212;255m'    # cyan
  G='\033[38;2;78;204;163m'   # green
  W='\033[38;2;255;200;80m'   # warm yellow
  RED='\033[38;2;255;95;110m' # red
  D='\033[38;2;100;100;120m'  # dim
elif [ -t 1 ] || [ -n "${TERM:-}" ]; then
  C='\033[36m'; G='\033[32m'; W='\033[33m'; RED='\033[31m'; D='\033[37m'
else
  C=''; G=''; W=''; RED=''; D=''
fi
B='\033[1m'; R='\033[0m'

# ── State reader: prefer python3, fall back to jq, else empty ──
# Emits whitespace-separated: tests lint dirty total limit goal
read_state() {
  [ -f "$STATE_JSON" ] || { echo "- - - - - -"; return; }
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$STATE_JSON" <<'PY' 2>/dev/null && return
import json, sys
try:
    s = json.load(open(sys.argv[1]))
except Exception:
    print("- - - - - -"); sys.exit(0)
g = s.get("quality_gates", {}) or {}
b = s.get("budget", {}) or {}
goal = (s.get("goal", {}) or {}).get("condition")
def b2s(v): return "1" if v is True else ("0" if v is False else "-")
tot = b.get("total_tokens")
lim = b.get("token_limit")
print(b2s(g.get("tests_passing")),
      b2s(g.get("lint_clean")),
      b2s(g.get("dirty")),
      tot if isinstance(tot, (int, float)) else "-",
      lim if isinstance(lim, (int, float)) else "-",
      goal if goal else "-")
PY
  fi
  if command -v jq >/dev/null 2>&1; then
    jq -r '
      def b2s: if . == true then "1" elif . == false then "0" else "-" end;
      [ (.quality_gates.tests_passing | b2s),
        (.quality_gates.lint_clean | b2s),
        (.quality_gates.dirty | b2s),
        (.budget.total_tokens // "-"),
        (.budget.token_limit // "-"),
        (.goal.condition // "-") ] | join(" ")
    ' "$STATE_JSON" 2>/dev/null && return
  fi
  echo "- - - - - -"
}

# ── Phase ──
PHASE="idle"
if [ -f "$PLANNING/STATE.md" ]; then
  PHASE=$(grep -m1 "^current_phase:" "$PLANNING/STATE.md" 2>/dev/null | sed 's/current_phase: *//' || echo "idle")
  [ -z "$PHASE" ] && PHASE="idle"
fi

# ── Wave progress ──
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

# ── Dispatch queue ──
DISPATCH=""
if [ -f "$PLANNING/dispatch/queue.jsonl" ]; then
  pending=$(grep -c '"pending"' "$PLANNING/dispatch/queue.jsonl" 2>/dev/null || echo 0)
  running=$(grep -c '"in-progress"' "$PLANNING/dispatch/queue.jsonl" 2>/dev/null || echo 0)
  DISPATCH="${running}run/${pending}q"
fi

# ── State fields ──
read -r ST_TESTS ST_LINT ST_DIRTY ST_TOTAL ST_LIMIT ST_GOAL <<<"$(read_state)"

# ── Token budget bar ──
# 5-cell unicode bar when a limit is set, else a raw count.
TOKEN_SEG=""
fmt_tokens() {
  local n="$1"
  awk -v n="$n" 'BEGIN{
    if (n >= 1000000) printf "%.1fM", n/1000000;
    else if (n >= 1000) printf "%.1fk", n/1000;
    else printf "%d", n;
  }'
}
if [ "$ST_TOTAL" != "-" ]; then
  if [ "$ST_LIMIT" != "-" ] && [ "$ST_LIMIT" != "0" ]; then
    pct=$(awk -v t="$ST_TOTAL" -v l="$ST_LIMIT" 'BEGIN{p=(t/l)*100; if(p>100)p=100; printf "%d", p}')
    filled=$(awk -v p="$pct" 'BEGIN{f=int((p+10)/20); if(f>5)f=5; if(f<0)f=0; printf "%d", f}')
    bar=""
    for i in 1 2 3 4 5; do
      if [ "$i" -le "$filled" ]; then bar="${bar}▰"; else bar="${bar}▱"; fi
    done
    # Color by pressure: green <60, yellow <85, red otherwise.
    bar_color="$G"
    [ "$pct" -ge 60 ] && bar_color="$W"
    [ "$pct" -ge 85 ] && bar_color="$RED"
    TOKEN_SEG=$(printf "%b%s%b %s%%" "$bar_color" "$bar" "$R" "$pct")
  else
    TOKEN_SEG=$(printf "%b%s tok%b" "$C" "$(fmt_tokens "$ST_TOTAL")" "$R")
  fi
fi

# ── Gate glyphs ──
GATE_SEG=""
gate_glyph() { # value, label → "label✓" green / "label✗" red / "label·" dim
  case "$1" in
    1) printf "%b%s✓%b" "$G" "$2" "$R" ;;
    0) printf "%b%s✗%b" "$RED" "$2" "$R" ;;
    *) printf "%b%s·%b" "$D" "$2" "$R" ;;
  esac
}
if [ "$ST_TESTS" != "-" ] || [ "$ST_LINT" != "-" ] || [ "$ST_DIRTY" != "-" ]; then
  t_seg=$(gate_glyph "$ST_TESTS" "t")
  l_seg=$(gate_glyph "$ST_LINT" "l")
  # dirty: ● when dirty(1), ○ when clean(0), · unknown
  case "$ST_DIRTY" in
    1) d_seg=$(printf "%b●%b" "$W" "$R") ;;
    0) d_seg=$(printf "%b○%b" "$G" "$R") ;;
    *) d_seg=$(printf "%b·%b" "$D" "$R") ;;
  esac
  GATE_SEG="${t_seg} ${l_seg} ${d_seg}"
fi

# ── Goal indicator ──
GOAL_SEG=""
[ "$ST_GOAL" != "-" ] && GOAL_SEG="◎"

# ── Emit single line ──
printf "%b[SUPERX]%b %b%s%b" "$B$C" "$R" "$B" "$PHASE" "$R"
[ -n "$WAVE_INFO" ] && printf " %b|%b %s tasks" "$D" "$R" "$WAVE_INFO"
[ -n "$DISPATCH" ] && printf " %b|%b %s" "$D" "$R" "$DISPATCH"
[ -n "$GOAL_SEG" ] && printf " %b|%b %s" "$D" "$R" "$GOAL_SEG"
[ -n "$TOKEN_SEG" ] && printf " %b|%b %s" "$D" "$R" "$TOKEN_SEG"
[ -n "$GATE_SEG" ] && printf " %b|%b %s" "$D" "$R" "$GATE_SEG"
printf "\n"
