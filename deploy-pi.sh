#!/usr/bin/env bash
# Copy the app to the Raspberry Pi and (re)start it with Docker Compose.
# Usage: ./deploy-pi.sh [user@host]   (default pi@192.168.0.28)
set -euo pipefail
TARGET="${1:-pi@192.168.0.28}"
DIR="babybuddy-mobile"
cd "$(dirname "$0")"
rsync -av --delete --exclude node_modules --exclude web/dist --exclude .env ./ "$TARGET:$DIR/"
# Copy .env only if the Pi doesn't have one yet, so edits made on the Pi survive.
ssh "$TARGET" "test -f $DIR/.env" || scp .env "$TARGET:$DIR/.env"
ssh "$TARGET" "cd $DIR && docker compose up -d --build && docker compose ps"
echo "Open http://${TARGET#*@}:8090 on your phone."
