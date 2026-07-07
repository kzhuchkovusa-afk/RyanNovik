# KidsBrain Platform

Personalized cognitive-training games for kids. Each child gets a custom hub with 3 games (memory, attention, speed) themed around their interests. Parents see progress stats. Admin manages all clients.

## Stack
- **Frontend:** React (Vite) — single app, role-based views
- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3) — zero-config, file-based
- **Auth:** JWT (bcrypt-hashed passwords)

## Quick Start (one command)

Requires **Node.js 18+**.

```bash
npm install            # installs concurrently
npm run setup          # installs server + client, seeds the SQLite DB
npm start              # runs backend (:3001) + frontend (:5173) together
```

Then open **http://localhost:5173**.

Default logins:
- **Admin** — `admin / admin123`
- **Demo child** — `emma / emma123` (preloaded with 3 dinosaur games)

`Ctrl+C` stops both servers.

### Manual / per-package start (if you prefer)

```bash
# Backend
cd server && npm install && cp .env.example .env && npm run seed && npm run dev

# Frontend (separate terminal)
cd client && npm install && npm run dev
```

## Roles
- **Child** — plays games (login: their username/password)
- **Parent** — same account, toggle to `/parent` for stats
- **Admin** — login `admin/admin123`, manages all children and games

## Folder Structure
```
kidsbrain/
├── client/   ← React frontend (Vite)
└── server/   ← Node.js backend (Express + SQLite)
```

## Game Templates (Config-Driven)
| Template      | Skill         | What it does                                  |
|---------------|---------------|-----------------------------------------------|
| Memory Match  | Memory        | Flip themed cards to find pairs               |
| Focus Finder  | Attention     | Spot the odd one out among themed icons       |
| Speed Dash    | Fast Thinking | Tap the correct themed answer before timeout  |

Each game accepts a JSON config (theme, items, colors, difficulty) so one template serves every child.

## Deployment

See **[DEPLOY.md](DEPLOY.md)** — Netlify (frontend) + Render (backend + SQLite on persistent disk). Free-tier friendly. ~15 min to get a live URL.

## Build Phases (per architecture doc)
- ✅ Phase 1 — Contract + multi-tenant core (SDK, iframe loader, config-driven games)
- ✅ Phase 2 — Parental controls (PIN auth, limits UI, server-time enforcement gate)
- ✅ Phase 3 — Magic-link access, PWA/iOS install, owner console, deploy configs
- ⏳ Phase 4 — Load Kirill as first real client
