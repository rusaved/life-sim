// `npm run build:pages`: ссылка продюсера на GitHub Pages — сайт в корне dist-pages/ (метка сборки, og:image) и сборка VK и ОК
// в dist-pages/vk/ (?mock=vk — заглушка моста в обычной вкладке).
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const run = (args) => {
  const r = spawnSync('npx', ['vite', 'build', ...args], { cwd: root, stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run(['--mode', 'pages', '--outDir', 'dist-pages', '--emptyOutDir']);
run(['--mode', 'vk', '--outDir', 'dist-pages/vk', '--emptyOutDir']);
writeFileSync(resolve(root, 'dist-pages/.nojekyll'), '');
for (const f of ['index.html', 'og.png', 'vk/index.html']) {
  if (!existsSync(resolve(root, 'dist-pages', f))) {
    console.error(`build:pages: нет ${f}`);
    process.exit(1);
  }
}
console.log('build:pages: dist-pages готов (сайт в корне, vk/ рядом)');
