// `npm run validate:content`: контент цел — события (поля, возраст, варианты, род), условия душ разбираются, метки указывают на события,
// данные: 50+ стран и ≥ 85 % рождений, 7 эпох с источниками; название игры только в content/brand.json.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { content } from '../src/core/data.ts';
import { condition } from '../src/core/conditions.ts';
import { SCALE_KEYS } from '../src/core/types.ts';

const root = resolve(import.meta.dirname, '..');
const problems: string[] = [];
const bad = (text: string): number => problems.push(text);

const GENDER_OPEN = /\{m:/g;
const GENDER_FULL = /\{m:[^|{}]*\|f:[^{}]*\}/g;
function checkText(where: string, text: string, vars: string[] = []): void {
  if (!text || !text.trim()) bad(`${where}: пустой текст`);
  const open = (text.match(GENDER_OPEN) ?? []).length;
  const full = (text.match(GENDER_FULL) ?? []).length;
  if (open !== full) bad(`${where}: шаблон рода сломан — «${text}»`);
  const rest = text.replace(GENDER_FULL, '');
  for (const m of rest.matchAll(/\{([a-z_]+)\}/g)) if (!vars.includes(m[1]!)) bad(`${where}: неизвестная подстановка {${m[1]}}`);
  if (/[{}]/.test(rest.replace(/\{[a-z_]+\}/g, ''))) bad(`${where}: лишняя скобка — «${text}»`);
}

const events = [...content.worldEvents, ...content.russiaEvents];
const ids = new Set<string>();
for (const e of events) {
  const w = `событие ${e.id}`;
  if (ids.has(e.id)) bad(`${w}: повтор id`);
  ids.add(e.id);
  if (e.age.length !== 2 || e.age[0]! > e.age[1]! || e.age[0]! < 0 || e.age[1]! > 110) bad(`${w}: возраст ${e.age}`);
  if (!(e.weight > 0)) bad(`${w}: вес`);
  checkText(w, e.text);
  if (e.decision) {
    if (e.choices.length < 2 || e.choices.length > 3) bad(`${w}: вариантов ${e.choices.length}, нужно 2–3`);
    for (const c of e.choices) {
      checkText(`${w} вариант`, c.label);
      checkText(`${w} итог`, c.result);
      for (const k of SCALE_KEYS) if (typeof c.effect[k] !== 'number') bad(`${w}: у варианта нет ${k}`);
    }
  } else {
    for (const k of SCALE_KEYS) if (typeof e.effect?.[k] !== 'number') bad(`${w}: нет effect.${k}`);
  }
  if (e.id.startsWith('ru-')) {
    if (!e.era?.length) bad(`${w}: нет эпохи`);
    if (e.years && e.era && !e.era.some((era) => e.years![1]! >= era + e.age[0]! && e.years![0]! <= era + 9 + e.age[1]!)) bad(`${w}: годы ${e.years} не сходятся с эпохой и возрастом`);
  }
}
if (events.length < 120) bad(`событий ${events.length}, нужно 120+`);
for (const id of Object.keys(content.tags)) if (!ids.has(id)) bad(`event-tags: нет события ${id}`);

for (const p of content.pauses) {
  checkText(`пауза ${p.age}`, p.question);
  if (p.answers.length < 2 || p.answers.length > 3) bad(`пауза ${p.age}: ответов ${p.answers.length}`);
}
for (const age of [5, 15, 30, 50, 70]) if (!content.pauses.some((p) => p.age === age)) bad(`нет паузы в ${age}`);

const soul = content.soul;
for (const t of soul.traits) condition(t.trigger), checkText(`черта ${t.id}`, t.name);
for (const e of [...soul.epitaphs, ...soul.cardQuotes]) {
  try {
    condition(e.when);
  } catch (err) {
    bad(String((err as Error).message));
  }
  checkText('эпитафия/цитата', e.text);
}
if (soul.traits.length < 8) bad(`черт ${soul.traits.length}, нужно 8–10`);
const SHARE_VARS = ['place', 'era', 'age', 'years', 'cause', 'soul', 'life', 'trait', 'tag'];
for (const t of [...soul.shareTexts.death, ...soul.shareTexts.birth]) checkText('текст поста', t, SHARE_VARS);
for (const t of [...soul.soulLines.life, ...soul.soulLines.remembered]) checkText('строка души', t, SHARE_VARS);
for (const [k, list] of Object.entries(soul.deathCauses)) for (const t of list) checkText(`причина ${k}`, t);
for (const k of ['infancy', 'youth', 'adult', 'old', 'war', 'famine', 'accident', 'illness']) if (!soul.deathCauses[k]?.length) bad(`нет причин смерти ${k}`);

const w = content.world;
if (w.countries.length < 50) bad(`стран ${w.countries.length}, нужно 50+`);
const share = w.countries.reduce((s, c) => s + c.birthShare, 0);
if (share < 0.85) bad(`доля рождений 50 стран ${share.toFixed(3)}, нужно ≥ 0,85`);
const total = share + w.otherByRegion.reduce((s, g) => s + g.birthShare, 0);
if (Math.abs(total - 1) > 0.01) bad(`доли рождений в сумме ${total.toFixed(3)}`);
for (const c of w.countries) {
  if (!content.countryNames[c.iso2]) bad(`нет русского названия ${c.iso2}`);
  if (!(c.lifeExp > 40 && c.lifeExp < 90) || !(c.infantMort >= 0)) bad(`данные ${c.iso2}`);
}
for (const g of w.otherByRegion) if (!(content.life.regions as Record<string, string>)[g.group.trim()]) bad(`нет названия региона ${g.group}`);
if (content.eras.length !== 7) bad(`эпох ${content.eras.length}, нужно 7`);
for (const e of content.eras as unknown as Array<{ year: number; sources?: string[] }>) if (!e.sources?.length) bad(`эпоха ${e.year}: нет источников`);

// Название — в одном месте.
const title = content.brand.title;
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
for (const file of [...walk(resolve(root, 'src')), ...walk(resolve(root, 'content')), resolve(root, 'index.html')]) {
  if (file.endsWith('brand.json')) continue;
  if (readFileSync(file, 'utf8').includes(title)) bad(`название «${title}» вне content/brand.json: ${file.slice(root.length + 1)}`);
}

if (problems.length) {
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log(`validate:content: ${problems.length} проблем`);
  process.exit(1);
}
console.log(`validate:content: ok — событий ${events.length}, стран ${w.countries.length} (${(share * 100).toFixed(1)} % рождений), эпох ${content.eras.length}`);
