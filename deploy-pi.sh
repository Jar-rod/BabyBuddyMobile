#!/usr/bin/env bash
# From the Mac: install or update Twin log on the Pi over SSH (runs install-pi.sh from GitHub).
# Usage: ./deploy-pi.sh [user@host]   (default pi@192.168.0.28)
# Push your changes to GitHub first — the Pi builds whatever is on main.
set -euo pipefail
TARGET="${1:-pi@192.168.0.28}"
ssh -t "$TARGET" 'curl -fsSL https://raw.githubusercontent.com/Jar-rod/BabyBuddyMobile/main/install-pi.sh | bash'
