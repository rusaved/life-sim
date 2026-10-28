import { defineConfig, type Plugin } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

// Режимы сборки: development и pages — свой сайт (площадка null), vk и vk-dev — ВКонтакте и Одноклассники.
type Platform = 'null' | 'vk';
const MODES: Record<string, { platform: Platform; label: boolean }> = {
  development: { platform: 'null', label: false },
  production: { platform: 'null', label: false },
  pages: { platform: 'null', label: true },
  vk: { platform: 'vk', label: false },
  'vk-dev': { platform: 'vk', label: false },
};

const root = import.meta.dirname;
const readJson = <T>(file: string): T => JSON.parse(readFileSync(resolve(root, file), 'utf8')) as T;

function buildSha(): string {
  const sha = (process.env.BUILD_SHA || '').slice(0, 7);
  if (sha) return sha;
  try {
    return execSync('git rev-parse --short=7 HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'local';
  }
}

/** Метка: последняя веха, у которой все задачи прошли (иначе — текущая с пометкой «в работе»), дата, коммит. */
function buildLabel(): string {
  const file = resolve(root, 'feature_list.json');
  let code = 'LS0';
  if (existsSync(file)) {
    const list = readJson<{ milestones: Array<{ code: string }>; features: Array<{ milestone: string; passes: boolean }> }>('feature_list.json');
    for (const m of list.milestones) {
      const own = list.features.filter((f) => f.milestone === m.code);
      code = own.length && own.every((f) => f.passes) ? m.code : `${m.code} в работе`;
    }
  }
  return `${code} · ${new Date().toISOString().slice(0, 10)} · ${buildSha()}`;
}

/** index.html: название из content/brand.json; превью ссылки (og) — только на своём сайте, в vk/ внешних адресов нет. */
function htmlPlugin(platform: Platform): Plugin {
  return {
    name: 'life-html',
    transformIndexHtml(html) {
      const brand = readJson<{ title: string; tagline: string; siteUrl: string }>('content/brand.json');
      const og =
        platform === 'null'
          ? [
              `<meta property="og:type" content="website" />`,
              `<meta property="og:title" content="${brand.title}" />`,
              `<meta property="og:description" content="${brand.tagline}" />`,
              `<meta property="og:image" content="${brand.siteUrl}og.png" />`,
              `<meta property="og:image:width" content="1200" />`,
              `<meta property="og:image:height" content="630" />`,
              `<meta name="twitter:card" content="summary_large_image" />`,
              `<meta name="description" content="${brand.tagline}" />`,
            ].join('\n    ')
          : '';
      return html.replace(/%TITLE%/g, brand.title).replace('<!--OG-->', og);
    },
  };
}

/** Сборка VK и ОК: из данных content/ убираются заметки и адреса источников — в сборке нет ни одного чужого адреса. */
function vkContentPlugin(): Plugin {
  const contentDir = resolve(root, 'content');
  const DROP = new Set(['note', 'notes', 'sources', 'source', 'flags']);
  const strip = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(strip);
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).filter(([k]) => !DROP.has(k)).map(([k, v]) => [k, strip(v)]));
    return x;
  };
  return {
    name: 'vk-content',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0] ?? '';
      if (!file.startsWith(contentDir) || !file.endsWith('.json')) return null;
      return { code: JSON.stringify(strip(JSON.parse(code))), map: null };
    },
  };
}

export default defineConfig(({ mode }) => {
  const flags = MODES[mode] ?? MODES.production!;
  return {
    base: './',
    plugins: [htmlPlugin(flags.platform), ...(flags.platform === 'vk' ? [vkContentPlugin()] : [])],
    // og.png нужен только сайту: в vk/ папку public не кладём.
    publicDir: flags.platform === 'null' ? 'public' : false,
    define: {
      __BUILD_LABEL__: JSON.stringify(flags.label ? buildLabel() : ''),
      __PLATFORM__: JSON.stringify(flags.platform),
    },
    build: { target: 'es2022', sourcemap: false, assetsInlineLimit: 0, modulePreload: { polyfill: false } },
    server: { port: 5173, strictPort: false },
    preview: { port: 4173, strictPort: false },
  };
});
