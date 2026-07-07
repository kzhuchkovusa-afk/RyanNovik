# Deploy KidsBrain

Target: **Netlify (frontend) + Render (backend + persistent-disk SQLite)**. No credit card needed on the free tiers to start.

## 1. Backend on Render

1. Push this repo to GitHub if you haven't already.
2. Go to [render.com](https://render.com) → **New +** → **Blueprint**.
3. Point it at this repo. Render sees `render.yaml` and provisions:
   - `kidsbrain-api` — the Node web service
   - a 1 GB persistent disk mounted at `/var/data` (the SQLite file lives here)
4. Set the env vars Render marks "sync: false" in the dashboard:
   - **`CLIENT_ORIGIN`** — leave blank for now, you'll fill it in after step 2.
   - **`ADMIN_PASSWORD`** — the console login password (default `admin123` — change it).
5. Hit **Apply**. First build takes ~2 min. When the service is live, note the URL — something like `https://kidsbrain-api.onrender.com`. That URL is the backend origin.

The server on first boot runs every pending migration (including the Phase-3 legacy-games retirement) and seeds an `admin` user + the demo child `emma`. You can delete Emma from the console later.

## 2. Frontend on Netlify

1. On [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**.
2. Point at the same repo. Netlify reads `netlify.toml`:
   - **Base directory:** `client`
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `client/dist`
3. Before the first build, edit `netlify.toml` so the API proxy points at your Render URL:
   ```toml
   [[redirects]]
     from = "/api/*"
     to   = "https://YOUR-RENDER-URL.onrender.com/api/:splat"
     status = 200
     force = true
   ```
   Commit + push, Netlify auto-redeploys.
4. When Netlify finishes, copy the site URL (e.g. `https://kidsbrain.netlify.app`) and set it on Render as **`CLIENT_ORIGIN`**. Render will restart the service, and CORS + `/api/parent/login` will accept requests from your Netlify site.

## 3. Smoke test

1. Open the Netlify URL → landing page.
2. Sign in as `admin / <the password you set>`.
3. In the owner console:
   - **Rotate the parent PIN** away from `1234` for the default client (banner warns you).
   - Create a new client → create a child → configure games.
   - Copy the child's magic link and open it in a private tab → child hub loads.
4. On an iPhone/iPad:
   - Open the Netlify URL in Safari.
   - Tap **Share ⤴** → **Add to Home Screen**.
   - The app icon opens fullscreen (no browser chrome) — that's the PWA working.

## Environment variables reference

| Var                    | Where                | Purpose                                                                     |
|------------------------|----------------------|-----------------------------------------------------------------------------|
| `NODE_ENV`             | Render (auto)        | `production` — enables fail-fast checks below                               |
| `PORT`                 | Render (auto)        | Render assigns 10000                                                        |
| `JWT_SECRET`           | Render (auto)        | Random per deploy. Server refuses to boot if unset in prod                  |
| `CLIENT_ORIGIN`        | Render (manual)      | Netlify site URL. Server refuses to boot if unset in prod                   |
| `DB_PATH`              | Render (from yaml)   | `/var/data/kidsbrain.sqlite` — the persistent-disk mount                    |
| `ADMIN_USERNAME`       | Render (from yaml)   | `admin`                                                                     |
| `ADMIN_PASSWORD`       | Render (manual)      | Set to something you control before first boot                              |
| `DEFAULT_PARENT_PIN`   | Render (from yaml)   | Seed PIN for each new client. Rotate per client via the console.            |

## When to graduate from SQLite

The current setup runs on a single Render web service with SQLite on a persistent disk. This handles:

- Any number of clients / children (limited only by disk space — ~5 MB per 100k plays)
- Concurrent reads
- Writes at the pace one server can handle (thousands per second)

**Move to Postgres when any of these hits:**
- You want more than one backend instance (horizontal scaling)
- You want zero-downtime deploys (Render restarts the service between deploys; SQLite blocks briefly during migration)
- You want managed backups / point-in-time restore
- Analytics queries start scanning tens of millions of rows

The port is scoped as a follow-up: swap `db/index.js` for a `pg`-backed async wrapper, convert `db.prepare().get/all/run()` calls to async, translate SQLite-isms in migrations (`AUTOINCREMENT`→`SERIAL`, `date('now')`→`CURRENT_DATE`, `INSERT OR IGNORE`→`ON CONFLICT DO NOTHING`). Render Postgres or Supabase Postgres both work — pick whichever you like.

## Rate limits (parent PIN)

The parent PIN lockout is in-memory (3 fails → 30 s per client). This is safe on the current single-instance deploy. When you scale to multiple backend instances, move it to Redis (or Render Key-Value) with the same shape.

## Sandbox hardening

The `/game-host` iframe uses `sandbox="allow-scripts"` in production (verified by `import.meta.env.DEV` in `GameLauncher.jsx`) so a sandboxed game cannot read the child's JWT even if the game bundle is compromised. In dev the sandbox also includes `allow-same-origin` so Vite HMR works — not a concern because dev is localhost-only.
