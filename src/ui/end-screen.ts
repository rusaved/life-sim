// Что: итог жизни — место и годы, причина одной фразой, эпитафия, шкалы, главные события, «Душа запомнила»; лист «Поделиться» сам.
// Кто зовёт: go.end после смерти на экране жизни.
// Держать: душа запоминает жизнь ровно один раз (сохранение сразу, текущая жизнь стирается).

import { app, go, persist } from '../app.ts';
import { content } from '../core/data.ts';
import { mainEvents } from '../core/life.ts';
import { rememberLife, summarize } from '../core/soul.ts';
import { ageText, fill } from '../core/text.ts';
import { SCALE_KEYS } from '../core/types.ts';
import { button, h, mount } from './dom.ts';
import { openShare, setSummary } from './share.ts';
import { topbar } from './topbar.ts';

const AUTO_SHARE_MS = 1100;
const remembered = new WeakSet<object>();

export function showEnd(): void {
  const life = app.life;
  if (!life?.death) return go.soul();
  const ui = content.life.ui;
  const s = summarize(life, app.save.soul);
  setSummary(s);
  if (!remembered.has(life)) {
    remembered.add(life);
    app.save.soul = rememberLife(app.save.soul, life, s);
    persist();
  }
  const screen = h(
    'section',
    { class: 'screen', dataset: { screen: 'end' } },
    topbar(),
    h(
      'div',
      { class: 'scroll stack fade-in' },
      h(
        'div',
        { class: 'end' },
        h('p', { class: 'muted small', text: ui.deathTitle }),
        h('h1', { style: 'margin-top:8px', text: s.place }),
        h('div', { class: 'years', text: `${fill(ui.lifeYears, { from: s.from, to: s.to })} · ${ageText(s.age)}` }),
        h('p', { class: 'muted', style: 'margin-top:10px', text: s.cause }),
        h('p', { class: 'epitaph', 'data-epitaph': '', text: s.epitaph }),
      ),
      h(
        'div',
        { class: 'scales' },
        ...SCALE_KEYS.map((k) => h('div', { class: `scale ${k}` }, h('span', { text: content.life.scales[k] }), h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(life.scales[k])}%` })))),
      ),
      h(
        'div',
        { class: 'stack' },
        h('h3', { text: ui.mainEvents }),
        h(
          'ul',
          { class: 'events' },
          ...mainEvents(life).map((e) => h('li', {}, h('span', { class: 'when', text: fill(ui.atAge, { age: e.age }) }), h('span', { text: e.result ? `${e.text}. ${e.result}` : e.text }))),
        ),
      ),
      h('div', { class: 'remembered', 'data-remembered': s.trait.id }, s.remembered, h('small', { text: s.trait.short })),
      button(content.soul.ui.buttons.share!, 'primary wide', () => openShare('death'), { 'data-action': 'share-death' }),
      button(content.soul.ui.buttons.bornAgain!, 'wide', () => go.soul(), { 'data-action': 'to-soul' }),
    ),
  );
  mount(screen);
  window.setTimeout(() => screen.isConnected && openShare('death'), AUTO_SHARE_MS);
}
