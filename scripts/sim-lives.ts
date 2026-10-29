// `npm run sim:lives`: бот проживает жизни со случайными выборами и сверяет их с данными и правилами вехи.
//   --n <число>   жизней на режим (по умолчанию 500: у 200 разброс среднего возраста смерти в эпохах около 2 лет)
//   --report      записать отчёт в docs/evidence/LS2/sim-lives.md
// Красный выход, если: средний возраст смерти уходит от ожидаемого больше чем на 4 года; смерть до 2 лет по эпохам и группам стран
// уходит от данных больше чем на 3 п. п.; первая жизнь новой души не дошла до вопроса; жизнь кончилась без вопроса нулевого года;
// у первого года меньше 4 разных вопросов; вторая жизнь повторяет первую больше чем на 30 %; событие «Мира» пришло туда, где его
// не бывает (снег, метро, девятилетка); жизнь зависла или бросила ошибку.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeBirth } from '../src/core/birth.ts';
import { content } from '../src/core/data.ts';
import { FOCUS, choose, mainEvents, pendingCrossroad, pendingEvent, pendingPause, setFocus, startLife, step, type FocusId, type Life } from '../src/core/life.ts';
import { makeRng, newSeed, next, type Mode } from '../src/core/rng.ts';
import { lifeOptions, newSoul, rememberLife, soulBias, summarize, type Soul } from '../src/core/soul.ts';
import { landOf, textMismatch } from '../src/core/land.ts';
import type { Birth } from '../src/core/types.ts';

const args = process.argv.slice(2);
const nIndex = args.indexOf('--n');
const N = nIndex >= 0 ? Number(args[nIndex + 1]) : 500;
const TOLERANCE = 4;
const EARLY_TOLERANCE_PP = 3;
const REPEAT_MAX = 0.3;
const EARLY_PER_GROUP = 3000;
const rng = makeRng('sim-lives-2026');
const random = (): number => next(rng);

