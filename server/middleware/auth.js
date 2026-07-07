const jwt = require('jsonwebtoken');
const config = require('../config');

const JWT_SECRET = config.jwtSecret;
const CHILD_ADMIN_EXPIRES_IN = '7d';
const PARENT_EXPIRES_IN = '30m';       // Task 2.1: parent tokens must be short-lived

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: CHILD_ADMIN_EXPIRES_IN }
  );
}

// Task 2.1: parent tokens carry no user id — they carry the client scope and
// the child ids the parent has authority over. That's what limits/unlock
// endpoints check against.
function signParentToken({ clientId, childIds }) {
  return jwt.sign(
    { role: 'parent', clientId, childIds: Array.isArray(childIds) ? childIds : [] },
    JWT_SECRET,
    { expiresIn: PARENT_EXPIRES_IN }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Allow admins OR a parent whose token scope covers this child. The child id
// is resolved by a callback so it can come from req.params.id OR by looking
// up the assignment's owner (see /assignments/:id parent path).
function requireAdminOrParentOfChild(getChildIdAsync) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      if (req.user.role === 'admin') return next();
      if (req.user.role === 'parent') {
        const childId = await Promise.resolve(getChildIdAsync(req));
        if (childId == null) return res.status(404).json({ error: 'Not found' });
        const list = Array.isArray(req.user.childIds) ? req.user.childIds.map(Number) : [];
        if (list.includes(Number(childId))) return next();
      }
      return res.status(403).json({ error: 'Forbidden' });
    } catch (e) {
      return res.status(500).json({ error: 'Auth error' });
    }
  };
}

// Phase 2 fix: a single canAccessChild that includes the parent role.
// Previously each route re-defined this and only accepted admin+self, which
// meant parent GETs (limits, assignments) were 403'd even for their own kid.
function canAccessChild(user, childId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'child' && Number(user.id) === Number(childId)) return true;
  if (user.role === 'parent') {
    const list = Array.isArray(user.childIds) ? user.childIds.map(Number) : [];
    return list.includes(Number(childId));
  }
  return false;
}

module.exports = {
  signToken,
  signParentToken,
  authRequired,
  requireRole,
  requireAdminOrParentOfChild,
  canAccessChild,
  JWT_SECRET,
  PARENT_EXPIRES_IN
};
