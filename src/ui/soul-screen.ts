// Что: экран души — номер, склонность в первой жизни, черты и строки прожитых жизней, «Продолжить», выбор мира, ссылка друга, код души.
// Кто зовёт: go.soul (старт, после смерти, «К душе»).
// Держать: первая жизнь — два касания до жребия (склонность, мир); «по умолчанию» — последний выбранный мир, он первый.

import { app, go, persist } from '../app.ts';
import { makeBirth, eraName, placeName } from '../core/birth.ts';
import { content } from '../core/data.ts';
import { seedMode, type Mode } from '../core/rng.ts';
import { lifeCount, lifeLineText, traitList } from '../core/soul.ts';
import { soulCode, soulFromCode } from '../core/save.ts';
import { agePair, fill } from '../core/text.ts';
import { button, h, mount, toast } from './dom.ts';
import { sfx } from './sound.ts';
import { topbar } from './topbar.ts';

export function showSoul(): void {
  const ui = content.life.ui;
  const soul = app.save.soul;
  const first = lifeCount(soul) === 0;
  const body = h('div', { class: 'scroll stack fade-in' });
  const screen = h('section', { class: 'screen', dataset: { screen: 'soul' } }, topbar(), body);

  body.append(
    h(
      'div',
      { class: 'soul-head' },
      h('h1', { text: fill(ui.soulNo, { n: soul.no }) }),
      h('p', { class: 'sub muted', text: first ? ui.soulFirst : fill(ui.soulLives, { n: lifeCount(soul) }) }),
    ),
  );

  const shared = app.sharedSeed;
  if (shared) {
    const b = makeBirth(shared);
    const banner = content.soul.ui.sharedBanner;
    body.append(
      h(
        'div',
        { class: 'banner stack', dataset: { shared: '1' } },
        h('h3', { text: banner.title }),
        h('p', { class: 'muted small', text: banner.line }),
        h('p', { text: `${placeName(b)} · ${eraName(b)}` }),
      ),
    );
  }

  const current = app.life && !app.life.death ? app.life : null;
  if (current && !shared) {
    const p = agePair(current.age);
    body.append(
      h(
        'button',
        { type: 'button', class: 'btn primary wide', dataset: { action: 'continue' }, onclick: () => (sfx.tap(), go.life()) },
        content.soul.ui.buttons.continue!,
        h('span', { class: 'hint', style: 'display:block;font-weight:400;font-size:14px', text: fill(ui.continueHint, { place: placeName(current.birth, current.place), age: `${p.age} ${p.years}` }) }),
      ),
    );
  }

  // Склонность — только у новой души.
  const modeButtons: HTMLButtonElement[] = [];
  if (first) {
    const list = h('div', { class: 'stack' });
    for (const inc of content.soul.inclinations) {
      const b = h(
        'button',
        {
          type: 'button',
          class: `btn incl${soul.inclination === inc.id ? ' on' : ''}`,
          'aria-pressed': String(soul.inclination === inc.id),
          dataset: { inclination: inc.id },
          onclick: () => {
            sfx.tap();
            soul.inclination = inc.id;
            persist();
            for (const el of list.querySelectorAll('.incl')) {
              const on = (el as HTMLElement).dataset.inclination === inc.id;
              el.classList.toggle('on', on);
              el.setAttribute('aria-pressed', String(on));
            }
            for (const m of modeButtons) m.disabled = false;
            if (shared) sameBtn.disabled = false;
          },
        },
        h('b', { text: inc.name }),
        h('span', { text: inc.short }),
      );
      list.append(b);
    }
    body.append(list);
  } else {
    const traits = traitList(soul);
    body.append(
      h(
        'div',
        { class: 'stack' },
        h('h3', { text: ui.soulTraits }),
        traits.length
          ? h(
              'div',
              { class: 'traits' },
              ...traits.map((t) => h('div', { class: 'trait' }, h('b', { text: t.count > 1 ? `${t.trait.name} ×${t.count}` : t.trait.name }), h('div', { class: 'muted', text: t.trait.short }))),
            )
          : h('p', { class: 'muted', text: ui.soulEmpty }),
      ),
    );
  }

  const sameBtn = button(content.soul.ui.buttons.bornSame!, 'primary wide', () => {
    sfx.tap();
    const seed = app.sharedSeed!;
    app.sharedSeed = null;
    const url = new URL(location.href);
    url.searchParams.delete('s');
    history.replaceState(null, '', url);
    go.birth(seedMode(seed), seed);
  });
  sameBtn.dataset.action = 'born-same';
  if (shared) {
    sameBtn.disabled = first && !soul.inclination;
    body.append(sameBtn);
  }

  const modes: Array<{ mode: Mode; name: string; hint: string }> = [
    { mode: 'world', name: ui.modeWorld, hint: ui.modeWorldHint },
    { mode: 'russia', name: ui.modeRussia, hint: ui.modeRussiaHint },
  ];
  if (app.save.mode === 'russia') modes.reverse();
  const modeBox = h('div', { class: 'stack' }, h('h3', { text: lifeCount(soul) ? content.soul.ui.buttons.born! : ui.chooseWorld }));
  modes.forEach((m, i) => {
    const b = h(
      'button',
      {
        type: 'button',
        class: `btn mode${i === 0 && lifeCount(soul) ? ' last' : ''}`,
        dataset: { mode: m.mode },
        onclick: () => {
          sfx.tap();
          app.sharedSeed = null;
          go.birth(m.mode);
        },
      },
      h('b', { text: m.name }),
      h('span', { text: m.hint }),
    );
    b.disabled = first && !soul.inclination;
    modeButtons.push(b);
    modeBox.append(b);
  });
  body.append(modeBox);

  if (!first) {
    const lines = soul.lives.slice().reverse();
    body.append(
      h(
        'div',
        { class: 'stack' },
        h('h3', { text: ui.soulMemorial }),
        h('ul', { class: 'memorial' }, ...lines.map((l, i) => h('li', { text: lifeLineText(l, soul.lives.length - 1 - i) }))),
      ),
    );
    body.append(codeBox());
  }
  if (__BUILD_LABEL__) body.append(h('div', { class: 'label', text: __BUILD_LABEL__ }));
  mount(screen);
}

function codeBox(): HTMLElement {
  const ui = content.life.ui;
  const area = h('textarea', { 'aria-label': ui.soulCode, spellcheck: 'false', autocomplete: 'off' }) as HTMLTextAreaElement;
  area.value = soulCode(app.save.soul);
  return h(
    'details',
    { class: 'card' },
    h('summary', { text: ui.soulCode }),
    h(
      'div',
      { class: 'stack' },
      h('p', { class: 'muted small', text: ui.soulCodeHint }),
      area,
      h(
        'div',
        { class: 'row' },
        button(ui.soulCodeCopy, 'grow', () => {
          void navigator.clipboard?.writeText(area.value).then(
            () => toast(ui.copied),
            () => (area.select(), toast(ui.copied)),
          );
        }),
        button(ui.soulCodeLoad, 'grow', () => {
          const soul = soulFromCode(area.value);
          if (!soul) return toast(ui.soulCodeBad);
          app.save.soul = soul;
          app.save.life = null;
          app.life = null;
          persist();
          toast(ui.soulCodeOk);
          showSoul();
        }),
      ),
    ),
  );
}
