const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// The default PIN we seed with (see migrate.js phase2_seed_parent_pins).
// Owner MUST rotate this before handing a client link to a real parent.
const DEFAULT_PIN = '1234';
const DEFAULT_PIN_HASH_CHECK = (pin) => bcrypt.compareSync(DEFAULT_PIN, pin);

function clientRow(id) {
  return db.prepare(`SELECT id, name, contact, plan, created_at FROM clients WHERE id = ?`).get(id);
}

// GET /api/clients — list all clients + summary counts
router.get('/', authRequired, requireRole('admin'), (_req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.contact, c.plan, c.created_at,
              (SELECT COUNT(*) FROM users u WHERE u.role='child' AND u.client_id = c.id) AS child_count,
              (SELECT p.pin FROM parents p WHERE p.client_id = c.id LIMIT 1) AS parent_pin_hash
       FROM clients c
       ORDER BY c.created_at DESC`
    )
    .all()
    .map((r) => ({
      id: r.id, name: r.name, contact: r.contact, plan: r.plan,
      created_at: r.created_at,
      child_count: r.child_count,
      parent_pin_is_default: r.parent_pin_hash ? DEFAULT_PIN_HASH_CHECK(r.parent_pin_hash) : true
    }));
  res.json({ clients: rows });
});

router.get('/:id', authRequired, requireRole('admin'), (req, res) => {
  const client = clientRow(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const children = db
    .prepare(
      `SELECT id, username, child_name, age, theme, avatar, created_at
       FROM users
       WHERE role='child' AND client_id = ?
       ORDER BY created_at ASC`
    )
    .all(client.id);
  const parent = db.prepare(`SELECT id, email, pin FROM parents WHERE client_id = ? LIMIT 1`).get(client.id);
  res.json({
    client,
    children,
    parent: parent ? {
      id: parent.id,
      email: parent.email,
      pin_is_default: DEFAULT_PIN_HASH_CHECK(parent.pin)
    } : null
  });
});

router.post('/', authRequired, requireRole('admin'), (req, res) => {
  const { name, contact, plan } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });
  const info = db
    .prepare(`INSERT INTO clients (name, contact, plan) VALUES (?, ?, ?)`)
    .run(name.trim(), contact || null, plan || 'default');
  // Seed a parent row with the default PIN so the client is usable
  // immediately (owner is warned to change it — see parent_pin_is_default).
  const hash = bcrypt.hashSync(DEFAULT_PIN, 10);
  db.prepare(`INSERT INTO parents (client_id, pin) VALUES (?, ?)`).run(info.lastInsertRowid, hash);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', authRequired, requireRole('admin'), (req, res) => {
  const fields = [];
  const values = [];
  for (const k of ['name', 'contact', 'plan']) {
    if (req.body[k] !== undefined) { fields.push(`${k} = ?`); values.push(req.body[k]); }
  }
  if (!fields.length) return res.json({ ok: true });
  values.push(req.params.id);
  db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

router.delete('/:id', authRequired, requireRole('admin'), (req, res) => {
  db.prepare(`DELETE FROM clients WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// PUT /api/clients/:id/parent-pin  { pin }   — set / reset PIN for this
// client's parent row. Bcrypt-hashed; killed the 1234 default the first
// time this is called with something else.
router.put('/:id/parent-pin', authRequired, requireRole('admin'), (req, res) => {
  const pin = String((req.body || {}).pin || '');
  if (!/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4–8 digits' });
  const hash = bcrypt.hashSync(pin, 10);
  const parent = db.prepare(`SELECT id FROM parents WHERE client_id = ? LIMIT 1`).get(req.params.id);
  if (!parent) {
    db.prepare(`INSERT INTO parents (client_id, pin) VALUES (?, ?)`).run(req.params.id, hash);
  } else {
    db.prepare(`UPDATE parents SET pin = ? WHERE id = ?`).run(hash, parent.id);
  }
  res.json({ ok: true, pin_is_default: DEFAULT_PIN_HASH_CHECK(hash) });
});

module.exports = router;
