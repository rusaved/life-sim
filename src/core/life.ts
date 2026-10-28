// Что: ядро одной жизни — год за годом: шкалы плывут, случай решает, жив ли человек, приходят события, решения, паузы и семья.
// Кто зовёт: интерфейс (src/ui/life-screen.ts), scripts/sim-lives.ts (бот), tests/life.test.ts.
// Держать: чистая логика без DOM; всё, что сделал игрок, пишется в actions — по ним жизнь повторяется точно (сохранение, «Продолжить»).

import { content, eventTags, type Pause } from './data.ts';
import { calibrateAging, hardYear, hazard, personalFactor } from './mortality.ts';
import { makeRng, next, pick, weighted, type Rng } from './rng.ts';
import { gender } from './text.ts';
import { SCALE_KEYS, type Birth, type GameEvent, type Place, type Scales } from './types.ts';

export type FocusId = 'study' | 'work' | 'family' | 'health';
export const PAUSE_AGES = [5, 15, 30, 50, 70];

export interface LogEntry {
  age: number;
  year: number;
  kind: 'event' | 'decision' | 'family' | 'pause' | 'quiet' | 'death';
  text: string;
  result?: string;
  /** Насколько событие важно для итога жизни. */
  weight: number;
}

export type Pending = { kind: 'event'; id: string } | { kind: 'pause'; index: number } | { kind: 'crossroad'; age: number };

export interface LifeFlags {
  partner: boolean;
  children: number;
  grandchildren: boolean;
  war: boolean;
  famine: boolean;
  loss: boolean;
  love: boolean;
  risky: number;
  moves: number;
}

export interface Life {
  birth: Birth;
  bias: Scales;
  agingBase: number;
  rng: Rng;
  age: number;
  place: Place;
  scales: Scales;
  focus: FocusId | null;
  used: string[];
  flags: LifeFlags;
  decisions: number;
  log: LogEntry[];
  pending: Pending | null;
  /** Запись действий: y — прожит год, 0–2 — выбран вариант, S/W/F/H — направление года. */
  actions: string;
  death: { age: number; cause: string } | null;
}

const FOCUS_CODE: Record<FocusId, string> = { study: 'S', work: 'W', family: 'F', health: 'H' };
const CODE_FOCUS: Record<string, FocusId> = { S: 'study', W: 'work', F: 'family', H: 'health' };

interface FocusRule {
  id: FocusId;
  name: string;
  from: number;
  effect: Partial<Scales>;
}
export const FOCUS = content.life.focus as FocusRule[];

interface CrossroadOption {
  label: string;
  result: string;
  effect: Partial<Scales>;
}
const CROSSROADS = content.life.crossroads as { ages: number[]; questions: Record<string, string>; options: Record<FocusId, CrossroadOption> };

/** Перекрёсток: вопрос о ближайших годах и варианты-направления (работа — с 14 лет). */
export function pendingCrossroad(life: Life): { question: string; options: Array<{ focus: FocusId } & CrossroadOption> } | null {
  if (life.pending?.kind !== 'crossroad') return null;
  const age = life.pending.age;
  return {
    question: CROSSROADS.questions[String(age)] ?? '',
    options: FOCUS.filter((f) => age >= f.from).map((f) => ({ focus: f.id, ...CROSSROADS.options[f.id] })),
  };
}

const ALL_EVENTS = new Map<string, { event: GameEvent; russia: boolean }>();
for (const e of content.worldEvents) ALL_EVENTS.set(e.id, { event: e, russia: false });
for (const e of content.russiaEvents) ALL_EVENTS.set(e.id, { event: e, russia: true });

export function eventById(id: string): GameEvent | undefined {
  return ALL_EVENTS.get(id)?.event;
}

const clamp = (v: number): number => Math.max(0, Math.min(100, v));

function clampAll(s: Scales): void {
  for (const k of SCALE_KEYS) s[k] = clamp(s[k]);
}

function addEffect(s: Scales, effect: Partial<Scales> | undefined, k = 1): void {
  if (!effect) return;
  for (const key of SCALE_KEYS) s[key] += (effect[key] ?? 0) * k;
  clampAll(s);
}

