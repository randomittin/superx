#!/usr/bin/env bash
# iterate-screen.sh
#
# Per-screen visual-parity iteration loop for the `designmatch` skill.
#
# Pipeline:
#   1. Render canonical HTML bundle -> $OUT_DIR/canonical.png  (Playwright)
#   2. Capture native device screenshot -> $OUT_DIR/native.png  (adb / xcrun / idevicescreenshot)
#   3. Diff (pixelmatch + SSIM) -> $OUT_DIR/{diff,composite}.png + metrics.json
#   4. Open composite in OS image viewer
#   5. Print metrics + pass/fail + next-step hint
#
# Required runtime tools:
#   node, npm packages (playwright, pixelmatch, pngjs, ssim.js, sharp)
#   android  : adb on PATH (any recent platform-tools)
#   ios sim  : xcrun (Xcode command-line tools)
#   ios real : idevicescreenshot (libimobiledevice) on PATH
#
# Usage:
#   iterate-screen.sh <ScreenName> \
#     [--platform android|ios] \
#     [--device <serial-or-udid>] \
#     [--bundle <path-to-App.html>] \
#     [--state <state.vqa.json>] \
#     [--out <out-dir>]
#
# Env defaults (overridden by flags):
#   BUNDLE_HTML  path to App.html bundle
#   VQA_STATE    path to state.vqa.json
#   OUT_DIR      output dir (default ./.designmatch/<ScreenName>)
#   PLATFORM     android|ios (default android)
#   DEVICE       adb serial or simulator udid

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<EOF
Usage: iterate-screen.sh <ScreenName> [--platform android|ios] [--device <serial-or-udid>] [--bundle <path-to-App.html>] [--state <state.vqa.json>] [--out <out-dir>]

Env defaults: BUNDLE_HTML, VQA_STATE, OUT_DIR, PLATFORM, DEVICE
EOF
}

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 2
fi

SCREEN_NAME="$1"
shift

if [[ "$SCREEN_NAME" == "-h" || "$SCREEN_NAME" == "--help" ]]; then
  usage
  exit 0
fi

PLATFORM="${PLATFORM:-android}"
DEVICE="${DEVICE:-}"
BUNDLE_HTML="${BUNDLE_HTML:-}"
VQA_STATE="${VQA_STATE:-}"
OUT_DIR="${OUT_DIR:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)
      PLATFORM="${2:-}"; shift 2 ;;
    --device)
      DEVICE="${2:-}"; shift 2 ;;
    --bundle)
      BUNDLE_HTML="${2:-}"; shift 2 ;;
    --state)
      VQA_STATE="${2:-}"; shift 2 ;;
    --out)
      OUT_DIR="${2:-}"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "error: unknown arg: $1" >&2
      usage >&2
      exit 2 ;;
  esac
done

if [[ -z "$OUT_DIR" ]]; then
  OUT_DIR="./.designmatch/${SCREEN_NAME}"
fi

if [[ -z "$BUNDLE_HTML" ]]; then
  echo "error: --bundle <App.html> required (or set BUNDLE_HTML)" >&2
  exit 2
fi
if [[ -z "$VQA_STATE" ]]; then
  echo "error: --state <state.vqa.json> required (or set VQA_STATE)" >&2
  exit 2
fi

if [[ ! -f "$BUNDLE_HTML" ]]; then
  echo "error: bundle not found: $BUNDLE_HTML" >&2
  exit 2
fi
if [[ ! -f "$VQA_STATE" ]]; then
  echo "error: state file not found: $VQA_STATE" >&2
  exit 2
fi

case "$PLATFORM" in
  android|ios) ;;
  *) echo "error: --platform must be android|ios (got: $PLATFORM)" >&2; exit 2 ;;
esac

# Prereqs
if ! command -v node >/dev/null 2>&1; then
  echo "error: node not found on PATH" >&2
  exit 127
fi

if [[ "$PLATFORM" == "android" ]]; then
  if ! command -v adb >/dev/null 2>&1; then
    echo "error: adb not found on PATH (install Android platform-tools)" >&2
    exit 127
  fi
