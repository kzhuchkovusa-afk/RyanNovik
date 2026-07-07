// Prod configuration + fail-fast checks. Imported at server boot.

const isProd = process.env.NODE_ENV === 'production';

// A default JWT secret is fine in dev but a fatal error in prod — a
// well-known secret means anyone can forge tokens.
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-me')) {
  console.error(
    '\nFATAL: JWT_SECRET is not set in production.\n' +
    'Set a strong random value (e.g. `openssl rand -base64 48`) and redeploy.\n'
  );
  process.exit(1);
}

// In prod, CORS must be locked to the frontend origin. Missing is fatal —
// it either means the deploy wasn't fully configured or the browser will
// silently fail.
if (isProd && !process.env.CLIENT_ORIGIN) {
  console.error(
    '\nFATAL: CLIENT_ORIGIN is not set in production.\n' +
    'Set it to your Netlify site URL (e.g. https://kidsbrain.netlify.app).\n'
  );
  process.exit(1);
}

module.exports = {
  isProd,
  port: Number(process.env.PORT || 3001),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  dbPath: process.env.DB_PATH || './db/kidsbrain.sqlite',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  defaultParentPin: process.env.DEFAULT_PARENT_PIN || '1234'
};