function effectWeight(effect: Partial<Scales> | undefined): number {
  if (!effect) return 0;
  return SCALE_KEYS.reduce((sum, k) => sum + Math.abs(effect[k] ?? 0), 0);
}

export function startLife(birth: Birth, bias: Scales): Life {
  const wealthHealth = birth.wealth === 'poor' ? -6 : birth.wealth === 'rich' ? 5 : 0;
  const scales: Scales = {
    health: 62 + wealthHealth + bias.health * 2,
    happiness: 55 + bias.happiness * 2,
    knowledge: 12 + (birth.literacy - 60) / 8 + bias.knowledge * 2,
    bonds: 50 + bias.bonds * 2,
  };
  clampAll(scales);
  return {
    birth,
    bias,
    agingBase: calibrateAging(birth),
    rng: makeRng(`${birth.seed}:life`),
    age: 0,
    place: birth.place,
    scales,
    focus: null,
    used: [],
    flags: { partner: false, children: 0, grandchildren: false, war: false, famine: false, loss: false, love: false, risky: 0, moves: 0 },
    decisions: 0,
    log: [],
    pending: null,
    actions: '',
    death: null,
  };
}

export const yearOf = (life: Life): number => life.birth.year + life.age;

function log(life: Life, kind: LogEntry['kind'], text: string, weight: number, result?: string): void {
  const entry: LogEntry = { age: life.age, year: yearOf(life), kind, text: gender(text, life.birth.sex), weight };
  if (result) entry.result = gender(result, life.birth.sex);
  life.log.push(entry);
}

function drift(life: Life): void {
  const s = life.scales;
  const a = life.age;
  const b = life.birth;
  for (const k of SCALE_KEYS) s[k] += life.bias[k] * 0.04;
  if (a < 25) s.health += (72 - s.health) * 0.08;
  else if (a < 45) s.health += (64 - s.health) * 0.04;
  else s.health -= 0.25 + (a - 45) * 0.03;
  if (b.wealth === 'poor') s.health -= 0.15;
  if (b.wealth === 'rich') s.health += 0.15;
  s.happiness += (55 - s.happiness) * 0.06;
  if (a >= 6 && a <= 17) s.knowledge += (1.4 * b.literacy) / 100 + (b.wealth === 'rich' ? 0.3 : 0);
  else if (a >= 18 && a < 70) s.knowledge += 0.15;
  else if (a >= 78) s.knowledge -= 0.3;
  s.bonds += (45 - s.bonds) * 0.04 + (life.flags.partner ? 0.5 : 0) + (life.flags.children ? 0.3 : 0);
  const rule = life.focus ? FOCUS.find((f) => f.id === life.focus) : undefined;
  if (rule && a >= rule.from) addEffect(s, rule.effect);
  clampAll(s);
}

function causeOf(life: Life, parts: Record<string, number>): string {
  const key = weighted(life.rng, Object.keys(parts), (k) => parts[k] ?? 0);
  const a = life.age;
  if (key === 'infancy' || a < 5) return 'infancy';
  if (key === 'war' || key === 'famine') return key;
  if (key === 'accident') return a < 65 ? 'accident' : 'old';
  if (a < 25) return 'youth';
  if (a < 60) return next(life.rng) < 0.5 ? 'adult' : 'illness';
  return next(life.rng) < 0.7 ? 'old' : 'illness';
}

function eligible(life: Life, id: string, item: { event: GameEvent; russia: boolean }): boolean {
  const e = item.event;
  const b = life.birth;
  const a = life.age;
  const year = yearOf(life);
  if (life.used.includes(id)) return false;
  if (a < e.age[0]! || a > e.age[1]!) return false;
  if (!e.where.includes('any') && !e.where.includes(life.place)) return false;
  if (!e.wealth.includes('any') && !e.wealth.includes(b.wealth)) return false;
  if (item.russia) {
    if (b.mode !== 'russia' || b.era === null || !e.era?.includes(b.era)) return false;
    if (e.years && (year < e.years[0]! || year > e.years[1]!)) return false;
  }
  const t = eventTags(id);
  if (t.modern && b.mode === 'russia' && year < 1995) return false;
  const has = (need: string): boolean => (need === 'partner' ? life.flags.partner : need === 'child' ? life.flags.children > 0 : false);
  if (t.needs?.some((n) => !has(n))) return false;
  if (t.needsNo?.some((n) => has(n))) return false;
  return true;
}

