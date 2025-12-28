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

    # Create pre-existing patches structure
    # 001-custom-build: adds "Custom build step" to build.sh
    # 002-extra-logging: adds logger.sh and sources it from build.sh
    mkdir -p patches/001-custom-build/scripts
    mkdir -p patches/002-extra-logging/scripts

    # 001-custom-build/scripts/build.sh.diff
    cat > patches/001-custom-build/scripts/build.sh.diff << 'EOF'
--- a/scripts/build.sh
+++ b/scripts/build.sh
@@ -1,2 +1,3 @@
 #!/bin/bash
 echo "building..."
+echo "Custom build step"
EOF

    # 002-extra-logging/scripts/build.sh.diff
    cat > patches/002-extra-logging/scripts/build.sh.diff << 'EOF'
--- a/scripts/build.sh
+++ b/scripts/build.sh
@@ -1,3 +1,4 @@
 #!/bin/bash
 echo "building..."
 echo "Custom build step"
+echo "[LOG] Build complete"
EOF

    # Pre-clone the repo at v1.0.0 (required for repo reset command)
    mkdir -p clones
    git clone --quiet https://github.com/richardgill/patchy-demo-repo clones/patchy-demo-repo 2>/dev/null
    cd clones/patchy-demo-repo
    git checkout --quiet v1.0.0
    rm -rf scratch/
    cd "$DEMO_WORKDIR"

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