elif [[ "$PLATFORM" == "ios" ]]; then
  HAS_XCRUN=0
  HAS_IDEVICE=0
  command -v xcrun >/dev/null 2>&1 && HAS_XCRUN=1 || true
  command -v idevicescreenshot >/dev/null 2>&1 && HAS_IDEVICE=1 || true
  if [[ "$HAS_XCRUN" -eq 0 && "$HAS_IDEVICE" -eq 0 ]]; then
    echo "error: need xcrun (simulator) or idevicescreenshot (real device) on PATH" >&2
    exit 127
  fi
fi

mkdir -p "$OUT_DIR"
OUT_DIR_ABS="$(cd "$OUT_DIR" && pwd)"

CANONICAL_PNG="$OUT_DIR_ABS/canonical.png"
NATIVE_PNG="$OUT_DIR_ABS/native.png"
COMPOSITE_PNG="$OUT_DIR_ABS/composite.png"
METRICS_JSON="$OUT_DIR_ABS/metrics.json"

echo "[designmatch] screen=$SCREEN_NAME platform=$PLATFORM out=$OUT_DIR_ABS"

# ---- Step 1: render canonical ----------------------------------------------
echo "[designmatch] 1/4 render canonical..."
node "$SCRIPT_DIR/render-canonical.js" \
  --html "$BUNDLE_HTML" \
  --state "$VQA_STATE" \
  --screen "$SCREEN_NAME" \
  --out "$CANONICAL_PNG"

# ---- Step 2: native screenshot ---------------------------------------------
echo "[designmatch] 2/4 capture native..."
if [[ "$PLATFORM" == "android" ]]; then
  ADB_ARGS=()
  if [[ -n "$DEVICE" ]]; then
    ADB_ARGS+=("-s" "$DEVICE")
  fi
  # exec-out preserves raw bytes (no CRLF mangling).
  adb "${ADB_ARGS[@]}" exec-out screencap -p > "$NATIVE_PNG"
  if [[ ! -s "$NATIVE_PNG" ]]; then
    echo "error: adb screencap produced empty file" >&2
    exit 1
  fi
else
  # iOS: prefer xcrun simctl when DEVICE looks like a simulator UDID and xcrun present.
  CAPTURED=0
  if command -v xcrun >/dev/null 2>&1; then
    TARGET="${DEVICE:-booted}"
    if xcrun simctl io "$TARGET" screenshot "$NATIVE_PNG" 2>/dev/null; then
      CAPTURED=1
    fi
  fi
  if [[ "$CAPTURED" -eq 0 ]]; then
    if command -v idevicescreenshot >/dev/null 2>&1; then
      if [[ -n "$DEVICE" ]]; then
        idevicescreenshot -u "$DEVICE" "$NATIVE_PNG"
      else
        idevicescreenshot "$NATIVE_PNG"
      fi
    else
      echo "error: failed to capture iOS screenshot (xcrun simctl failed and idevicescreenshot missing)" >&2
      exit 1
    fi
  fi
  if [[ ! -s "$NATIVE_PNG" ]]; then
    echo "error: iOS screenshot produced empty file" >&2
    exit 1
  fi
fi

# ---- Step 3: diff -----------------------------------------------------------
echo "[designmatch] 3/4 diff..."
set +e
node "$SCRIPT_DIR/visual-diff.js" \
  --canonical "$CANONICAL_PNG" \
  --native "$NATIVE_PNG" \
  --out-dir "$OUT_DIR_ABS"
DIFF_EXIT=$?
set -e

if [[ "$DIFF_EXIT" -eq 0 ]]; then
  STATUS="PASS"
else
  STATUS="FAIL"
fi

# ---- Step 4: open composite -------------------------------------------------
echo "[designmatch] 4/4 open composite..."
if [[ -f "$COMPOSITE_PNG" ]]; then
  if command -v open >/dev/null 2>&1; then
    open "$COMPOSITE_PNG" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$COMPOSITE_PNG" >/dev/null 2>&1 || true
  else
    echo "[designmatch] no image opener found (open/xdg-open); composite at: $COMPOSITE_PNG"
  fi
fi

# ---- Step 5: summary --------------------------------------------------------
echo ""
echo "[designmatch] === $STATUS: $SCREEN_NAME ==="
if [[ -f "$METRICS_JSON" ]]; then
  cat "$METRICS_JSON"
  echo ""
fi
echo ""
echo "next -> edit src/screens/${SCREEN_NAME}.tsx, then re-run: iterate-screen.sh ${SCREEN_NAME}"

exit "$DIFF_EXIT"
