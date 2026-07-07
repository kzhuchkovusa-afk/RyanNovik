require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const childrenRoutes = require('./routes/children');
const scoresRoutes = require('./routes/scores');
const assignmentsRoutes = require('./routes/assignments');
const limitsRoutes = require('./routes/limits');
const parentAuthRoutes = require('./routes/parent-auth');
const gateRoutes = require('./routes/gate');
const accessRoutes = require('./routes/access');
const clientsRoutes = require('./routes/clients');
const { runAll: runMigrations } = require('./db/migrate');

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_ORIGIN, credentials: false }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/parent', parentAuthRoutes);
app.use('/api/children', childrenRoutes);
app.use('/api/scores', scoresRoutes);
// Phase 1 endpoints — mounted at /api so the paths in each router are absolute
// (e.g. /api/children/:id/assignments, /api/games-library, /api/assignments/:id).
app.use('/api', assignmentsRoutes);
app.use('/api', limitsRoutes);
app.use('/api', gateRoutes);
app.use('/api/access', accessRoutes);
// Also mount the /children/:id/access-token + regenerate paths at /api so the
// admin URL is /api/children/:id/... rather than /api/access/children/:id/...
app.use('/api', accessRoutes);
app.use('/api/clients', clientsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Run pending migrations on every boot — cheap and keeps prod/dev in sync.
try {
  runMigrations();
} catch (e) {
  console.error('Migration failed:', e);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`KidsBrain API listening on http://localhost:${PORT}`);
});
