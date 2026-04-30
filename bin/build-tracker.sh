#!/usr/bin/env bash
# Build parallelism-tracker from C source. Apple clang ships with macOS
# (Command Line Tools); on Linux, install gcc or clang via your package manager.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
CC="${CC:-clang}"
"$CC" -O2 -Wall -Wextra -o "$DIR/parallelism-tracker" "$DIR/parallelism-tracker.c"
echo "built: $DIR/parallelism-tracker"