function pickEvent(life: Life, decisionOnly: boolean): GameEvent | null {
  const pool: Array<{ event: GameEvent; russia: boolean }> = [];
  for (const [id, item] of ALL_EVENTS) if ((!decisionOnly || item.event.decision) && eligible(life, id, item)) pool.push(item);
  if (!pool.length) return null;
  const russiaMode = life.birth.mode === 'russia';
  return weighted(life.rng, pool, (x) => x.event.weight * (x.event.decision ? 2 : 1) * (russiaMode && !x.russia ? 0.5 : 1)).event;
}

function applyTags(life: Life, list: string[] | undefined): void {
  for (const t of list ?? []) {
    if (t === 'partner') life.flags.partner = true;
    if (t === 'child') life.flags.children += 1;
    if (t === 'loss') life.flags.loss = true;
    if (t === 'loseP') life.flags.partner = false;
    if (t === 'war') life.flags.war = true;
    if (t === 'famine') life.flags.famine = true;
    if (t === 'love') life.flags.love = true;
    if (t === 'move') life.flags.moves += 1;
    if (t === 'toCity' && life.place === 'village') life.place = 'city';
  }
}

function familyYear(life: Life): boolean {
  const f = life.flags;
  const a = life.age;
  const familyFocus = life.focus === 'family' ? 1 : 0;
  const texts = content.life.family;
  if (!f.partner && a >= 18 && a <= 45) {
    const p = 0.04 + (life.scales.bonds / 100) * 0.08 + familyFocus * 0.06 + (f.love ? 0.06 : 0) - (a > 35 ? 0.03 : 0);
    if (next(life.rng) < p) {
      f.partner = true;
      addEffect(life.scales, { happiness: 6, bonds: 8 });
      log(life, 'family', pick(life.rng, texts.partner), 22);
      return true;
    }
  }
  if (f.partner && a >= 20 && a <= (life.birth.sex === 'f' ? 42 : 50) && f.children < 3) {
    const p = f.children === 0 ? 0.16 + familyFocus * 0.05 : 0.06 + familyFocus * 0.03;
    if (next(life.rng) < p) {
      addEffect(life.scales, { happiness: 6, bonds: 7, health: -1 });
      log(life, 'family', pick(life.rng, f.children === 0 ? texts.child : texts.nextChild), f.children === 0 ? 22 : 12);
      f.children += 1;
      return true;
    }
  }
  if (f.children > 0 && !f.grandchildren && a >= 48 && next(life.rng) < 0.08) {
    f.grandchildren = true;
    addEffect(life.scales, { happiness: 5, bonds: 5 });
    log(life, 'family', pick(life.rng, texts.grandchild), 16);
    return true;
  }
  return false;
}

function quietLine(life: Life): string {
  const q = content.life.quiet;
  const a = life.age;
  return pick(life.rng, a < 13 ? q.child : a < 30 ? q.young : a < 60 ? q.adult : q.old);
}

