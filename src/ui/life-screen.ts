// Что: экран жизни — годы идут сами (1× / 4× / 16× и «До следующего решения»), четыре шкалы, лента событий, решения, паузы,
// перекрёстки и направление года; смерть ведёт к итогу.
// Кто зовёт: go.life (после свидетельства и «Продолжить»).
// Держать: на решении время стоит; всё, что сделал игрок, — в life.actions и сохраняется сразу.

import { app, go, persist } from '../app.ts';
import { content } from '../core/data.ts';
import { eraName, placeName } from '../core/birth.ts';
import { FOCUS, choose, pendingCrossroad, pendingEvent, pendingPause, setFocus, step, yearOf, type FocusId, type LogEntry } from '../core/life.ts';
import { agePair, gender } from '../core/text.ts';
import { SCALE_KEYS } from '../core/types.ts';
import { button, h, mount } from './dom.ts';
import { sfx } from './sound.ts';
import { soundButton } from './topbar.ts';

type Speed = 1 | 4 | 16;
const YEAR_MS: Record<Speed, number> = { 1: 1000, 4: 260, 16: 60 };
const SKIP_MS = 22;
const SHOW_LAST = 40;

let speed: Speed = 1;

declare global {
  interface Window {
    __T0?: number;
    /** Время от открытия до первого решения, мс (метрика и e2e). */
    __FIRST_DECISION_MS__?: number;
  }
}

