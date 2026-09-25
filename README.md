# Twin log

A phone-friendly front-end for [Baby Buddy](https://docs.baby-buddy.net/) that logs Levi's and Liam's feeds, pumping, weights, sleep, nappy changes and notes. The screens follow the designs *H3 · Levi & Liam log* and *history_1*.

```
phone ──► Twin log :8001 ──/api/*──► Baby Buddy :8000 (Raspberry Pi)
          (Express: serves the UI,     adds "Authorization: Token …"
           proxies the API)
```

Baby Buddy's API sends no CORS headers, so the browser can't call it directly. The small Express server proxies `/api/*` and attaches the API token. The login details stay on the server and never reach the phone.

> **The app has no login of its own.** Anyone who can reach port 8001 can read and write entries. Keep it on the home network.

## Configure

Copy `.env.example` to `.env` and set one of these:

- `BABYBUDDY_TOKEN`: the API key from Baby Buddy (user menu → *API key*), **or**
- `BABYBUDDY_USER` / `BABYBUDDY_PASSWORD`: the server logs in once and fetches the key itself. Wrap values in single quotes, e.g. `BABYBUDDY_PASSWORD='p@ss$word'`.

Also set `BABYBUDDY_URL`, which defaults to `http://192.168.0.28:8000`.

## Develop and debug in VS Code (Mac)

```bash
cd app && npm install
npm run dev          # Express on :8091 (inspector on :9229) + Vite on :5173
                     # (also works from the workspace root; doesn't clash with Docker on :8001)
```

Open http://localhost:5173. Your phone can also use `http://<mac-ip>:5173` on the same Wi-Fi.

Launch configurations (Run and Debug panel; they live in the parent workspace's `.vscode/`):

| Config | What it does |
|---|---|
| **Full stack (server + web + Chrome)** | Starts the Express proxy and Vite, then opens a Chrome debug session. Breakpoints work in both `server/` and `web/src/`. |
| Server (Express proxy) | Only the proxy, for breakpoints in `server/index.js`. |
| Chrome: phone view | Attaches Chrome to an already-running Vite. |
| Attach to Docker (port 9229) | Debugs the proxy inside the container. Start the container with the **docker: up (debug)** task first. |

## Install on the Raspberry Pi

On the Pi (over SSH or with a keyboard), run:

```bash
curl -fsSL https://raw.githubusercontent.com/Jar-rod/BabyBuddyMobile/main/install-pi.sh | bash
```

[install-pi.sh](install-pi.sh) does the following:

1. Installs git, Docker and the Compose plugin if they're missing.
2. Clones this repo to `~/BabyBuddyMobile`, or updates it if it's already there.
3. On the first run, asks for the Baby Buddy URL, username (default `Ramsaroop`) and password, and saves them to `~/BabyBuddyMobile/.env`. Only your user can read that file.
4. Builds the image on the Pi (arm64) and starts it with `restart: unless-stopped`, so it comes back after a reboot.
5. Waits until the app can read from Baby Buddy, then prints the address.

Then open **http://192.168.0.28:8001** on your phone and use *Add to Home Screen* to get an app-like launcher.

- **Update:** push to `main`, then run the same command again. Your `.env` settings are kept.
- **From the Mac:** `./deploy-pi.sh pi@192.168.0.28` runs the installer on the Pi over SSH.
- **Change the Baby Buddy login:** run the installer with the new login in front of `bash`. It rewrites `.env` and restarts the app:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/Jar-rod/BabyBuddyMobile/main/install-pi.sh | BABYBUDDY_USER=Ramsaroop BABYBUDDY_PASSWORD='your-password' bash
  ```
  Add `bash -s -- --reconfigure` instead of `bash` to be asked every setting again. The default username (`Ramsaroop`), port and install folder are in the *Config* block at the top of [install-pi.sh](install-pi.sh). The password is never stored there, because this repo is public.
- **Change the port:** edit `HOST_PORT` in `~/BabyBuddyMobile/.env` and run the installer again.
- **Logs:** `cd ~/BabyBuddyMobile && docker compose logs -f`

## Run in Docker locally

```bash
docker compose up -d --build                       # http://localhost:8001
docker compose -f docker-compose.yml -f docker-compose.debug.yml up -d --build   # + inspector on :9229
```

## How screens map to Baby Buddy

| Screen | Endpoint | Notes |
|---|---|---|
| Feeding · Breast (Left/Right/Both) | `/api/feedings/` | `type=breast milk`, `method=left/right/both breasts` |
| Feeding · Formula | `/api/feedings/` | `type=formula`, `method=bottle`, `amount` ml |
| Feeding · Expressed milk | `/api/feedings/` | `type=breast milk`, `method=bottle`, `amount` ml |
| Pumping | `/api/pumping/` | `amount`, `start`, `end` |
| Weight | `/api/weight/` | `weight` kg, `date` |
| Sleep | `/api/sleep/` | `start`, `end`, `nap` |
| Changes | `/api/changes/` | `wet`, `solid`, `color`, numeric `amount` |
| Notes | `/api/notes/` | `note`, `time` |
| Timeline Edit / Delete | `PATCH` / `DELETE /api/<endpoint>/<id>/` | |

Choosing **Both** creates one entry per child. Children are matched by first name (Levi → blue, Liam → orange).

Feedings that were entered in Baby Buddy with other types (for example *solid food*) show their own type chip when edited, so saving doesn't change their type.

**History** (bottom nav) lists the last 30 days with day, child and type filters. Tap an entry to view, edit or delete it; deletes can be undone for 4 seconds (Baby Buddy has no restore, so undo re-creates the entry with a new id).
