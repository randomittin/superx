#!/usr/bin/env bash
# brief.sh — minimal-context brief hydration for Heimdall spawns (spec H-3/H-4).
#
# The minimal-context rule (spec H-3): a spawn receives a BRIEF, never a full
# plan or prior conversation. A brief is:
#
#   { task spec, symbol-table ref, referenced capsule IDs, invariants ref }
#
# This library hydrates a spawn's context from its spawn json's `context` block
# WITHOUT ever pulling in a full plan. It references capsules by id/path and
# DEGRADES GRACEFULLY: if H-4's `capsules/` dir is not present yet, capsule
# hydration is skipped (the inline brief is used as-is) — never faked, never a
# fabricated capsule body.
#
# The `context` block of a spawn json (see .planning/spawns/SCHEMA.md) is a
# free-form object; the keys this hydrator understands:
#   context.capsules     : array of capsule ids (resolved to capsules/<id>.md)
#   context.invariants   : path to an INVARIANTS file (e.g. "INVARIANTS.md")
#   context.symbols      : path to a symbol table (e.g. "symbols.json")
#   context.criteria     : array of acceptance-criteria ids (kept as ids; the
#                          resolver is H-4's `heimdall resolve`, not ours)
#   context.diff_ref     : a git ref/range the spawn grades (e.g. "HEAD~1..HEAD")
#
# Functions print to stdout a compact, human-readable brief. They NEVER read a
# plan file; if a referenced artifact is absent they emit a one-line
# "(unavailable: <reason>)" marker and continue — honest degradation.

# Resolve the repo root that owns capsules/ etc. Caller passes it explicitly so
# this lib stays cwd-independent (agent threads reset cwd between bash calls).

# Hydrate the brief for a spawn json. Args:
#   <spawn-json-path> <repo-root>
# Prints the assembled brief; returns 0 always (missing refs degrade, not fail).
brief_hydrate() {
  local spawn_json="$1" root="$2"
  command -v jq >/dev/null 2>&1 || { echo "error: jq is required for brief hydration" >&2; return 2; }
  [ -f "$spawn_json" ] || { echo "error: spawn json not found: $spawn_json" >&2; return 2; }

  local kind trigger
  kind="$(jq -r '.kind // "unknown"' "$spawn_json")"
  trigger="$(jq -r '.trigger // "unknown"' "$spawn_json")"

  echo "── BRIEF (minimal-context; capsule refs only, never a full plan) ──"
  echo "kind:    $kind"
  echo "trigger: $trigger"

  # diff ref the spawn grades
  local diff_ref
  diff_ref="$(jq -r '.context.diff_ref // empty' "$spawn_json")"
  [ -n "$diff_ref" ] && echo "diff_ref: $diff_ref"

  # acceptance-criteria ids — kept AS IDS (H-4's resolver expands them; we don't
  # restate the criteria text, that would defeat compression-by-reference)
  local criteria
  criteria="$(jq -r '(.context.criteria // []) | join(", ")' "$spawn_json")"
  [ -n "$criteria" ] && echo "criteria (ids): $criteria"

  # symbol table ref
  local symbols
  symbols="$(jq -r '.context.symbols // empty' "$spawn_json")"
  if [ -n "$symbols" ]; then
    if [ -f "$root/$symbols" ]; then
      echo "symbols: $symbols (present)"
    else
      echo "symbols: $symbols (unavailable: H-4 symbol table not present yet — skipped)"
    fi
  fi

  # invariants ref
  local invariants
  invariants="$(jq -r '.context.invariants // empty' "$spawn_json")"
  if [ -n "$invariants" ]; then
    if [ -f "$root/$invariants" ]; then
      echo "invariants: $invariants (present)"
    else
      echo "invariants: $invariants (unavailable: file not present — skipped)"
    fi
  fi

  # capsule refs — the H-4 mechanism. Degrade gracefully if capsules/ absent.
  local capsule_ids
  capsule_ids="$(jq -r '(.context.capsules // []) | .[]' "$spawn_json")"
  if [ -n "$capsule_ids" ]; then
    echo "capsule refs:"
    if [ ! -d "$root/capsules" ]; then
      # H-4 not landed yet: reference the ids, skip hydration. NEVER fabricate.
      while IFS= read -r cid; do
        [ -n "$cid" ] || continue
        echo "  - $cid (unavailable: capsules/ dir not present yet — H-4 pending, hydration skipped)"
      done <<<"$capsule_ids"
    else
      while IFS= read -r cid; do
        [ -n "$cid" ] || continue
        local cpath="$root/capsules/$cid.md"
        if [ -f "$cpath" ]; then
          # Capsules are <=10 lines; include the body inline (it IS the minimal
          # context). Reference by id so the trail stays auditable.
          echo "  - $cid (capsules/$cid.md):"
          sed 's/^/      /' "$cpath"
        else
          echo "  - $cid (unavailable: capsules/$cid.md not found — skipped)"
        fi
      done <<<"$capsule_ids"
    fi
  fi
  echo "── END BRIEF ──"
}

# Assert a brief does NOT smuggle a full plan. The contract forbids embedding a
# whole plan in context; this guard fails if context references a plan file
# directly (PLAN-*.md / *plan*.md) instead of capsule ids. Returns 0 if clean,
# 1 if a plan ref is found. Used by tests and by heimdall-spawn before running.
brief_assert_no_plan() {
  local spawn_json="$1"
  command -v jq >/dev/null 2>&1 || return 2
  # Scan every string value anywhere in context for a plan-file pattern.
  if jq -e '
      [.context | .. | strings]
      | any(test("(?i)(^|/)PLAN-.*\\.md$|(?i)(^|/)plan\\.md$|(?i)full[_-]?plan"))
    ' "$spawn_json" >/dev/null 2>&1; then
    return 1
  fi
  return 0
}