export function showLife(): void {
  const life = app.life;
  if (!life) return go.soul();
  if (life.death) return go.end();
  const ui = content.life.ui;
  const sex = life.birth.sex;

  const ageEl = h('div', { class: 'age', 'data-age': '' });
  const yearEl = h('div', { class: 'where' });
  const whereEl = h('div', { class: 'where' });
  const bars = new Map<string, HTMLElement>();
  const scales = h(
    'div',
    { class: 'scales' },
    ...SCALE_KEYS.map((k) => {
      const fillEl = h('i');
      bars.set(k, fillEl);
      return h('div', { class: `scale ${k}` }, h('span', { text: content.life.scales[k] }), h('div', { class: 'bar' }, fillEl));
    }),
  );
  const feed = h('div', { class: 'feed', role: 'log', 'aria-live': 'polite' });

  const focusChips = new Map<FocusId, HTMLButtonElement>();
  const focusRow = h('div', { class: 'row' });
  for (const f of FOCUS) {
    const chip = h('button', { type: 'button', class: 'chip', text: f.name, dataset: { focus: f.id }, onclick: () => (sfx.tap(), setFocus(life, f.id), persist(), refresh()) }) as HTMLButtonElement;
    focusChips.set(f.id, chip);
    focusRow.append(chip);
  }
  const focusBox = h('div', { class: 'stack', style: 'gap:6px' }, h('div', { class: 'focus-title', text: ui.focus }), focusRow);

  const speedChips = new Map<Speed, HTMLButtonElement>();
  const speedRow = h('div', { class: 'speed', role: 'group', 'aria-label': ui.speed });
  for (const s of [1, 4, 16] as Speed[]) {
    const chip = h('button', { type: 'button', class: 'chip', text: `${s}×`, dataset: { speed: String(s) }, onclick: () => (sfx.tap(), (speed = s), (skipping = false), refresh(), schedule()) }) as HTMLButtonElement;
    speedChips.set(s, chip);
    speedRow.append(chip);
  }
  const skipBtn = button(content.soul.ui.buttons.untilNextDecision!, 'grow', () => {
    sfx.tap();
    skipping = true;
    schedule();
  });
  skipBtn.dataset.action = 'skip';
  skipBtn.style.minWidth = '0';
  speedRow.append(skipBtn);

  const controls = h('div', { class: 'controls' }, focusBox, speedRow);
  const screen = h(
    'section',
    { class: 'screen', dataset: { screen: 'life' } },
    h('div', { class: 'life-head' }, h('div', { class: 'grow', style: 'min-width:0' }, ageEl, yearEl, whereEl), soundButton()),
    scales,
    feed,
    controls,
  );
  mount(screen);

  let shown = Math.max(0, life.log.length - SHOW_LAST);
  let timer = 0;
  let skipping = false;
  let card: HTMLElement | null = null;

  const entry = (e: LogEntry): HTMLElement =>
    h('div', { class: `entry ${e.kind}` }, h('div', { class: 'when', text: String(e.age) }), h('div', { class: 'what' }, e.text, e.result ? h('span', { class: 'res', text: e.result }) : null));

  function refresh(): void {
    const p = agePair(life!.age);
    ageEl.textContent = `${p.age} ${p.years}`;
    ageEl.dataset.age = String(life!.age);
    yearEl.textContent = String(yearOf(life!));
    whereEl.textContent = `${placeName(life!.birth, life!.place)} · ${eraName(life!.birth)}`;
    for (const k of SCALE_KEYS) bars.get(k)!.style.width = `${Math.round(life!.scales[k])}%`;
    for (const f of FOCUS) {
      const chip = focusChips.get(f.id)!;
      chip.disabled = life!.age < f.from;
      chip.classList.toggle('on', life!.focus === f.id);
      chip.setAttribute('aria-pressed', String(life!.focus === f.id));
    }
    focusBox.style.display = life!.age >= 6 ? '' : 'none';
    for (const [s, chip] of speedChips) chip.classList.toggle('on', s === speed && !skipping);
    const added = life!.log.slice(shown);
    shown = life!.log.length;
    for (const e of added) {
      feed.append(entry(e));
      if (e.kind === 'family') sfx.family();
    }
    while (feed.childElementCount > SHOW_LAST * 2) feed.firstElementChild?.remove();
    if (added.length) feed.scrollTop = feed.scrollHeight;
  }

  function decisionCard(): void {
    const e = pendingEvent(life!);
    const pause = pendingPause(life!);
    const cross = pendingCrossroad(life!);
    if (!e && !pause && !cross) return;
    if (window.__FIRST_DECISION_MS__ === undefined) window.__FIRST_DECISION_MS__ = Math.round(performance.now() - (window.__T0 ?? 0));
    sfx.decision();
    const p = agePair(life!.age);
    const question = e ? e.text : pause ? pause.question : cross!.question;
    const labels = e ? e.choices.map((c) => c.label) : pause ? pause.answers : cross!.options.map((o) => o.label);
    card = h(
      'div',
      { class: 'decision', role: 'dialog', 'aria-label': question, dataset: { decision: pause ? 'pause' : cross ? 'crossroad' : 'event' } },
      h('div', { class: 'when', text: pause ? `${ui.pauseTitle} · ${p.age} ${p.years}` : `${p.age} ${p.years} · ${yearOf(life!)}` }),
      h('div', { class: 'q', text: gender(question, sex) }),
      ...labels.map((label, i) =>
        button(gender(label, sex), 'choice', () => {
          sfx.tap();
          card?.remove();
          card = null;
          choose(life!, i);
          persist();
          refresh();
          schedule();
        }, { 'data-choice': String(i) }),
      ),
    );
    screen.append(card);
    (card.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  function tick(): void {
    timer = 0;
    if (!screen.isConnected) return;
    const before = life!.age;
    step(life!);
    refresh();
    if (life!.death) {
      sfx.end();
      timer = window.setTimeout(() => screen.isConnected && go.end(), 1300);
      return;
    }
    if (life!.pending) {
      skipping = false;
      refresh();
      persist();
      decisionCard();
      return;
    }
    if (life!.age !== before && life!.age % 5 === 0) persist();
    schedule();
  }

  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = 0;
    if (life!.death || card) return;
    if (life!.pending) return decisionCard();
    timer = window.setTimeout(tick, skipping ? SKIP_MS : YEAR_MS[speed]);
  }

  for (const e of life.log.slice(shown)) feed.append(entry(e));
  shown = life.log.length;
  refresh();
  feed.scrollTop = feed.scrollHeight;
  // Первый год идёт сразу: до первого решения — секунды.
  timer = window.setTimeout(tick, life.age === 0 ? 400 : YEAR_MS[speed]);
}
