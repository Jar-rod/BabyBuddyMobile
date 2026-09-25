// Serves the Twin log SPA and proxies /api/* to Baby Buddy with a server-held API token.
// Baby Buddy sends no CORS headers, so the browser must never call it directly.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const PORT = Number(process.env.PORT || 8090);
const BB_URL = (process.env.BABYBUDDY_URL || 'http://192.168.0.28:8000').replace(/\/$/, '');
const BB_USER = process.env.BABYBUDDY_USER || '';
const BB_PASSWORD = process.env.BABYBUDDY_PASSWORD || '';
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/dist');

let token = process.env.BABYBUDDY_TOKEN || null;
let tokenPromise = null;

// Minimal cookie jar: keep name=value pairs from Set-Cookie headers.
const cookiesFrom = (res, jar = {}) => {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    jar[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
  return jar;
};
const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

// Log in with username/password the same way the Baby Buddy web UI does, then read the API key.
async function loginForToken() {
  if (!BB_USER || !BB_PASSWORD) throw new Error('Set BABYBUDDY_TOKEN or BABYBUDDY_USER/BABYBUDDY_PASSWORD');
  const loginUrl = `${BB_URL}/login/`;
  const jar = cookiesFrom(await fetch(loginUrl, { redirect: 'manual' }));
  if (!jar.csrftoken) throw new Error('Baby Buddy did not return a CSRF cookie');
  const body = new URLSearchParams({ csrfmiddlewaretoken: jar.csrftoken, username: BB_USER, password: BB_PASSWORD });
  const res = await fetch(loginUrl, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(jar), Referer: loginUrl },
    body,
  });
  cookiesFrom(res, jar);
  if (!jar.sessionid) throw new Error(`Baby Buddy login failed (HTTP ${res.status})`);
  const profile = await fetch(`${BB_URL}/api/profile`, { headers: { Cookie: cookieHeader(jar) } });
  if (!profile.ok) throw new Error(`Could not read Baby Buddy profile (HTTP ${profile.status})`);
  const { api_key } = await profile.json();
  console.log('[auth] obtained Baby Buddy API token via login');
  return api_key;
}

async function getToken({ refresh = false } = {}) {
  if (token && !refresh) return token;
  tokenPromise ??= loginForToken().finally(() => { tokenPromise = null; });
  token = await tokenPromise;
  return token;
}

const app = express();

app.get('/health', (_req, res) => res.json({ ok: true, babybuddy: BB_URL }));

// Resolve the token before proxying; retry login once if Baby Buddy rejects it.
app.use('/api', async (req, _res, next) => {
  try {
    req.bbToken = await getToken();
    next();
  } catch (err) {
    next(err);
  }
});

app.use('/api', createProxyMiddleware({
  target: BB_URL,
  changeOrigin: true,
  pathRewrite: (p) => '/api' + p,
  on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('Authorization', `Token ${req.bbToken}`);
      proxyReq.removeHeader('cookie');
    },
    proxyRes: (proxyRes) => {
      if (proxyRes.statusCode === 401) {
        console.warn('[auth] Baby Buddy returned 401; refreshing token for next request');
        getToken({ refresh: true }).catch((e) => console.error('[auth]', e.message));
      }
    },
    error: (err, _req, res) => {
      console.error('[proxy]', err.message);
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: `Cannot reach Baby Buddy at ${BB_URL}` }));
    },
  },
}));

app.use(express.static(DIST));
app.get('*', (_req, res, next) => res.sendFile(path.join(DIST, 'index.html'), (err) => err && next()));

app.use((err, _req, res, _next) => {
  console.error('[server]', err.message);
  res.status(502).json({ detail: err.message });
});

app
  .listen(PORT, () => console.log(`Twin log listening on http://0.0.0.0:${PORT} → ${BB_URL}`))
  .on('error', (err) => {
    if (err.code !== 'EADDRINUSE') throw err;
    console.error(`Port ${PORT} is already in use — is another "npm run dev" or VS Code debug session running? Stop it and retry.`);
    process.exit(1);
  });
