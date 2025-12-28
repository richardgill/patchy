#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Set up environment
export DEMO_WORKDIR="$SCRIPT_DIR/.workdir"
TAPE_FILE="${1:-demo.tape}"

# Clean and setup
./setup.sh setup

# Run VHS
echo "Recording demo with $TAPE_FILE..."
vhs "$TAPE_FILE"

# Convert to animated WebP (6fps keeps it under GitHub's 10MB limit)
echo "Converting to WebP..."
ffmpeg -y -i demo.webm -vf "fps=6" -c:v libwebp -quality 65 -compression_level 6 -loop 0 demo.webp 2>/dev/null

# Extract frames from webm for validation
echo "Extracting frames..."
rm -rf frames && mkdir -p frames
ffmpeg -i demo.webm -vsync 0 frames/frame-%04d.png 2>/dev/null

echo ""
echo "Done! Output files:"
echo "  - demo.webp (for README - committed)"
echo "  - demo.webm (intermediate - gitignored)"
echo "  - frames/ (PNG frames for validation - gitignored)"
echo ""
echo "Tip: View frames with: open frames/frame-0001.png"
