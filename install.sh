#!/usr/bin/env bash
# superx installer — one command to install and make `superx` available globally.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/randomittin/superx/main/install.sh | bash
#
# What it does:
#   1. Clones superx to ~/.superx (or updates if already installed)
#   2. Adds ~/.superx/bin to your PATH (in .zshrc / .bashrc)
#   3. Installs companion plugins (caveman, superpowers) via Claude Code
#   4. Prints usage instructions
#
set -euo pipefail

INSTALL_DIR="$HOME/.superx"
REPO="https://github.com/randomittin/superx.git"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   installing superx                  ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "  Updating existing installation..."
  git -C "$INSTALL_DIR" pull --ff-only origin main 2>/dev/null || true
else
  echo "  Cloning superx..."
  git clone "$REPO" "$INSTALL_DIR"
fi

# Make binaries executable
chmod +x "$INSTALL_DIR/bin/"*

# Add to PATH if not already there
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
    echo "  Added to PATH in $SHELL_RC"
  else
    echo "  PATH already configured in $SHELL_RC"
  fi
else
  echo "  Could not find shell RC file. Add this to your shell profile:"
  echo "    export PATH=\"\$PATH:\$HOME/.superx/bin\""
fi

# Install companion plugins if Claude Code is available
if command -v claude &>/dev/null; then
  echo ""
  echo "  Installing companion plugins..."

  # caveman — token compression (~65-75% output savings)
  if ! claude plugins list 2>/dev/null | grep -q "caveman"; then
    echo "  + caveman (token compression)"
    claude plugins marketplace add JuliusBrussee/caveman 2>/dev/null || true
    claude plugins install caveman@caveman 2>/dev/null || true
  else
    echo "  ✔ caveman already installed"
  fi

  # superpowers — brainstorming, debugging, skill-creator
  if ! claude plugins list 2>/dev/null | grep -q "superpowers"; then
    echo "  + superpowers (brainstorming, debugging, skill-creator)"
    claude plugins marketplace add anthropics/claude-plugins-official 2>/dev/null || true
    claude plugins install superpowers 2>/dev/null || true
  else
    echo "  ✔ superpowers already installed"
  fi

  # superx marketplace — for `claude plugins install superx` updates
  if ! claude plugins marketplace list 2>/dev/null | grep -q "superx-marketplace"; then
    echo "  + superx marketplace"
    claude plugins marketplace add randomittin/superx-marketplace 2>/dev/null || true
  else
    echo "  ✔ superx marketplace already added"
  fi

else
  echo ""
  echo "  ⚠ Claude Code not found — skipping companion plugin install."
  echo "    Install Claude Code first, then re-run this script to get:"
  echo "    - caveman (token compression, ~65-75% savings)"
  echo "    - superpowers (brainstorming, debugging, skill-creator)"
fi

echo ""
echo "  ✔ superx installed to $INSTALL_DIR"
echo ""
echo "  To start using it now:"
if [ -n "$SHELL_RC" ]; then
  echo "    source $SHELL_RC"
else
  echo "    export PATH=\"\$PATH:\$HOME/.superx/bin\""
fi
echo ""
echo "  Then from any project directory:"
echo "    cd /path/to/your/project"
echo "    superx \"build a dashboard with auth\""
echo ""
echo "  Or start the pixel dashboard:"
echo "    superx --dashboard"
echo ""
echo "  Requirements: Claude Code (authenticated), Python 3.11+, Git"
echo ""
