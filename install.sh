#!/usr/bin/env bash
# superx installer — one command from zero to running.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/randomittin/superx/main/install.sh | bash
#
set -euo pipefail

# Ensure cwd exists — if running after --reinstall deleted ~/.superx
# while user was inside it, cwd is invalid and bash throws
# "getcwd: cannot access parent directories"
cd "$HOME" 2>/dev/null || true

INSTALL_DIR="$HOME/.superx"
REPO="https://github.com/randomittin/superx.git"

# ── Colors (24-bit with fallback) ──

if [[ "${COLORTERM:-}" == "truecolor" || "${COLORTERM:-}" == "24bit" || "${TERM:-}" == *256color* ]]; then
  P='\033[38;2;224;86;160m'   # pink
  C='\033[38;2;0;212;255m'    # cyan
  V='\033[38;2;155;89;182m'   # violet
  G='\033[38;2;78;204;163m'   # green
  D='\033[38;2;100;100;120m'  # dim
  W='\033[38;2;255;200;80m'   # warm yellow
else
  P='\033[35m'; C='\033[36m'; V='\033[34m'; G='\033[32m'; D='\033[37m'; W='\033[33m'
fi
B='\033[1m'; R='\033[0m'; UL='\033[4m'

# ── Helpers ──

type_text() {
  local text="$1" delay="${2:-0.015}"
  for (( i=0; i<${#text}; i++ )); do
    printf "%s" "${text:$i:1}"
    sleep "$delay"
  done
}

step_ok() {
  echo -e "  ${G}✔${R} $1"
}

step_add() {
  echo -ne "  ${C}+${R} $1"
}

step_done() {
  echo -e "\r  ${G}✔${R} $1"
}

step_fail() {
  echo -e "  ${P}✘${R} $1"
}

spin_cmd() {
  # Run a command with spinner. Usage: spin_cmd "label" command args...
  local label="$1"; shift
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  "$@" >/dev/null 2>&1 &
  local pid=$!
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    echo -ne "\r  ${V}${frames[$((i % 10))]}${R} $label"
    sleep 0.08
    i=$((i + 1))
  done
  wait "$pid" 2>/dev/null
  local rc=$?
  if [ $rc -eq 0 ]; then
    echo -e "\r  ${G}✔${R} $label"
  else
    echo -e "\r  ${W}⚠${R} $label ${D}(non-zero exit)${R}"
  fi
  return $rc
}

# ── Banner ──

printf "\n"
printf "  ${P}${B}"
type_text "░▒▓█" 0.03
printf " "
type_text "S U P E R X   I N S T A L L E R" 0.03
printf " "
type_text "█▓▒░" 0.03
printf "${R}\n"
printf "  ${V}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}\n"
printf "\n"

# ── Step 1: Node.js ──

printf "  ${D}[1/5]${R} ${B}Node.js${R}\n"
if ! command -v node &>/dev/null; then
  if command -v brew &>/dev/null; then
    spin_cmd "Installing Node.js via Homebrew" brew install node
  elif command -v apt-get &>/dev/null; then
    step_add "Installing Node.js via apt..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - >/dev/null 2>&1
    sudo apt-get install -y nodejs >/dev/null 2>&1
    step_done "Node.js installed"
  else
    step_fail "Node.js not found. Install from https://nodejs.org"
    exit 1
  fi
fi
step_ok "Node.js $(node --version)"

# ── Step 2: Claude Code ──

printf "\n  ${D}[2/5]${R} ${B}Claude Code${R}\n"
if ! command -v claude &>/dev/null; then
  spin_cmd "Installing Claude Code" npm install -g @anthropic-ai/claude-code
  if ! command -v claude &>/dev/null; then
    step_fail "Install failed. Run: npm install -g @anthropic-ai/claude-code"
    exit 1
  fi
fi
step_ok "Claude Code $(claude --version 2>/dev/null | head -1 || echo 'installed')"

# Check for Claude Code updates (notify only — don't auto-update, can break on some systems)
if command -v npm &>/dev/null; then
  latest=$(npm view @anthropic-ai/claude-code version 2>/dev/null || echo "")
  current=$(claude --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
  if [ -n "$latest" ] && [ -n "$current" ] && [ "$latest" != "$current" ]; then
    echo -e "  ${W}▸ Claude Code update available: ${current} → ${latest}${R}"
    echo -e "  ${D}  Run: npm install -g @anthropic-ai/claude-code${R}"
  fi
fi

# Check auth (fast — just check if config exists, don't spawn Claude)
if [ ! -f "$HOME/.claude.json" ] && [ ! -f "$HOME/.claude/credentials.json" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo -e "\n  ${W}▸ Claude Code may not be logged in.${R}"
  echo -e "  ${D}  Run: claude login (if you haven't already)${R}"
fi

# ── Step 3: superx ──

printf "\n  ${D}[3/5]${R} ${B}superx${R}\n"
if [ -d "$INSTALL_DIR/.git" ]; then
  spin_cmd "Pulling latest" git -C "$INSTALL_DIR" pull --ff-only origin main
else
  spin_cmd "Cloning superx" git clone "$REPO" "$INSTALL_DIR"
fi
chmod +x "$INSTALL_DIR/bin/"* 2>/dev/null || true
# Create update marker so --update can show "last update included" on first run
# Points to 10 commits back (or first commit) to give a meaningful changelog
first_marker=$(git -C "$INSTALL_DIR" log --oneline -10 2>/dev/null | tail -1 | cut -d' ' -f1)
[ -n "$first_marker" ] && echo "$first_marker" > "$INSTALL_DIR/.last-update-from"
step_ok "superx at ${C}~/.superx${R}"

# ── Step 4: PATH ──

printf "\n  ${D}[4/5]${R} ${B}PATH${R}\n"
SHELL_RC=""
if [ -f "$HOME/.zshrc" ]; then
  SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
  SHELL_RC="$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
  SHELL_RC="$HOME/.bash_profile"
fi

if [ -n "$SHELL_RC" ]; then
  if ! grep -q '\.superx/bin' "$SHELL_RC" 2>/dev/null; then
    echo '' >> "$SHELL_RC"
    echo '# superx — autonomous superskill manager for Claude Code' >> "$SHELL_RC"
    echo 'export PATH="$PATH:$HOME/.superx/bin"' >> "$SHELL_RC"
    step_ok "Added to PATH in ${C}$(basename "$SHELL_RC")${R}"
  else
    step_ok "PATH already configured"
  fi
  export PATH="$PATH:$HOME/.superx/bin"
else
  printf "  ${W}⚠${R} Add to your shell profile: export PATH=\"\$PATH:\$HOME/.superx/bin\"\n"
fi

# ── Step 5: Companion plugins ──

printf "\n  ${D}[5/5]${R} ${B}Companion plugins${R}\n"

# caveman
if ! claude plugins list 2>/dev/null | grep -q "caveman"; then
  claude plugins marketplace add JuliusBrussee/caveman >/dev/null 2>&1 || true
  spin_cmd "caveman ${D}(token compression)${R}" claude plugins install caveman@caveman || true
else
  step_ok "caveman"
fi

# superpowers
if ! claude plugins list 2>/dev/null | grep -q "superpowers"; then
  claude plugins marketplace add anthropics/claude-plugins-official >/dev/null 2>&1 || true
  spin_cmd "superpowers ${D}(brainstorming, debugging)${R}" claude plugins install superpowers || true
else
  step_ok "superpowers"
fi

# claude-mem
if ! command -v claude-mem &>/dev/null; then
  spin_cmd "claude-mem ${D}(persistent memory)${R}" npx claude-mem install || true
else
  step_ok "claude-mem"
fi

# superx marketplace
if ! claude plugins marketplace list 2>/dev/null | grep -q "superx-marketplace"; then
  spin_cmd "superx marketplace" claude plugins marketplace add randomittin/superx-marketplace || true
else
  step_ok "superx marketplace"
fi

# ── Done ──

printf "\n"
printf "  ${V}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}\n"
printf "  ${G}${B}✔ superx ready${R}\n"
printf "  ${V}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}\n"
printf "\n"
printf "  ${B}Usage${R} ${D}(from any project directory):${R}\n"
printf "\n"
printf "  ${C}superx \"build a dashboard\"${R}    ${D}end-to-end task${R}\n"
printf "  ${C}superx${R}                        ${D}interactive mode${R}\n"
printf "  ${C}superx --dashboard${R}            ${D}pixel art web UI${R}\n"
printf "  ${C}superx --update${R}               ${D}pull latest version${R}\n"
printf "\n"
if [ -n "$SHELL_RC" ]; then
  printf "  ${W}▸${R} Run ${UL}source ~/${SHELL_RC##*/}${R} or open a new terminal to start.\n"
fi
printf "\n"
