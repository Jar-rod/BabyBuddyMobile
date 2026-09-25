#!/usr/bin/env bash
# Install or update Twin log on a Raspberry Pi and run it with Docker on port 8001.
#
#   curl -fsSL https://raw.githubusercontent.com/Jar-rod/BabyBuddyMobile/main/install-pi.sh | bash
#
# Re-run the same command to update. Settings live in ~/BabyBuddyMobile/.env and are kept.
# Optional environment overrides: INSTALL_DIR, HOST_PORT, BRANCH, REPO_URL.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Jar-rod/BabyBuddyMobile.git}"
BRANCH="${BRANCH:-main}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/BabyBuddyMobile}"
HOST_PORT="${HOST_PORT:-8001}"

say()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

# Read a value from the terminal even when this script is piped from curl.
ask() {
  local prompt="$1" default="$2" secret="${3:-}" reply=""
  # Prompt on the terminal itself (stdout is captured, stdin may be the curl pipe).
  # No usable terminal (e.g. run from a script): fall back to the default.
  if { exec 3<>/dev/tty; } 2>/dev/null; then
    printf '%s [%s]: ' "$prompt" "$default" >&3
    if [ -n "$secret" ]; then
      read -r -s reply <&3 || true
      printf '\n' >&3
    else
      read -r reply <&3 || true
    fi
    exec 3>&-
  fi
  printf '%s' "${reply:-$default}"
}

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null || die "Run as root or install sudo."
  SUDO="sudo"
fi

# First LAN IP of this machine (empty if unknown).
lan_ip() { { hostname -I 2>/dev/null || true; } | awk '{print $1}'; }

# ---- 1. Prerequisites --------------------------------------------------------
if ! command -v git >/dev/null; then
  say "Installing git"
  $SUDO apt-get update -qq || die "apt-get update failed"
  $SUDO apt-get install -y -qq git || die "Could not install git"
fi

if ! command -v docker >/dev/null; then
  say "Installing Docker (official convenience script)"
  curl -fsSL https://get.docker.com | $SUDO sh || die "Docker install failed"
fi

# Docker Compose v2. Debian's docker.io has no plugin package, so fall back to the
# official release binary installed as a CLI plugin.
install_compose_binary() {
  local arch
  case "$(uname -m)" in
    aarch64|arm64) arch=aarch64 ;;
    armv7l)        arch=armv7 ;;
    armv6l)        arch=armv6 ;;
    x86_64)        arch=x86_64 ;;
    *) return 1 ;;
  esac
  say "Downloading Docker Compose v2 ($arch) from GitHub"
  $SUDO mkdir -p /usr/local/lib/docker/cli-plugins
  $SUDO curl -fsSL -o /usr/local/lib/docker/cli-plugins/docker-compose \
    "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$arch" || return 1
  $SUDO chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
}

if ! docker compose version >/dev/null 2>&1; then
  say "Installing the Docker Compose plugin"
  { $SUDO apt-get update -qq && $SUDO apt-get install -y -qq docker-compose-plugin; } >/dev/null 2>&1 \
    || install_compose_binary \
    || command -v docker-compose >/dev/null \
    || die "Could not install Docker Compose. Install it manually, then re-run."
fi

# Use plain `docker` if this user can reach the daemon; otherwise go through sudo.
DOCKER="docker"
if ! docker info >/dev/null 2>&1; then
  DOCKER="$SUDO docker"
  if [ -n "$SUDO" ] && ! id -nG "$USER" | grep -qw docker; then
    $SUDO usermod -aG docker "$USER" || true
    warn "Added $USER to the docker group — log out and back in to use docker without sudo."
  fi
fi
# Prefer the v2 plugin; fall back to a legacy standalone docker-compose.
DOCKER_PREFIX=""
[ "$DOCKER" != "docker" ] && DOCKER_PREFIX="$SUDO "
if docker compose version >/dev/null 2>&1; then
  COMPOSE="${DOCKER_PREFIX}docker compose"
else
  COMPOSE="${DOCKER_PREFIX}docker-compose"
fi

# ---- 2. Code -----------------------------------------------------------------
if [ -d "$INSTALL_DIR/.git" ]; then
  say "Updating $INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch -q origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout -q "$BRANCH"
  git -C "$INSTALL_DIR" reset -q --hard "origin/$BRANCH"
else
  [ -e "$INSTALL_DIR" ] && die "$INSTALL_DIR exists but is not a git checkout. Move it or set INSTALL_DIR."
  say "Cloning $REPO_URL into $INSTALL_DIR"
  git clone -q --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"

# ---- 3. Settings (first run only) -----------------------------------------------
if [ ! -f .env ]; then
  say "Configuring the connection to Baby Buddy (press Enter to accept the [default])"
  host_ip="$(lan_ip)"
  bb_url="$(ask 'Baby Buddy URL' "http://${host_ip:-192.168.0.28}:8000")"
  bb_user="$(ask 'Baby Buddy username' 'admin')"
  bb_pass="$(ask 'Baby Buddy password' 'admin' secret)"
  umask 077
  cat > .env <<EOF
BABYBUDDY_URL=$bb_url
BABYBUDDY_TOKEN=
BABYBUDDY_USER=$bb_user
BABYBUDDY_PASSWORD=$bb_pass
HOST_PORT=$HOST_PORT
EOF
  say "Saved settings to $INSTALL_DIR/.env (readable only by $USER)"
elif ! grep -q '^HOST_PORT=' .env; then
  echo "HOST_PORT=$HOST_PORT" >> .env
fi

# Check Baby Buddy answers before building.
bb_url="$(grep '^BABYBUDDY_URL=' .env | cut -d= -f2- || true)"
if ! curl -fsS -m 5 -o /dev/null "$bb_url/login/"; then
  warn "Could not reach Baby Buddy at $bb_url — the app will start, but check BABYBUDDY_URL in .env."
fi

# ---- 4. Build and run ----------------------------------------------------------
# Build with plain `docker build`: `compose --build` needs buildx >= 0.17, which Debian's
# docker.io doesn't ship. Without buildx, use the classic builder.
say "Building the image (the first build on a Pi takes a few minutes)"
BUILDKIT=1
docker buildx version >/dev/null 2>&1 || BUILDKIT=0
${DOCKER_PREFIX}env DOCKER_BUILDKIT=$BUILDKIT docker build -t twin-log:latest . || die "Image build failed (see above)."

say "Starting the container"
$COMPOSE up -d --no-build --remove-orphans
$DOCKER image prune -f >/dev/null || true

port="$(grep '^HOST_PORT=' .env | cut -d= -f2- || true)"
port="${port:-$HOST_PORT}"
say "Waiting for the app on port $port"
for _ in $(seq 1 30); do
  if curl -fsS -m 2 "http://127.0.0.1:$port/health" >/dev/null 2>&1; then
    if curl -fsS -m 5 "http://127.0.0.1:$port/api/children/" >/dev/null 2>&1; then
      ip="$(lan_ip)"
      say "Twin log is running → http://${ip:-<pi-ip>}:$port"
      echo "    Logs:    cd $INSTALL_DIR && $COMPOSE logs -f"
      echo "    Update:  re-run this installer"
      exit 0
    fi
    warn "The app is up but can't read from Baby Buddy. Check the URL and login in $INSTALL_DIR/.env, then re-run."
    $COMPOSE logs --tail 20
    exit 1
  fi
  sleep 2
done
$COMPOSE logs --tail 30
die "The app did not become healthy on port $port."
