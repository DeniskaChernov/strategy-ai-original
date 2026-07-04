import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

const keyRe = /\bt\(\s*["']([a-zA-Z0-9_\-]+)["']/g;
const allKeys = new Set();
for (const f of files) {
  const fp = path.join(root, f);
  if (!fs.existsSync(fp)) continue;
  const s = fs.readFileSync(fp, 'utf8');
  let m;
  while ((m = keyRe.exec(s)) !== null) allKeys.add(m[1]);
}

// Load LANGS by stripping TS export and eval
const langsSrc = fs.readFileSync(path.join(root, 'client/i18n/langs.ts'), 'utf8');
const jsSrc = langsSrc
  .replace(/\bexport\s+/g, '')
  .replace(/\bas\s+const\b/g, '');
const mod = new Function(`${jsSrc}; return LANGS;`);
const LANGS = mod();

const ruK = new Set(Object.keys(LANGS.ru));
const enK = new Set(Object.keys(LANGS.en));
const uzK = new Set(Object.keys(LANGS.uz));
const missing = { ru: [], en: [], uz: [] };
for (const k of allKeys) {
  if (!ruK.has(k)) missing.ru.push(k);
  if (!enK.has(k)) missing.en.push(k);
  if (!uzK.has(k)) missing.uz.push(k);
}
console.log('Total used keys:', allKeys.size);
console.log('--- Missing in RU (' + missing.ru.length + ') ---');
console.log(missing.ru.sort().join('\n'));
console.log('--- Missing in EN (' + missing.en.length + ') ---');
console.log(missing.en.sort().join('\n'));
console.log('--- Missing in UZ (' + missing.uz.length + ') ---');
console.log(missing.uz.sort().join('\n'));
