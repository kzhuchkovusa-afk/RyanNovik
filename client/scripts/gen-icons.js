// Generate PNG icons from public/icon.svg at the sizes needed for PWA +
// iOS. Run via `npm run gen-icons`. Client package is ESM (see type:module).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const SRC = path.join(PUBLIC, 'icon.svg');
const svg = fs.readFileSync(SRC);

const OUTPUTS = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  // Apple touch icon canonical size is 180x180.
  { name: 'apple-touch-icon.png', size: 180 },
  // Maskable variant (safe-zone icon): same visual, we already have padding.
  { name: 'icon-maskable-512.png', size: 512 }
];

for (const o of OUTPUTS) {
  await sharp(svg, { density: 400 })
    .resize(o.size, o.size)
    .png()
    .toFile(path.join(PUBLIC, o.name));
  console.log(`✔ ${o.name} (${o.size}×${o.size})`);
}
