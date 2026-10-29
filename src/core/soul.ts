// Что: душа между жизнями — номер, склонность, черты (складываются и слегка сдвигают шансы), строки прожитых жизней;
// итог жизни: причина смерти, эпитафия, цитата карточки, черта, текст поста.
// Кто зовёт: интерфейс, scripts/sim-lives.ts, tests/soul.test.ts.
// Держать: всё из готовых фраз content/soul.json, без свободного текста.

import { condition, type LifeFacts } from './conditions.ts';
import { content, type Trait } from './data.ts';
import { eraName, placeName } from './birth.ts';
import type { Life, LifeOptions } from './life.ts';
import { makeRng, pick, weighted, type Rng } from './rng.ts';
import { agePair, capitalize, fill, gender, yearsGen } from './text.ts';
import { SCALE_KEYS, type Scales } from './types.ts';

export interface LifeLine {
  seed: string;
  place: string;
  era: string;
  age: number;
  trait: string;
  /** Пол прожитой жизни — для рода в строке. */
  sex: 'm' | 'f';
  lifeShort: string;
}

export interface Soul {
  no: number;
  inclination: string | null;
  /** Черты по порядку получения; повтор — черта стала сильнее. */
  traits: string[];
  lives: LifeLine[];
  /** Что было в прошлой жизни (события, паузы, вопросы перекрёстков) через пробел — следующая жизнь их не повторяет. */
  prev?: string;
}

/** Строк о жизнях в сохранении — последние; душа помнит их число полностью в lifeCount. */
export const MAX_LINES = 24;

export function newSoul(random: () => number = Math.random): Soul {
  return { no: 1000 + Math.floor(random() * 9000), inclination: null, traits: [], lives: [] };
}

export function traitById(id: string): Trait | undefined {
  return content.soul.traits.find((t) => t.id === id);
}

/** Сдвиг шансов души: склонность целиком, каждая черта — до трёх раз. Предел ±8 на шкалу. */
export function soulBias(soul: Soul): Scales {
  const bias: Scales = { health: 0, happiness: 0, knowledge: 0, bonds: 0 };
  const inc = content.soul.inclinations.find((i) => i.id === soul.inclination);
  const add = (b: Scales, k: number): void => {
    for (const key of SCALE_KEYS) bias[key] += b[key] * k;
  };
  if (inc) add(inc.bias, 1);
  const counts = traitCounts(soul);
  for (const [id, n] of counts) {
    const t = traitById(id);
    if (t) add(t.bias, Math.min(3, n) * 0.5);
  }
  for (const key of SCALE_KEYS) bias[key] = Math.max(-8, Math.min(8, Math.round(bias[key] * 10) / 10));
  return bias;
}

export function traitCounts(soul: Soul): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of soul.traits) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

export function factsOf(life: Life): LifeFacts {
  const f = life.flags;
  return {
    age: life.death?.age ?? life.age,
    scales: { ...life.scales },
    war: f.war,
    famine: f.famine,
    partner: f.partner,
    children: f.children,
    grandchildren: f.grandchildren,
    risky: f.risky,
    loss: f.loss,
    moves: f.moves,
  };
}

export interface LifeSummary {
  age: number;
  from: number;
  to: number;
  place: string;
  era: string;
  causeKey: string;
  cause: string;
  epitaph: string;
  quote: string;
  trait: Trait;
  lifeShort: string;
  remembered: string;
  lifeNo: number;
}

function lifeShortOf(f: LifeFacts): string {
  const t = content.life.lifeShort;
  if (f.age < 30) return t.short;
  if (f.scales.bonds >= 70) return t.warm;
  if (f.scales.knowledge >= 70) return t.wise;
  if (f.war || f.famine) return t.hard;
  if (f.age >= 80) return f.scales.happiness < 60 ? t.longQuiet : t.long;
  if (f.age >= 75) return t.long;
  return t.plain;
}

function chooseTrait(rng: Rng, soul: Soul, f: LifeFacts): Trait {
  const all = content.soul.traits;
  const met = all.filter((t) => condition(t.trigger)(f));
  const have = traitCounts(soul);
  if (met.length) return weighted(rng, met, (t) => (have.has(t.id) ? 1 : 3));
  // Ни одно условие не выполнено: черта по самой сильной шкале.
  const top = SCALE_KEYS.reduce((a, b) => (f.scales[b] > f.scales[a] ? b : a));
  const byScale: Record<string, string> = { health: 'long-breath', happiness: 'bright-gaze', knowledge: 'curiosity', bonds: 'warm-hands' };
  return traitById(byScale[top]!) ?? all[0]!;
}

