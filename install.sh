#!/usr/bin/env bash
# Heimdall installer — one command from zero to running.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/randomittin/heimdall/main/install.sh | bash
#
set -euo pipefail

# Ensure cwd exists — if running after --reinstall deleted ~/.heimdall
# while user was inside it, cwd is invalid and bash throws
# "getcwd: cannot access parent directories"
cd "$HOME" 2>/dev/null || true

INSTALL_DIR="$HOME/.heimdall"
REPO="https://github.com/randomittin/heimdall.git"

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
type_text "H E I M D A L L   I N S T A L L E R" 0.03
printf " "
type_text "█▓▒░" 0.03
printf "${R}\n"
printf "  ${D}Nothing ships unproven.${R}\n"
printf "  ${V}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}\n"
printf "\n"

# ── Step 1: Node.js ──

printf "  ${D}[1/6]${R} ${B}Node.js${R}\n"
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

printf "\n  ${D}[2/6]${R} ${B}Claude Code${R}\n"
if ! command -v claude &>/dev/null; then
  # Try without sudo (nvm/fnm), then with sudo (system npm)
  if npm install -g @anthropic-ai/claude-code >/dev/null 2>&1; then
    step_ok "Claude Code installed"
  elif command -v sudo &>/dev/null; then
    echo -e "  ${D}  Needs sudo for global install...${R}"
    sudo npm install -g @anthropic-ai/claude-code >/dev/null 2>&1
  fi
  if ! command -v claude &>/dev/null; then
    step_fail "Install failed. Run: sudo npm install -g @anthropic-ai/claude-code"
    exit 1
  fi
fi
step_ok "Claude Code $(claude --version 2>/dev/null | head -1 || echo 'installed')"

