// Generuje ikony PNG z public/icons/icon.svg (Playwright/Chromium).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const b = await chromium.launch();
const p = await b.newPage();
async function render(size, file, { pad = 0, bg = null, mono = false } = {}) {
  await p.setViewportSize({ width: size, height: size });
  let inner = svg;
  if (mono) inner = svg.replace(/<rect[^>]*\/>/, '').replace(/stroke-opacity="[^"]*"/g, '');
  await p.setContent(`<html><body style="margin:0;background:${bg ?? 'transparent'}"><div style="width:${size}px;height:${size}px;display:grid;place-items:center">
    <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${inner.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body></html>`);
  await p.screenshot({ path: `public/icons/${file}`, omitBackground: !bg });
}
await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(180, 'apple-touch-icon.png', { bg: '#2563eb' });
await render(512, 'icon-maskable-512.png', { pad: 56, bg: '#2563eb' });
await render(72, 'badge-72.png', { mono: true });
await b.close();
