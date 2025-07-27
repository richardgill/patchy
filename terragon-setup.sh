#!/bin/bash
# terragon-setup.sh - Custom setup script for your Terragon environment
# This script runs when your sandbox environment starts

pnpm install

# Install Joist CLI
echo "Installing Joist CLI..."
# Note: Joist is currently only built for M-series Macs (darwin-arm64)
# This installation may not work in a Linux container environment
# You may need to request a Linux build from Joist or run it on your local Mac
curl -sfSL https://joist.fsn1.your-objectstorage.com/cli/jcli-latest-darwin-arm64 -o "/tmp/jcli" && \
    chmod +x "/tmp/jcli" && mv "/tmp/jcli" "/usr/local/bin/"

# Verify installation
if command -v jcli &> /dev/null; then
    echo "Joist CLI installed successfully. Version: $(jcli version)"
else
    echo "Warning: Joist CLI installation may have failed (possibly due to architecture mismatch)"
    echo "Joist is currently only available for M-series Macs (darwin-arm64)"
fi

echo "Setup complete!"