const mean = (a: number[]): number => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const f1 = (x: number): string => x.toFixed(1);
const pct = (x: number): string => `${(x * 100).toFixed(1)} %`;
const top = (m: Map<string, number>, n = 99): string =>
  [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
const inc = (m: Map<string, number>, k: string): void => void m.set(k, (m.get(k) ?? 0) + 1);

const lines: string[] = [`# Бот жизней: проверка против данных и правил`, '', `${N} жизней на режим, случайные выборы, \`npm run sim:lives -- --n ${N} --report\``, ''];
const fails: string[] = [];
const check = (ok: boolean, what: string): boolean => (ok || fails.push(what), ok);

/** Шаг бота: ответить на вопрос случайно или прожить год. Возвращает текст вопроса, если он был. */
function act(life: Life): string | null {
  const e = pendingEvent(life);
  const p = pendingPause(life);
  const c = pendingCrossroad(life);
  if (c) return choose(life, Math.floor(random() * c.options.length)), c.question;
  if (e) return choose(life, Math.floor(random() * e.choices.length)), e.text;
  if (p) return choose(life, Math.floor(random() * p.answers.length)), p.question;
  step(life);
  return null;
}

/** Что из жизни можно повторить: события и вопросы (без семьи и тихих лет). */
const repeatable = (life: Life): string[] => life.log.filter((x) => x.kind === 'event' || x.kind === 'decision' || x.kind === 'pause').map((x) => x.text);

interface Stat {
  ages: number[];
  expected: number[];
  decisions: number[];
  longDecisions: number[];
  events: number[];
  causes: Map<string, number>;
  traits: Map<string, number>;
  health: number[];
  byGroup: Map<string, { ages: number[]; expected: number[] }>;
  firstQuestions: Map<string, number>;
  noFirstQuestion: number;
  repeats: number[];
  landBad: string[];
}

function groupOf(b: Birth): string {
  return b.mode === 'russia' ? String(b.era) : b.lifeExp < 65 ? 'до 65' : b.lifeExp < 75 ? '65–75' : 'от 75';
}

function run(mode: Mode): Stat {
  const st: Stat = { ages: [], expected: [], decisions: [], longDecisions: [], events: [], causes: new Map(), traits: new Map(), health: [], byGroup: new Map(), firstQuestions: new Map(), noFirstQuestion: 0, repeats: [], landBad: [] };
  let soul: Soul = newSoul(random);
  soul.inclination = 'open-heart';
  let prevTexts: string[] | null = null;
  for (let i = 0; i < N; i++) {
    const birth = makeBirth(newSeed(mode, random));
    const life = startLife(birth, soulBias(soul), lifeOptions(soul));
    let first: string | null = null;
    for (let guard = 0; !life.death; guard++) {
      if (guard > 600) throw new Error(`жизнь ${birth.seed} не кончается`);
      if (life.age % 10 === 6 && !life.pending && random() < 0.5) setFocus(life, FOCUS[Math.floor(random() * FOCUS.length)]!.id as FocusId);
      if (!life.pending) st.health.push(life.scales.health);
      const age = life.age;
      const q = act(life);
      if (q && age === 0 && first === null) first = q;
    }
    if (first) inc(st.firstQuestions, first.slice(0, 40));
    else st.noFirstQuestion++;
    // Каждый прожитый текст против примет места: снег, метро, девятилетка, листопад в тропиках.
    for (const x of life.log) {
      // Место могло смениться переездом в город: не по месту — если не подходит ни родному месту, ни нынешнему.
      const text = `${x.text} ${x.result ?? ''}`;
      const why = textMismatch(text, landOf(birth, birth.place, x.year)) && textMismatch(text, landOf(birth, life.place, x.year));
      if (why) st.landBad.push(`${birth.seed} ${x.age}: ${why} — ${x.text.slice(0, 40)}`);
    }
    const texts = repeatable(life);
    if (prevTexts && texts.length) {
      const before = new Set(prevTexts);
      st.repeats.push(texts.filter((t) => before.has(t)).length / texts.length);
    }
    prevTexts = texts;
    const s = summarize(life, soul);
    mainEvents(life);
    soul = rememberLife(soul, life, s);
    st.ages.push(life.death!.age);
    st.expected.push(birth.lifeExp);
    st.decisions.push(life.decisions);
    if (life.death!.age >= 60) st.longDecisions.push(life.decisions);
    st.events.push(life.log.filter((x) => x.kind !== 'quiet').length);
    inc(st.causes, life.death!.cause);
    inc(st.traits, s.trait.name);
    const g = st.byGroup.get(groupOf(birth)) ?? { ages: [], expected: [] };
    g.ages.push(life.death!.age);
    g.expected.push(birth.lifeExp);
    st.byGroup.set(groupOf(birth), g);
  }
  return st;
}

/** Первые жизни новых душ: каждая доходит до вопроса (и до паузы в 5 лет). */
function firstLives(mode: Mode, n: number): { asked: number; pause5: number } {
  let asked = 0;
  let pause5 = 0;
  for (let i = 0; i < n; i++) {
    const soul = newSoul(random);
    soul.inclination = 'open-heart';
    const life = startLife(makeBirth(newSeed(mode, random)), soulBias(soul), lifeOptions(soul));
    let sawQuestion = false;
    for (let guard = 0; !life.death && life.age <= 6 && guard < 50; guard++) {
      if (life.pending) sawQuestion = true;
      if (pendingPause(life) && life.age === 5) pause5++;
      act(life);
    }
    if (sawQuestion) asked++;
  }
  return { asked, pause5: Math.min(pause5, n) };
}

/** Смерть до 2 лет: бот (не первая жизнь души) против данных — младенческая смертность и доля смертности 1–4 лет за второй год. */
function earlyDeaths(mode: Mode, perGroup: number): Array<{ group: string; got: number; want: number; n: number }> {
  const groups = new Map<string, { dead: number; want: number[]; n: number }>();
  const options = { firstLife: false, avoid: [] };
  for (let guard = 0; guard < perGroup * 400; guard++) {
    const birth = makeBirth(newSeed(mode, random));
    const key = mode === 'russia' ? String(birth.era) : birth.infantMort < 10 ? 'младенческая < 10 ‰' : birth.infantMort < 30 ? '10–30 ‰' : 'от 30 ‰';
    const g = groups.get(key) ?? { dead: 0, want: [], n: 0 };
    groups.set(key, g);
    if (g.n >= perGroup) {
      if ([...groups.values()].every((x) => x.n >= perGroup) && groups.size >= (mode === 'russia' ? content.eras.length : 3)) break;
      continue;
    }
    const life = startLife(birth, soulBias(newSoul(random)), options);
    for (let k = 0; !life.death && life.age < 2 && k < 20; k++) act(life);
    g.n++;
    if (life.death && life.death.age < 2) g.dead++;
    const m0 = birth.infantMort / 1000;
    const q14 = Math.min(0.9, birth.childMort / 1000 / (1 - m0));
    const q1 = 1 - Math.pow(1 - q14, 1 / 4);
    g.want.push(1 - (1 - m0) * (1 - q1));
  }
  return [...groups.entries()].sort().map(([group, g]) => ({ group, got: g.dead / g.n, want: mean(g.want), n: g.n }));
}

for (const mode of ['world', 'russia'] as Mode[]) {
  const name = mode === 'world' ? 'Мир' : 'Россия и эпохи';
  const st = run(mode);
  const got = mean(st.ages) + 0.5;
  const want = mean(st.expected);
  const pass = check(Math.abs(got - want) <= TOLERANCE, `${name}: возраст смерти ${f1(got)} против ${f1(want)}`);
  lines.push(`## ${name}`);
  lines.push(`- Возраст смерти в среднем ${f1(got)}, по данным ${f1(want)} (разница ${f1(got - want)}): ${pass ? 'сходится' : 'НЕ сходится'}`);
  for (const [k, g] of [...st.byGroup.entries()].sort()) lines.push(`  - ${k}: ${g.ages.length} жизней, ${f1(mean(g.ages) + 0.5)} против ${f1(mean(g.expected))}`);
  lines.push(`- Решений за жизнь: в среднем ${f1(mean(st.decisions))}, у доживших до 60 — ${f1(mean(st.longDecisions))}`);
  lines.push(`- Событий за жизнь в среднем ${f1(mean(st.events))}; здоровье в среднем за прожитые годы ${f1(mean(st.health))}`);
  lines.push(`- Причины: ${top(st.causes)}`);
  lines.push(`- Черты: ${top(st.traits)}`);

  check(st.noFirstQuestion === 0, `${name}: ${st.noFirstQuestion} жизней без вопроса нулевого года`);
  const firstTop = Math.max(...st.firstQuestions.values());
  check(st.firstQuestions.size >= 4, `${name}: у первого года ${st.firstQuestions.size} разных вопросов, нужно 4+`);
  lines.push(`- Вопрос нулевого года: у ${N - st.noFirstQuestion} из ${N} жизней, разных ${st.firstQuestions.size}, самый частый — ${firstTop} из ${N}`);
  const rep = mean(st.repeats);
  check(rep <= REPEAT_MAX, `${name}: следующая жизнь повторяет прошлую на ${pct(rep)}`);
  lines.push(`- Повторы: следующая жизнь повторяет прошлую на ${pct(rep)} событий и вопросов в среднем (предел ${pct(REPEAT_MAX)}), худшая пара — ${pct(Math.max(...st.repeats))}`);
  check(st.landBad.length === 0, `${name}: события не по месту — ${st.landBad.slice(0, 3).join('; ')}`);
  lines.push(`- События не по месту (снег, метро, девятилетка, листопад в тропиках): ${st.landBad.length}`);

  const fl = firstLives(mode, 100);
  check(fl.asked === 100, `${name}: первых жизней дошли до вопроса ${fl.asked} из 100`);
  check(fl.pause5 === 100, `${name}: первых жизней дошли до паузы 5 лет ${fl.pause5} из 100`);
  lines.push(`- 100 первых жизней новых душ: до вопроса дошли ${fl.asked}, до паузы в 5 лет — ${fl.pause5}`);

  // Не меньше 3000 на эпоху или группу: у 200 жизней разброс сам по себе около 3 п. п.
  const early = earlyDeaths(mode, Math.max(N, EARLY_PER_GROUP));
  lines.push(`- Смерть до 2 лет, бот против данных (допуск ±${EARLY_TOLERANCE_PP} п. п.):`);
  for (const e of early) {
    const ok = check(Math.abs(e.got - e.want) * 100 <= EARLY_TOLERANCE_PP, `${name} ${e.group}: смерть до 2 лет ${pct(e.got)} против ${pct(e.want)}`);
    lines.push(`  - ${e.group}: ${e.n} жизней, ${pct(e.got)} против ${pct(e.want)}${ok ? '' : ' — НЕ сходится'}`);
  }
  lines.push('');
  console.log(
    `sim:lives ${mode}: смерть ${f1(got)} против ${f1(want)}, решений ${f1(mean(st.decisions))}, вопрос нулевого года ${N - st.noFirstQuestion}/${N} (разных ${st.firstQuestions.size}), повторы ${pct(rep)}, не по месту ${st.landBad.length}, первые жизни до вопроса ${fl.asked}/100, до 2 лет: ${early.map((e) => `${e.group} ${pct(e.got)}/${pct(e.want)}`).join(', ')}`,
  );
}
if (fails.length) lines.push('## Не сходится', ...fails.map((f) => `- ${f}`), '');
if (args.includes('--report')) {
  const dir = resolve(import.meta.dirname, '../docs/evidence/LS2');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'sim-lives.md'), lines.join('\n') + '\n');
}
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
