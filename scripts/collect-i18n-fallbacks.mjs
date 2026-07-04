import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const files = [
  'reference-landing.tsx',
  'client/animated-landing-nav.tsx',
  'client/landing-pricing-cards.tsx',
  'client/landing-map-demo.tsx',
  'client/landing-testimonials-columns.tsx',
  'client/floating-ai-assistant.tsx',
  'client/glass-calendar.tsx',
  'client/legal-pages.tsx',
  'client/splash-loader.tsx',
];

// Match t("key", "fallback") allowing multiline; capture both
const re = /\bt\(\s*(["'])([a-zA-Z0-9_\-]+)\1\s*,\s*(["'])((?:[^\\]|\\.)*?)\3\s*\)/g;

const map = new Map();
for (const f of files) {
  const fp = path.join(root, f);
  if (!fs.existsSync(fp)) continue;
  const s = fs.readFileSync(fp, 'utf8');
  let m;
  while ((m = re.exec(s)) !== null) {
    const key = m[2];
    const fb = m[4];
    if (!map.has(key)) map.set(key, fb);
  }
}

const wanted = process.argv.slice(2);
const out = {};
for (const k of wanted) out[k] = map.get(k) || null;
console.log(JSON.stringify(out, null, 2));
