#!/usr/bin/env bash
# superx installer — one command from zero to running.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/randomittin/superx/main/install.sh | bash
#
# What it does:
#   1. Installs Claude Code if not present (via npm)
#   2. Clones superx to ~/.superx (or updates if already installed)
#   3. Adds ~/.superx/bin to your PATH
#   4. Installs companion plugins (caveman, superpowers)
#   5. You're ready: `superx "build X"` from any project dir
#
set -euo pipefail

INSTALL_DIR="$HOME/.superx"
REPO="https://github.com/randomittin/superx.git"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   installing superx                  ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# ── Step 1: Ensure Node.js is available (needed for Claude Code) ──

if ! command -v node &>/dev/null; then
  echo "  Node.js not found."
  if command -v brew &>/dev/null; then
    echo "  Installing via Homebrew..."
    brew install node
  elif command -v apt-get &>/dev/null; then
    echo "  Installing via apt..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    echo "  ✘ Please install Node.js 18+ first: https://nodejs.org"
    exit 1
  fi
fi
echo "  ✔ Node.js $(node --version)"

# ── Step 2: Install Claude Code if not present ──

if ! command -v claude &>/dev/null; then
  echo "  Installing Claude Code..."
  npm install -g @anthropic-ai/claude-code
  if ! command -v claude &>/dev/null; then
    echo "  ✘ Claude Code install failed. Install manually:"
    echo "    npm install -g @anthropic-ai/claude-code"
    exit 1
  fi
fi
echo "  ✔ Claude Code $(claude --version 2>/dev/null | head -1 || echo 'installed')"

# ── Step 3: Clone or update superx ──

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "  Updating superx..."
  git -C "$INSTALL_DIR" pull --ff-only origin main 2>/dev/null || true
else
  echo "  Cloning superx..."
  git clone "$REPO" "$INSTALL_DIR"
fi
chmod +x "$INSTALL_DIR/bin/"*
echo "  ✔ superx at $INSTALL_DIR"

# ── Step 4: Add to PATH ──

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
    echo "  ✔ Added to PATH in $SHELL_RC"
  else
    echo "  ✔ PATH already configured"
  fi
  # Make superx available in this session too
  export PATH="$PATH:$HOME/.superx/bin"
else
  echo "  Add to your shell profile: export PATH=\"\$PATH:\$HOME/.superx/bin\""
fi

# ── Step 5: Install companion plugins ──

echo ""
echo "  Installing companion plugins..."

# caveman — token compression (~65-75% output savings)
if ! claude plugins list 2>/dev/null | grep -q "caveman"; then
  echo "  + caveman (token compression, ~65-75% savings)"
  claude plugins marketplace add JuliusBrussee/caveman 2>/dev/null || true
  claude plugins install caveman@caveman 2>/dev/null || true
else
  echo "  ✔ caveman"
fi

# superpowers — brainstorming, debugging, skill-creator
if ! claude plugins list 2>/dev/null | grep -q "superpowers"; then
  echo "  + superpowers (brainstorming, debugging, skill-creator)"
  claude plugins marketplace add anthropics/claude-plugins-official 2>/dev/null || true
  claude plugins install superpowers 2>/dev/null || true
else
  echo "  ✔ superpowers"
fi

# superx marketplace
if ! claude plugins marketplace list 2>/dev/null | grep -q "superx-marketplace"; then
  echo "  + superx marketplace"
  claude plugins marketplace add randomittin/superx-marketplace 2>/dev/null || true
else
  echo "  ✔ superx marketplace"
fi

# ── Done ──

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   ✔ superx ready                     ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
echo "  Usage (from any project directory):"
echo ""
echo "    superx \"build a dashboard\"    end-to-end task"
echo "    superx                        interactive mode"
echo "    superx --dashboard            pixel art web UI"
echo ""
if [ -n "$SHELL_RC" ]; then
  echo "  Run \`source $SHELL_RC\` or open a new terminal to start."
fi
echo ""
