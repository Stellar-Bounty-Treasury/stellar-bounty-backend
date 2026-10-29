#!/bin/sh
set -e

echo "=== Initializing Stellar Bounty Treasury Backend Container ==="
echo "Node Version: $(node -v)"
echo "Environment: $NODE_ENV"
echo "Target Network: $HORIZON_URL"

# Create data directory if not exists
mkdir -p /data

echo "Launching application server..."
exec node dist/server.js