/** Итог жизни: всё, что видит экран смерти и карточка. Душа не меняется — это делает rememberLife. */
export function summarize(life: Life, soul: Soul): LifeSummary {
  const death = life.death;
  if (!death) throw new Error('summarize: жизнь ещё идёт');
  const rng = makeRng(`${life.birth.seed}:${life.actions.length}:end`);
  const f = factsOf(life);
  const sex = life.birth.sex;
  const causes = content.soul.deathCauses[death.cause] ?? content.soul.deathCauses.old!;
  const eps = content.soul.epitaphs.filter((e) => condition(e.when)(f));
  const quotes = content.soul.cardQuotes.filter((q) => condition(q.when)(f));
  const trait = chooseTrait(rng, soul, f);
  const remembered = fill(pick(rng, content.soul.soulLines.remembered), { trait: trait.name.toLowerCase() });
  return {
    age: death.age,
    from: life.birth.year,
    to: life.birth.year + death.age,
    place: placeName(life.birth, life.place),
    era: eraName(life.birth),
    causeKey: death.cause,
    cause: capitalize(gender(pick(rng, causes), sex)),
    epitaph: gender(eps.length ? pick(rng, eps).text : content.life.epitaphFallback, sex),
    quote: gender(quotes.length ? pick(rng, quotes).text : content.life.epitaphFallback, sex),
    trait,
    lifeShort: lifeShortOf(f),
    remembered,
    lifeNo: lifeCount(soul) + 1,
  };
}

export function lifeCount(soul: Soul): number {
  return soul.traits.length;
}

/** Душа запоминает жизнь: черта, строка мемориала и что было в этой жизни (чтобы следующая не повторяла). */
export function rememberLife(soul: Soul, life: Life, s: LifeSummary): Soul {
  const line: LifeLine = { seed: life.birth.seed, place: s.place, era: s.era, age: s.age, trait: s.trait.id, sex: life.birth.sex, lifeShort: s.lifeShort };
  return { ...soul, traits: [...soul.traits, s.trait.id], lives: [...soul.lives, line].slice(-MAX_LINES), prev: life.used.join(' ') };
}

/** Что следующая жизнь берёт от души; до смерти душа не меняется, поэтому «Продолжить» повторяет жизнь точно. */
export function lifeOptions(soul: Soul): LifeOptions {
  return { firstLife: lifeCount(soul) === 0, avoid: soul.prev ? soul.prev.split(' ') : [] };
}

/** Строка мемориала: «Россия, село, 1940-е, 71 год». */
export function lifeLineText(line: LifeLine, index: number): string {
  // Одна форма для всех строк мемориала: так список читается ровно.
  const tpl = content.soul.soulLines.life[0]!;
  void index;
  return capitalize(gender(fill(tpl, { place: line.place, era: line.era, ...agePair(line.age), life: line.lifeShort }), line.sex));
}

/** Черты души для показа: имя и сила (×2, ×3). */
export function traitList(soul: Soul): Array<{ trait: Trait; count: number }> {
  const out: Array<{ trait: Trait; count: number }> = [];
  for (const [id, count] of traitCounts(soul)) {
    const trait = traitById(id);
    if (trait) out.push({ trait, count });
  }
  return out.sort((a, b) => b.count - a.count);
}

/** Текст поста от первого лица после смерти; ссылка добавляется отдельно. */
export function deathPost(life: Life, s: LifeSummary, variant: number): string {
  let list = content.soul.shareTexts.death;
  if (s.age < 1) list = list.filter((t) => !t.includes('до {age}'));
  // «до 91 года», «до 87 лет»: после «до» — родительный падеж.
  const tpl = list[variant % list.length]!.replace('до {age} {years}', 'до {age} {gen}');
  const gen = yearsGen(s.age);
  const vars = { gen, place: s.place, era: s.era, ...agePair(s.age), cause: s.cause, soul: s.trait.name.toLowerCase(), life: s.lifeShort, trait: s.trait.name, tag: content.brand.hashtag };
  return capitalize(gender(fill(tpl, vars), life.birth.sex));
}

export function birthPost(life: Life, variant: number): string {
  const list = content.soul.shareTexts.birth;
  const tpl = list[variant % list.length]!;
  return capitalize(gender(fill(tpl, { place: placeName(life.birth), era: eraName(life.birth), tag: content.brand.hashtag }), life.birth.sex));
}
