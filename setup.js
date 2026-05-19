// One-shot setup for KidsBrain — works on macOS, Linux, and Windows.
// Installs server + client deps, copies .env, seeds the SQLite DB.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = __dirname;
const server = path.join(root, 'server');
const client = path.join(root, 'client');

function run(cmd, cwd) {
  console.log(`\n→ ${cmd}   (in ${path.basename(cwd)}/)`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

// 1. Ensure server/.env exists
const envFile = path.join(server, '.env');
const envExample = path.join(server, '.env.example');
if (!fs.existsSync(envFile)) {
  fs.copyFileSync(envExample, envFile);
  console.log('✔ Created server/.env from .env.example');
} else {
  console.log('• server/.env already exists — leaving it alone');
}

// 2. Install server deps
run('npm install', server);

// 3. Seed DB (creates tables + admin + demo child if missing)
run('npm run seed', server);

// 4. Install client deps
run('npm install', client);

console.log('\n✅ Setup complete!');
console.log('\nNext step: run  npm start');
console.log('Then open:     http://localhost:5173');
console.log('\nLogins:');
console.log('  Admin   →  admin / admin123');
console.log('  Child   →  emma / emma123');
