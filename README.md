# Twin log

A phone-friendly front-end for [Baby Buddy](https://docs.baby-buddy.net/) that logs Levi's and Liam's feeds, pumping, weights, sleep, nappy changes and notes. The screens follow the design in `../H3 · Levi & Liam log (interactive)-html/`.

```
phone ──► Twin log :8090 ──/api/*──► Baby Buddy :8000 (Raspberry Pi)
          (Express: serves the UI,     adds "Authorization: Token …"
           proxies the API)
```

Baby Buddy's API sends no CORS headers, so the browser can't call it directly. The small Express server proxies `/api/*` and attaches the API token. The login details stay on the server and never reach the phone.

> **The app has no login of its own.** Anyone who can reach port 8090 can read and write entries. Keep it on the home network.

## Configure

Copy `.env.example` to `.env` and set one of these:

- `BABYBUDDY_TOKEN`: the API key from Baby Buddy (user menu → *API key*), **or**
- `BABYBUDDY_USER` / `BABYBUDDY_PASSWORD`: the server logs in once and fetches the key itself.

Also set `BABYBUDDY_URL`, which defaults to `http://192.168.0.28:8000`.

## Develop and debug in VS Code (Mac)

```bash
cd app && npm install
npm run dev          # Express on :8091 (inspector on :9229) + Vite on :5173
                     # (also works from the workspace root; :8090 stays free for Docker)
```

Open http://localhost:5173. Your phone can also use `http://<mac-ip>:5173` on the same Wi-Fi.

Launch configurations (Run and Debug panel, at the workspace root):

| Config | What it does |
|---|---|
| **Full stack (server + web + Chrome)** | Starts the Express proxy and Vite, then opens a Chrome debug session. Breakpoints work in both `server/` and `web/src/`. |
| Server (Express proxy) | Only the proxy, for breakpoints in `server/index.js`. |
| Chrome: phone view | Attaches Chrome to an already-running Vite. |
| Attach to Docker (port 9229) | Debugs the proxy inside the container. Start the container with the **docker: up (debug)** task first. |

## Run in Docker

```bash
docker compose up -d --build                       # http://localhost:8090
docker compose -f docker-compose.yml -f docker-compose.debug.yml up -d --build   # + inspector on :9229
```

## Deploy to the Raspberry Pi

The Pi needs Docker with the compose plugin. From the Mac:

```bash
./deploy-pi.sh pi@192.168.0.28
```

This copies the project to `~/babybuddy-mobile` on the Pi, builds the image there (arm64), and starts it with `restart: unless-stopped`. Then open **http://192.168.0.28:8090** on your phone and use *Add to Home Screen* to get an app-like launcher.

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
