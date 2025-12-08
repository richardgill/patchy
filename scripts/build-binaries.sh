#!/usr/bin/env bash
set -euo pipefail

DIST_DIR="dist/bin"
mkdir -p "$DIST_DIR"

TARGETS=(
  "bun-linux-x64"
  "bun-darwin-x64"
  "bun-darwin-arm64"
  "bun-windows-x64"
)

for target in "${TARGETS[@]}"; do
  echo "Building for $target..."

  case "$target" in
    *windows*)
      outfile="$DIST_DIR/patchy-${target#bun-}.exe"
      ;;
    *)
      outfile="$DIST_DIR/patchy-${target#bun-}"
      ;;
  esac

  bun build ./src/cli.ts --compile --minify --target="$target" --outfile="$outfile"
  echo "  Created: $outfile"
done

echo ""
echo "All binaries built:"
ls -lh "$DIST_DIR"
