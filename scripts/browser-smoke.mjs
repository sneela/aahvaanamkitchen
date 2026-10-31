import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:3220';
const env = { ...process.env, MONGODB_URI: '', ADMIN_EMAIL: '', ADMIN_PASSWORD_HASH: '', SESSION_SECRET: '' };
let server, browser, logs = '';
async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw Error('Next.js exited: ' + logs);
    try { if ((await fetch(base)).ok) return; } catch {}
    await sleep(500);
  }
  throw Error('Next.js did not start: ' + logs);
}
async function pageFor(viewport) {
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
  await page.route(/^https:\/\/(images\.unsplash\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//, route => route.abort());
  return page;
}
try {
  await mkdir('artifacts/screenshots', { recursive: true });
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3220'], { env, stdio: 'pipe' });
  server.stdout.on('data', data => logs += data.toString());
  server.stderr.on('data', data => logs += data.toString());
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const desktop = await pageFor({ width: 1440, height: 900 });
  await desktop.goto(base, { waitUntil: 'domcontentloaded' });
  await desktop.locator('.product').first().waitFor();
  assert.ok(await desktop.getByRole('button', { name: 'Refresh menu and announcements' }).isVisible());
  assert.equal(await desktop.locator('.popular-tag').count(),0,'Offline sample items must not show invented order popularity');

  await desktop.locator('.product').first().getByRole('button', { name: 'View details' }).click();
  const details=desktop.getByRole('dialog');
  assert.ok(await details.getByRole('heading',{name:'Jowar Roti'}).isVisible(),'Customers can inspect item details');
  await details.getByRole('button',{name:'Close item details'}).click();
  assert.equal(await desktop.getByRole('dialog').count(),0,'Closing product details returns to the storefront');

  assert.equal(await desktop.locator('.product').count(), 31, 'Sample storefront should display the 31 seeded menu choices');
  await desktop.getByRole('button', { name: 'Add Jowar Roti to cart' }).click();
  await desktop.getByRole('button', { name: 'Cart (1)' }).click();
  await desktop.getByRole('button', { name: 'Continue to request' }).click();
  assert.ok(await desktop.getByRole('link', { name: /ask a question on WhatsApp/i }).isVisible(), 'Offline checkout must clearly offer WhatsApp rather than pretending to save an order');
  await desktop.screenshot({ path: 'artifacts/screenshots/desktop-checkout.png', fullPage: false });
  await desktop.getByRole('button', { name: /Close/ }).click();
  await desktop.goto(base + '/catalog');
  assert.ok((await desktop.locator('body').innerText()).includes('Sample menu only.'), 'Offline catalog must disclose sample prices');
  await desktop.goto(base + '/admin/login');
  assert.ok(await desktop.getByRole('heading', { name: 'Kitchen administration' }).isVisible());
  await desktop.close();

  const mobile = await pageFor({ width: 390, height: 844 });
  await mobile.goto(base, { waitUntil: 'domcontentloaded' });
  await mobile.locator('.product').first().waitFor();
  const dimensions = await mobile.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  assert.ok(dimensions.scrollWidth <= dimensions.viewport + 2, 'Mobile layout overflows horizontally: ' + JSON.stringify(dimensions));
  await mobile.screenshot({ path: 'artifacts/screenshots/mobile-storefront.png', fullPage: true });
  await mobile.getByRole('button', { name: 'Add Jowar Roti to cart' }).click();
  await mobile.getByRole('button', { name: 'Cart (1)' }).click();
  assert.ok(await mobile.getByText('Jowar Roti').last().isVisible(), 'Mobile cart should display added item');
  await mobile.close();
  console.log('Chromium browser smoke passed: desktop and mobile layout, cart, offline checkout, live catalog fallback and admin login.');
} finally {
  if (browser) await browser.close();
  if (server) { server.kill('SIGTERM'); await sleep(300); }
}
