#!/usr/bin/env node
// Source-only launch audit. It does NOT connect to Atlas or verify a live deployment.
// Use --strict as a release gate after resolving the static blockers.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = p => readFileSync(resolve(root, p), 'utf8');
const menu = JSON.parse(read('scripts/seed-menu.json'));
const issues = [];
const check = (ok, message) => { if (!ok) issues.push(message); };
check(existsSync(resolve(root, 'public/images/aahvaanam-logo-original.png')),
  'Original full-resolution logo is not committed at public/images/aahvaanam-logo-original.png');
check(existsSync(resolve(root, 'public/aahvaanam-food-catalog-original.pdf')),
  'Original two-page catalog PDF is not committed at public/aahvaanam-food-catalog-original.pdf');
const remotePhotos = menu.filter(p => /^https?:\/\//i.test(p.image || '')).map(p => p.id);
check(remotePhotos.length === 0,
  `${remotePhotos.length} menu entries still reference external placeholder photos; replace with authorized local images`);
const models = read('lib/mongodb/models.ts');
check(/ordering_enabled:\s*false/.test(models),
  'Default ordering setting must remain disabled until launch verification');
check(/delivery_enabled:\s*false/.test(models),
  'Default delivery setting must remain disabled until launch verification');
for (const path of ['GOOGLE-SITES-INTEGRATION.md', 'README.md', 'app/privacy/page.tsx', 'netlify.toml']) {
  check(existsSync(resolve(root, path)), `Missing deployment/privacy documentation: ${path}`);
}
console.log('Aahvaanam static launch audit (not a live Atlas/hosting check)');
if (issues.length) {
  for (const issue of issues) console.log('  BLOCKER: ' + issue);
} else {
  console.log('  Static asset/configuration checks passed.');
}
console.log('  MANUAL: Verify private Atlas read/write, production HTTPS/DNS, current menu/prices,');
console.log('          authorized food photography, licensing, privacy/retention, and live checkout.');
if (process.argv.includes('--strict') && issues.length) process.exitCode = 1;
