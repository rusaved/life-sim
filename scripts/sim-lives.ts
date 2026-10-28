// `npm run sim:lives`: бот проживает жизни со случайными выборами и сверяет возраст смерти с данными мест рождения.
//   --n <число>   жизней на режим (по умолчанию 200)
//   --report      записать отчёт в docs/evidence/LS1/sim-lives.md
// Красный выход, если средний возраст смерти уходит от ожидаемого больше чем на 4 года, если жизнь зависла или бросила ошибку.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeBirth } from '../src/core/birth.ts';
import { FOCUS, choose, mainEvents, pendingCrossroad, pendingEvent, pendingPause, setFocus, startLife, step, type FocusId } from '../src/core/life.ts';
import { makeRng, newSeed, next, type Mode } from '../src/core/rng.ts';
import { newSoul, rememberLife, soulBias, summarize, type Soul } from '../src/core/soul.ts';

const args = process.argv.slice(2);
const nIndex = args.indexOf('--n');
const N = nIndex >= 0 ? Number(args[nIndex + 1]) : 200;
const TOLERANCE = 4;
const rng = makeRng('sim-lives-2026');
const random = (): number => next(rng);

interface Stat {
  ages: number[];
  expected: number[];
  decisions: number[];
  longDecisions: number[];
  events: number[];
  causes: Map<string, number>;
  traits: Map<string, number>;
  health: number[];
  byEra: Map<string, { ages: number[]; expected: number[] }>;
}

function run(mode: Mode): Stat {
  const st: Stat = { ages: [], expected: [], decisions: [], longDecisions: [], events: [], causes: new Map(), traits: new Map(), health: [], byEra: new Map() };
  let soul: Soul = newSoul(random);
  soul.inclination = 'open-heart';
  for (let i = 0; i < N; i++) {
    const birth = makeBirth(newSeed(mode, random));
    const life = startLife(birth, soulBias(soul));
    let guard = 0;
    while (!life.death) {
      if (++guard > 400) throw new Error(`жизнь ${birth.seed} не кончается`);
      if (life.age % 10 === 6 && random() < 0.5) setFocus(life, FOCUS[Math.floor(random() * FOCUS.length)]!.id as FocusId);
      const e = pendingEvent(life);
      const p = pendingPause(life);
      const c = pendingCrossroad(life);
      if (c) choose(life, Math.floor(random() * c.options.length));
      else if (e) choose(life, Math.floor(random() * e.choices.length));
      else if (p) choose(life, Math.floor(random() * p.answers.length));
      else {
        st.health.push(life.scales.health);
        step(life);
      }
    }
    const s = summarize(life, soul);
    mainEvents(life);
    soul = rememberLife(soul, life, s);
    st.ages.push(life.death.age);
    st.expected.push(birth.lifeExp);
    st.decisions.push(life.decisions);
    if (life.death.age >= 60) st.longDecisions.push(life.decisions);
    st.events.push(life.log.filter((x) => x.kind !== 'quiet').length);
    st.causes.set(life.death.cause, (st.causes.get(life.death.cause) ?? 0) + 1);
    st.traits.set(s.trait.name, (st.traits.get(s.trait.name) ?? 0) + 1);
    const key = mode === 'russia' ? String(birth.era) : birth.lifeExp < 65 ? 'до 65' : birth.lifeExp < 75 ? '65–75' : 'от 75';
    const g = st.byEra.get(key) ?? { ages: [], expected: [] };
    g.ages.push(life.death.age);
    g.expected.push(birth.lifeExp);
    st.byEra.set(key, g);
  }
  return st;
}

const mean = (a: number[]): number => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const f1 = (x: number): string => x.toFixed(1);
const top = (m: Map<string, number>): string =>
  [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');

const lines: string[] = [`# Бот жизней: возраст смерти против данных`, '', `${N} жизней на режим, случайные выборы, \`npm run sim:lives -- --n ${N} --report\`. Сравнение: средний возраст смерти + 0,5 года (смерть в течение года) против средней ожидаемой длины жизни мест рождения, допуск ±${TOLERANCE} года`, ''];
let ok = true;
for (const mode of ['world', 'russia'] as Mode[]) {
  const st = run(mode);
  const got = mean(st.ages) + 0.5;
  const want = mean(st.expected);
  const pass = Math.abs(got - want) <= TOLERANCE;
  if (!pass) ok = false;
  lines.push(`## ${mode === 'world' ? 'Мир' : 'Россия и эпохи'}: ${pass ? 'сходится' : 'НЕ сходится'}`);
  lines.push(`- Возраст смерти в среднем ${f1(got)}, по данным ${f1(want)} (разница ${f1(got - want)})`);
  for (const [k, g] of [...st.byEra.entries()].sort()) lines.push(`  - ${k}: ${g.ages.length} жизней, ${f1(mean(g.ages) + 0.5)} против ${f1(mean(g.expected))}`);
  lines.push(`- Решений за жизнь: в среднем ${f1(mean(st.decisions))}, у доживших до 60 — ${f1(mean(st.longDecisions))}`);
  lines.push(`- Событий за жизнь в среднем ${f1(mean(st.events))}; здоровье в среднем за прожитые годы ${f1(mean(st.health))}`);
  lines.push(`- Причины: ${top(st.causes)}`);
  lines.push(`- Черты: ${top(st.traits)}`, '');
  console.log(`sim:lives ${mode}: смерть ${f1(got)} против ${f1(want)}, решений ${f1(mean(st.decisions))} (до 60+: ${f1(mean(st.longDecisions))}), здоровье ${f1(mean(st.health))} — ${pass ? 'ok' : 'FAIL'}`);
}
if (args.includes('--report')) {
  const dir = resolve(import.meta.dirname, '../docs/evidence/LS1');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'sim-lives.md'), lines.join('\n') + '\n');
}
if (!ok) process.exit(1);