# Check for Claude Code updates — auto-update with sudo fallback
if command -v npm &>/dev/null; then
  latest=$(npm view @anthropic-ai/claude-code version 2>/dev/null || echo "")
  current=$(claude --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")
  if [ -n "$latest" ] && [ -n "$current" ] && [ "$latest" != "$current" ]; then
    echo -e "  ${W}▸ Updating Claude Code: ${current} → ${latest}${R}"
    # Try without sudo first (works with nvm/fnm), fall back to sudo
    if npm install -g @anthropic-ai/claude-code >/dev/null 2>&1; then
      step_ok "Claude Code updated to $latest"
    elif command -v sudo &>/dev/null && sudo -n true 2>/dev/null; then
      # sudo available without password prompt
      sudo npm install -g @anthropic-ai/claude-code >/dev/null 2>&1 && step_ok "Claude Code updated to $latest" || echo -e "  ${D}  Update failed — run manually: npm install -g @anthropic-ai/claude-code${R}"
    else
      echo -e "  ${D}  Needs permissions. Run: sudo npm install -g @anthropic-ai/claude-code${R}"
    fi
  fi
fi

# Check auth (fast — check config files, don't spawn Claude)
if [ ! -f "$HOME/.claude.json" ] && [ ! -f "$HOME/.claude/credentials.json" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo -e "\n  ${W}▸ Claude Code may not be logged in.${R}"
  echo -e "  ${D}  Run: claude login (if you haven't already)${R}"
fi

# ── Step 3: Heimdall ──

printf "\n  ${D}[3/6]${R} ${B}Heimdall${R}\n"
if [ -d "$INSTALL_DIR/.git" ]; then
  spin_cmd "Pulling latest" git -C "$INSTALL_DIR" pull --ff-only origin main
else
  spin_cmd "Cloning Heimdall" git clone "$REPO" "$INSTALL_DIR"
fi
chmod +x "$INSTALL_DIR/bin/"* 2>/dev/null || true
# Create update marker so --update can show "last update included" on first run
# Points to 10 commits back (or first commit) to give a meaningful changelog
first_marker=$(git -C "$INSTALL_DIR" log --oneline -10 2>/dev/null | tail -1 | cut -d' ' -f1)
[ -n "$first_marker" ] && echo "$first_marker" > "$INSTALL_DIR/.last-update-from"
step_ok "Heimdall at ${C}~/.heimdall${R}"

# ── Step 4: PATH ──

printf "\n  ${D}[4/6]${R} ${B}PATH${R}\n"
SHELL_RC=""
if [ -f "$HOME/.zshrc" ]; then
  SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
  SHELL_RC="$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
  SHELL_RC="$HOME/.bash_profile"
fi

if [ -n "$SHELL_RC" ]; then
  if ! grep -q '\.heimdall/bin' "$SHELL_RC" 2>/dev/null; then
    echo '' >> "$SHELL_RC"
    echo '# heimdall — autonomous superskill manager for Claude Code' >> "$SHELL_RC"
    echo 'export PATH="$PATH:$HOME/.heimdall/bin"' >> "$SHELL_RC"
    step_ok "Added to PATH in ${C}$(basename "$SHELL_RC")${R}"
  else
    step_ok "PATH already configured"
  fi
  export PATH="$PATH:$HOME/.heimdall/bin"
else
  printf "  ${W}⚠${R} Add to your shell profile: export PATH=\"\$PATH:\$HOME/.heimdall/bin\"\n"
fi

# ── Step 5: Register the Heimdall plugin with Claude Code ──
#
# The cloned repo at ~/.heimdall is its own marketplace: it ships
# .claude-plugin/marketplace.json declaring the "heimdall" plugin with
# source "./". We add that local clone as a marketplace and install the
# plugin from it, so Claude Code loads heimdall's agents, skills, and hooks
# in every session. This works entirely from the local clone — no separate
# marketplace repo and no network round-trip required.

printf "\n  ${D}[5/6]${R} ${B}Heimdall plugin${R}\n"

# Add the local clone as a marketplace (idempotent: re-adding updates in place).
if claude plugins marketplace list 2>/dev/null | grep -q "^[[:space:]]*❯ heimdall$"; then
  spin_cmd "Updating heimdall marketplace" claude plugins marketplace update heimdall || true
else
  spin_cmd "Registering heimdall marketplace" claude plugins marketplace add "$INSTALL_DIR" || true
fi

# Install / enable the plugin from the heimdall marketplace.
if claude plugins list 2>/dev/null | grep -q "heimdall@heimdall"; then
  step_ok "Heimdall plugin already installed"
else
  spin_cmd "Installing heimdall plugin" claude plugins install heimdall@heimdall || true
fi

# Confirm the plugin is loadable; warn honestly if it is not.
if claude plugins list 2>/dev/null | grep -q "heimdall@heimdall"; then
  step_ok "Heimdall plugin ${C}enabled${R} ${D}(agents + skills + gates load in every session)${R}"
else
  printf "  ${W}⚠${R} Plugin registration didn't confirm. Retry: ${C}claude plugins marketplace add ~/.heimdall && claude plugins install heimdall@heimdall${R}\n"
fi

# ── Step 6: Companion plugins ──

printf "\n  ${D}[6/6]${R} ${B}Companion plugins${R}\n"

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

# ── Done ──

printf "\n"
printf "  ${V}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}\n"
printf "  ${G}${B}✔ Heimdall ready${R}\n"
printf "  ${V}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}\n"
printf "\n"
printf "  ${B}Next${R} ${D}— see Heimdall build a real full-stack app, dry by default:${R}\n"
printf "\n"
printf "  ${C}heimdall-demo${R}                  ${D}scaffold the demo task (add --run to build it)${R}\n"
printf "\n"
printf "  ${B}Then, from any project directory:${R}\n"
printf "\n"
printf "  ${C}heimdall \"build a dashboard\"${R}  ${D}end-to-end task${R}\n"
printf "  ${C}heimdall${R}                      ${D}interactive mode${R}\n"
printf "  ${C}heimdall --dashboard${R}          ${D}pixel art web UI${R}\n"
printf "  ${C}heimdall --update${R}             ${D}pull latest version${R}\n"
printf "\n"
if [ -n "$SHELL_RC" ]; then
  printf "  ${W}▸${R} Run ${UL}source ~/${SHELL_RC##*/}${R} or open a new terminal so ${C}heimdall${R} is on your PATH.\n"
fi
printf "\n"
