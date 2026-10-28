// `npm run check:vk`: сборка VK и ОК (dist-pages/vk) по правилам площадки, насколько их видно по файлам: ни одного чужого адреса
// (кроме ссылки «Поделиться» на свой сайт и страницу приложения VK), ни внешних скриптов, ни счётчиков, ни og-превью;
// VKWebAppInit и VK Storage на месте; печатает вес сборки.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
const dir = resolve(root, process.argv[2] ?? 'dist-pages/vk');
const brand = JSON.parse(readFileSync(resolve(root, 'content/brand.json'), 'utf8'));
const ALLOWED = [brand.siteUrl, 'https://vk.com/app'];
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else files.push([relative(dir, p), readFileSync(p)]);
  }
};
walk(dir);
const problems = [];
let gz = 0;
let all = '';
for (const [name, buf] of files) {
  if (!['.js', '.html', '.css', '.json'].includes(extname(name))) {
    problems.push(`${name}: лишний файл в сборке vk`);
    continue;
  }
  const text = buf.toString('utf8');
  all += text;
  gz += gzipSync(buf).length;
  for (const m of text.matchAll(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'`)]*/gi)) {
    const url = m[0];
    if (!url.startsWith('http')) continue;
    if (!ALLOWED.some((a) => url.startsWith(a))) problems.push(`${name}: чужой адрес ${url}`);
  }
  if (/<script[^>]+src="(https?:)?\/\//.test(text)) problems.push(`${name}: внешний скрипт`);
  if (/og:image|mc\.yandex|googletagmanager|gtag\(/.test(text)) problems.push(`${name}: превью или счётчик`);
}
for (const need of ['VKWebAppInit', 'VKWebAppStorageSet', 'VKWebAppStorageGet']) if (!all.includes(need)) problems.push(`нет ${need}`);
const kb = (n) => (n / 1024).toFixed(0);
console.log(`check:vk: ${files.length} файлов, код gzip ${kb(gz)} КБ`);
for (const p of problems) console.log(`  ✗ ${p}`);
if (problems.length) process.exit(1);
if (gz > 1024 * 1024) {
  console.log('  ✗ первая загрузка больше 1 МБ');
  process.exit(1);
}
console.log('check:vk: ok');
