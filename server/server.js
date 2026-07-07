require('dotenv').config();
const express = require('express');
const cors = require('cors');
const config = require('./config');   // <-- fail-fast checks run here

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

app.use(cors({ origin: config.clientOrigin, credentials: false }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, env: config.isProd ? 'prod' : 'dev' }));

app.use('/api/auth', authRoutes);
app.use('/api/parent', parentAuthRoutes);
app.use('/api/children', childrenRoutes);
app.use('/api/scores', scoresRoutes);
// Phase 1 endpoints — mounted at /api so paths in each router are absolute.
app.use('/api', assignmentsRoutes);
app.use('/api', limitsRoutes);
app.use('/api', gateRoutes);
app.use('/api/access', accessRoutes);
app.use('/api', accessRoutes);      // also mounts /children/:id/access-token
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

app.listen(config.port, () => {
  console.log(`KidsBrain API listening on http://localhost:${config.port} (${config.isProd ? 'prod' : 'dev'})`);
  console.log(`CORS locked to: ${config.clientOrigin}`);
});
