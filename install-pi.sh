#!/usr/bin/env bash
# Install or update Twin log on a Raspberry Pi and run it with Docker on port 8001.
#
#   curl -fsSL https://raw.githubusercontent.com/Jar-rod/BabyBuddyMobile/main/install-pi.sh | bash
#
# Re-run the same command to update. Settings live in ~/BabyBuddyMobile/.env and are kept.
#
# Change the Baby Buddy login (updates .env and restarts the app):
#   curl -fsSL https://raw.githubusercontent.com/Jar-rod/BabyBuddyMobile/main/install-pi.sh | BABYBUDDY_PASSWORD='...' bash
# Re-ask every setting:
#   curl -fsSL https://raw.githubusercontent.com/Jar-rod/BabyBuddyMobile/main/install-pi.sh | bash -s -- --reconfigure
set -euo pipefail

# The whole script is inside { } so bash reads it all before running; the update step
# below rewrites this file when it's run from the checkout.
{

# ---- Config -------------------------------------------------------------------------
# Every value can be overridden from the environment when running the script.
# The password is deliberately NOT stored here - this file is public on GitHub.
DEFAULT_BABYBUDDY_USER="Ramsaroop"
DEFAULT_BABYBUDDY_URL=""               # empty = http://<this Pi's IP>:8000
HOST_PORT="${HOST_PORT:-8001}"         # port phones use: http://<pi-ip>:8001
REPO_URL="${REPO_URL:-https://github.com/Jar-rod/BabyBuddyMobile.git}"
BRANCH="${BRANCH:-main}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/BabyBuddyMobile}"
RECONFIGURE="${RECONFIGURE:-0}"
for arg in "$@"; do
  case "$arg" in
    --reconfigure) RECONFIGURE=1 ;;
    *) printf 'Unknown option: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

say()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

# Read a value from the terminal even when this script is piped from curl.
ask() {
  local prompt="$1" default="$2" secret="${3:-}" reply=""
  # Prompt on the terminal itself (stdout is captured, stdin may be the curl pipe).
  # No usable terminal (e.g. run from a script): fall back to the default.
  if { exec 3<>/dev/tty; } 2>/dev/null; then
    if [ -n "$default" ] && [ -z "$secret" ]; then
    printf '%s [%s]: ' "$prompt" "$default" >&3
  else
    printf '%s: ' "$prompt" >&3
  fi
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

# ---- 3. Settings -------------------------------------------------------------------
# Read a saved value from .env (surrounding single quotes removed).
env_get() {
  [ -f .env ] || return 0
  { grep "^$1=" .env || true; } | tail -1 | cut -d= -f2- | sed "s/^'\(.*\)'$/\1/"
}

# (Re)write .env on the first run, with --reconfigure, or when a setting is passed in.
if [ ! -f .env ] || [ "$RECONFIGURE" = 1 ] || [ -n "${BABYBUDDY_URL:-}${BABYBUDDY_USER:-}${BABYBUDDY_PASSWORD:-}" ]; then
  say "Configuring the connection to Baby Buddy (press Enter to accept the [default])"
  host_ip="$(lan_ip)"
  saved_url="$(env_get BABYBUDDY_URL)"
  saved_user="$(env_get BABYBUDDY_USER)"
  saved_pass="$(env_get BABYBUDDY_PASSWORD)"
  saved_port="$(env_get HOST_PORT)"
  def_url="${saved_url:-${DEFAULT_BABYBUDDY_URL:-http://${host_ip:-192.168.0.28}:8000}}"
  def_user="${saved_user:-$DEFAULT_BABYBUDDY_USER}"
  ask_all=0
  if [ ! -f .env ] || [ "$RECONFIGURE" = 1 ]; then ask_all=1; fi

  if [ -n "${BABYBUDDY_URL:-}" ]; then bb_url="$BABYBUDDY_URL"
  elif [ "$ask_all" = 1 ]; then bb_url="$(ask 'Baby Buddy URL' "$def_url")"
  else bb_url="$def_url"; fi

  if [ -n "${BABYBUDDY_USER:-}" ]; then bb_user="$BABYBUDDY_USER"
  elif [ "$ask_all" = 1 ]; then bb_user="$(ask 'Baby Buddy username' "$def_user")"
  else bb_user="$def_user"; fi

  # Keep the saved password only if the username is unchanged.
  keep_pass=""
  if [ "$bb_user" = "$saved_user" ]; then keep_pass="$saved_pass"; fi
  if [ -n "${BABYBUDDY_PASSWORD:-}" ]; then bb_pass="$BABYBUDDY_PASSWORD"
  elif [ "$ask_all" = 1 ] || [ -z "$keep_pass" ]; then
    label="Baby Buddy password for $bb_user"
    if [ -n "$keep_pass" ]; then label="$label (Enter keeps the saved one)"; fi
    bb_pass="$(ask "$label" '' secret)"
    bb_pass="${bb_pass:-$keep_pass}"
  else bb_pass="$keep_pass"; fi

  [ -n "$bb_pass" ] || die "A Baby Buddy password is required. Re-run with BABYBUDDY_PASSWORD='...' in front of bash."
  case "$bb_url$bb_user$bb_pass" in *"'"*) die "Settings can't contain a single quote (')." ;; esac

  umask 077
  # Single quotes keep characters like $ and # literal for Docker Compose.
  {
    echo "BABYBUDDY_URL='$bb_url'"
    echo "BABYBUDDY_TOKEN="
    echo "BABYBUDDY_USER='$bb_user'"
    echo "BABYBUDDY_PASSWORD='$bb_pass'"
    echo "HOST_PORT=${saved_port:-$HOST_PORT}"
  } > .env
  chmod 600 .env
  say "Saved settings for $bb_user to $INSTALL_DIR/.env (readable only by $USER)"
elif ! grep -q '^HOST_PORT=' .env; then
  echo "HOST_PORT=$HOST_PORT" >> .env
fi

# Check Baby Buddy answers before building.
bb_url="$(env_get BABYBUDDY_URL)"
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

port="$(env_get HOST_PORT)"
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
}
