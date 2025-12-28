#!/bin/bash
set -euo pipefail

# Sets up a clean workdir for the patchy demo
# The demo uses the public GitHub repo: richardgill/patchy-demo-repo

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_WORKDIR="${SCRIPT_DIR}/.workdir"

cleanup() {
    rm -rf "$DEMO_WORKDIR"
}

setup() {
    echo "Setting up demo workdir..."
    cleanup
    mkdir -p "$DEMO_WORKDIR"
    cd "$DEMO_WORKDIR"

    # Pre-create patchy.json with v1.0.0 tag (not hash) for cleaner demo output
    cat > patchy.json << 'EOF'
{
  "source_repo": "https://github.com/richardgill/patchy-demo-repo",
  "clones_dir": "./clones/",
  "patches_dir": "./patches/",
  "base_revision": "v1.0.0",
  "upstream_branch": "main",
  "target_repo": "patchy-demo-repo"
}
EOF

    # Pre-clone the repo at v1.0.0
    rm -rf clones
    mkdir -p clones
    git clone --quiet https://github.com/richardgill/patchy-demo-repo clones/patchy-demo-repo 2>/dev/null
    cd clones/patchy-demo-repo
    git checkout --quiet v1.0.0
    # Remove auto-created scratch/ if it exists (from shell hooks)
    rm -rf scratch/
    cd "$DEMO_WORKDIR"

    # Create patches directory
    mkdir -p patches

    # Create .gitignore
    echo "clones/" > .gitignore

    echo "Demo workdir ready at: $DEMO_WORKDIR"
}

case "${1:-setup}" in
    setup)
        setup
        ;;
    cleanup)
        cleanup
        echo "Cleaned up demo files"
        ;;
    *)
        echo "Usage: $0 [setup|cleanup]"
        exit 1
        ;;
esac
