#!/usr/bin/env bash
# protocol.sh — shared helpers for the Token-Frugal Protocol v2 (spec H-4).
#
# Sourced by bin/heimdall-protocol and the focused protocol bins. Centralises:
#   - plugin/.planning path resolution (mirrors bin/falsify, bin/corpus)
#   - the protocol-dir layout (.planning/protocol/, symbols.json, blackboard.json,
#     capsules/, ledger.jsonl, protocol.log, message-schema.json)
#   - the human-readable audit log writer (.planning/protocol.log)
#   - JSON helpers used by the validator and the other bins
#
# Hard rule (spec H-4): every message is human-readable; full trail in
# .planning/protocol.log. No encryption, no opaque codes — auditability is the
# trust story. These helpers NEVER obscure content; they only reference it by id.
#
# Constraints (match the existing bin/ conventions):
#   - pure bash + jq + coreutils; macOS bash 3.2 compatible (NO associative arrays)
#   - jq is required; absence is a hard exit 2 in every entrypoint
#   - all paths absolute; deterministic output for auditability

set -euo pipefail

# ── Path resolution (mirrors bin/falsify / bin/corpus) ───────────────────────
proto_resolve_paths() {
  local self="${1:-$0}"
  if command -v readlink >/dev/null 2>&1; then
    self="$(readlink -f "$self" 2>/dev/null || readlink "$self" 2>/dev/null || echo "$self")"
  fi
  PROTO_BIN_DIR="$(cd "$(dirname "$self")" && pwd)"
  PROTO_PLUGIN_DIR="$(cd "$PROTO_BIN_DIR/.." && pwd)"
  # PLANNING_DIR is overridable for tests against a fixture planning tree.
  PLANNING_DIR="${HEIMDALL_PLANNING_DIR:-$PROTO_PLUGIN_DIR/.planning}"
  PROTO_DIR="$PLANNING_DIR/protocol"
  SYMBOLS_FILE="$PROTO_DIR/symbols.json"
  BLACKBOARD_FILE="$PLANNING_DIR/blackboard.json"
  CAPSULE_DIR="$PROTO_DIR/capsules"
  LEDGER_FILE="$PROTO_DIR/ledger.jsonl"
  PROTOCOL_LOG="$PLANNING_DIR/protocol.log"
  MESSAGE_SCHEMA="$PROTO_DIR/message-schema.json"
  export PROTO_BIN_DIR PROTO_PLUGIN_DIR PLANNING_DIR PROTO_DIR \
         SYMBOLS_FILE BLACKBOARD_FILE CAPSULE_DIR LEDGER_FILE \
         PROTOCOL_LOG MESSAGE_SCHEMA
}

proto_require_jq() {
  command -v jq >/dev/null 2>&1 || { echo "error: jq is required" >&2; exit 2; }
}

proto_ts() { date -u +%FT%TZ; }

# Ensure the protocol layout exists. Idempotent; safe to call from any entrypoint.
proto_ensure_dirs() {
  mkdir -p "$PROTO_DIR" "$CAPSULE_DIR"
  [ -f "$SYMBOLS_FILE" ]    || printf '{"version":"2.0.0","symbols":{}}\n' > "$SYMBOLS_FILE"
  [ -f "$BLACKBOARD_FILE" ] || printf '{"version":"2.0.0","facts":{}}\n'  > "$BLACKBOARD_FILE"
  [ -f "$LEDGER_FILE" ]     || : > "$LEDGER_FILE"
  [ -f "$PROTOCOL_LOG" ]    || : > "$PROTOCOL_LOG"
}

# ── Human-readable audit log (.planning/protocol.log) ────────────────────────
# Every protocol action appends one tab-separated, plain-text line. NEVER
# encoded — this IS the auditability story. Format:
#   <iso-ts>\t<actor>\t<action>\t<detail>
proto_log() {
  local actor="$1" action="$2" detail="${3:-}"
  proto_ensure_dirs
  printf '%s\t%s\t%s\t%s\n' "$(proto_ts)" "$actor" "$action" "$detail" >> "$PROTOCOL_LOG"
}

# ── JSON helpers ─────────────────────────────────────────────────────────────
# True iff $1 is parseable JSON.
proto_is_json() { printf '%s' "$1" | jq -e . >/dev/null 2>&1; }

# Canonical compact form (sorted keys) — deterministic byte output for diffs.
proto_canon() { jq -cS . ; }