/** Один год жизни; ничего не делает, пока ждёт ответа или жизнь закончилась. */
export function step(life: Life): void {
  if (life.pending || life.death) return;
  life.actions += 'y';
  const a = life.age;
  const year = yearOf(life);
  if (life.birth.mode === 'russia' && a >= 3) {
    const h = hardYear(year);
    if (h.war) life.flags.war = true;
    if (h.famine) life.flags.famine = true;
  }
  drift(life);
  const parts = hazard(life.birth, life.agingBase, a);
  const factor = a === 0 ? 1 : personalFactor(life.scales.health, life.birth.wealth);
  const adjusted = { infancy: parts.infancy, accident: parts.accident * factor, aging: parts.aging * factor, war: parts.war * Math.sqrt(factor), famine: parts.famine * Math.sqrt(factor) };
  const total = Object.values(adjusted).reduce((x, y) => x + y, 0);
  if (next(life.rng) < 1 - Math.exp(-total)) {
    life.death = { age: a, cause: causeOf(life, adjusted) };
    return;
  }
  if (PAUSE_AGES.includes(a)) {
    const options = content.pauses.map((p, i) => ({ p, i })).filter((x) => x.p.age === a);
    if (options.length) {
      life.pending = { kind: 'pause', index: pick(life.rng, options).i };
      return;
    }
  }
  if (CROSSROADS.ages.includes(a)) {
    life.pending = { kind: 'crossroad', age: a };
    return;
  }
  if (!familyYear(life)) {
    const forceDecision = life.decisions === 0 && a >= 1;
    const chance = a === 0 ? 0.5 : a <= 40 ? 0.9 : 0.8;
    const event = forceDecision || next(life.rng) < chance ? pickEvent(life, forceDecision) : null;
    if (event) {
      life.used.push(event.id);
      if (event.decision && event.choices.length) {
        life.pending = { kind: 'event', id: event.id };
        return;
      }
      addEffect(life.scales, event.effect);
      applyTags(life, eventTags(event.id).gives);
      log(life, 'event', event.text, effectWeight(event.effect) + (eventTags(event.id).gives?.length ? 10 : 0));
    } else if (next(life.rng) < 0.35) {
      log(life, 'quiet', quietLine(life), 0);
    }
  }
  life.age += 1;
}

export function pendingEvent(life: Life): GameEvent | null {
  return life.pending?.kind === 'event' ? (eventById(life.pending.id) ?? null) : null;
}

export function pendingPause(life: Life): Pause | null {
  return life.pending?.kind === 'pause' ? (content.pauses[life.pending.index] ?? null) : null;
}

/** Ответ на решение или паузу; после него год заканчивается. */
export function choose(life: Life, index: number): void {
  const p = life.pending;
  if (!p) return;
  if (p.kind === 'event') {
    const e = eventById(p.id);
    const c = e?.choices[index];
    if (!e || !c) return;
    life.actions += String(index);
    addEffect(life.scales, c.effect);
    const tags = eventTags(e.id);
    applyTags(life, tags.gives);
    applyTags(life, tags.choices?.[String(index)]);
    if ((c.effect.health ?? 0) <= -3) life.flags.risky += 1;
    life.decisions += 1;
    life.pending = null;
    log(life, 'decision', e.text, effectWeight(c.effect) + 4 + (tags.gives?.length ? 10 : 0), c.result);
  } else if (p.kind === 'crossroad') {
    const option = pendingCrossroad(life)?.options[index];
    if (!option) return;
    life.actions += String(index);
    life.focus = option.focus;
    addEffect(life.scales, option.effect);
    life.decisions += 1;
    life.pending = null;
    log(life, 'decision', CROSSROADS.questions[String(p.age)] ?? '', 5, option.result);
  } else {
    const pause = content.pauses[p.index];
    const answer = pause?.answers[index];
    if (!pause || !answer) return;
    life.actions += String(index);
    addEffect(life.scales, { happiness: 2, knowledge: 1 });
    life.pending = null;
    log(life, 'pause', pause.question, 8, answer);
  }
  life.age += 1;
}

export function setFocus(life: Life, focus: FocusId): void {
  if (life.focus === focus || life.death) return;
  life.focus = focus;
  life.actions += FOCUS_CODE[focus];
}

/** Повтор жизни по записи действий: тот же результат до последнего шага. */
export function replay(birth: Birth, bias: Scales, actions: string): Life {
  const life = startLife(birth, bias);
  for (const ch of actions) {
    if (ch === 'y') step(life);
    else if (CODE_FOCUS[ch]) setFocus(life, CODE_FOCUS[ch]);
    else choose(life, Number(ch));
  }
  return life;
}

/** До шести главных событий жизни по времени. */
export function mainEvents(life: Life, n = 6): LogEntry[] {
  return life.log
    .filter((e) => e.kind !== 'quiet' && e.weight > 0)
    // Выборы игрока и семья важнее случившегося само по себе.
    .map((e, i) => ({ e, i, w: e.weight * (e.kind === 'event' ? 0.6 : 1) }))
    .sort((x, y) => y.w - x.w || x.i - y.i)
    .slice(0, n)
    .sort((x, y) => x.i - y.i)
    .map((x) => x.e);
}
