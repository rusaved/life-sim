// `node scripts/make-og.mjs`: картинка превью ссылки public/og.png (1200×630) — название и строка из content/brand.json.
// Запускать после смены названия; рисует Chromium из Playwright, без сети.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const brand = JSON.parse(readFileSync(resolve(root, 'content/brand.json'), 'utf8'));
const html = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{background:radial-gradient(ellipse at 50% 35%,#2d251b 0,#17130e 60%,#0f0c09 100%);color:#efe7da;display:flex;align-items:center;justify-content:center;font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif}
.f{position:absolute;inset:36px;border:2px solid rgba(210,176,122,.38)}
.c{text-align:center;padding:0 120px}
.k{font:500 30px system-ui,sans-serif;color:#d2b07a;letter-spacing:.06em}
h1{font-weight:500;font-size:104px;margin:22px 0 18px;line-height:1.05}
p{font:400 34px/1.35 system-ui,sans-serif;color:#a99d8c;margin:0}
.d{width:220px;height:2px;background:rgba(210,176,122,.5);margin:30px auto 0}
</style><div class="f"></div><div class="c"><div class="k">Душа №1 · жизнь 1</div><h1>${brand.title}</h1><p>${brand.tagline}</p><div class="d"></div></div>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: resolve(root, 'public/og.png') });
await browser.close();
console.log('make-og: public/og.png');
