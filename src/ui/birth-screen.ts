// Что: рождение — жребий 2–3 с (мелькают страны или эпохи) и свидетельство о рождении: кто, где, когда, семья, ожидаемая жизнь.
// Кто зовёт: go.birth с экрана души (режим, зерно из ссылки друга).
// Держать: зерно решает рождение целиком; душа даёт только сдвиг шкал жизни.

import { app, go, persist } from '../app.ts';
import { content } from '../core/data.ts';
import { countryName, eraName, makeBirth } from '../core/birth.ts';
import { startLife } from '../core/life.ts';
import { newSeed, type Mode } from '../core/rng.ts';
import { lifeCount, lifeOptions, soulBias } from '../core/soul.ts';
import { fill, gender, yearsGen } from '../core/text.ts';
import { button, h, mount } from './dom.ts';
import { openShare } from './share.ts';
import { sfx } from './sound.ts';
import { topbar } from './topbar.ts';

const LOTTERY_MS = 2300;

export function showBirth(mode: Mode, seed = newSeed(mode)): void {
  const ui = content.life.ui;
  app.save.mode = mode;
  const birth = makeBirth(seed);
  app.life = startLife(birth, soulBias(app.save.soul), lifeOptions(app.save.soul));
  persist();

  const spin = h('div', { class: 'spin', 'aria-hidden': 'true' });
  const screen = h(
    'section',
    { class: 'screen', dataset: { screen: 'lottery' } },
    topbar(false),
    h('div', { class: 'lottery fade-in' }, h('p', { class: 'muted', text: ui.rolling }), spin),
  );
  mount(screen);
  const names =
    mode === 'world'
      ? [...Object.values(content.countryNames)]
      : content.eras.flatMap((e) => Object.values(content.life.places).map((p) => `${e.year}-е, ${p}`));
  const t0 = performance.now();
  let i = 0;
  const tick = (): void => {
    const t = performance.now() - t0;
    if (t >= LOTTERY_MS || !screen.isConnected) {
      if (screen.isConnected) certificate();
      return;
    }
    spin.textContent = names[(i += 7) % names.length]!;
    window.setTimeout(tick, 70 + (t / LOTTERY_MS) * 230);
  };
  tick();
}

function certificate(): void {
  const ui = content.life.ui;
  const life = app.life!;
  const b = life.birth;
  sfx.birth();
  const where = `${countryName(b)}, ${content.life.placeIn[b.place]}`;
  const when = b.era === null ? `${eraName(b)}, ${b.year}` : String(b.year);
  const years = Math.round(b.lifeExp);
  const lifeValue = fill(ui.certLifeValue, { n: years, gen: yearsGen(years) }) + (b.mode === 'russia' ? `, ${ui.approx}` : '');
  const row = (k: string, v: string): Node[] => [h('dt', { text: k }), h('dd', { text: v })];
  const screen = h(
    'section',
    { class: 'screen', dataset: { screen: 'birth' } },
    topbar(),
    h(
      'div',
      { class: 'scroll stack fade-in' },
      h(
        'div',
        { class: 'cert' },
        h('p', { class: 'muted small center', text: ui.certificate }),
        h('h2', { class: 'center', style: 'margin-top:6px', text: gender(ui.bornLine, b.sex) }),
        h(
          'dl',
          {},
          ...row(ui.certSex, content.life.sex[b.sex]),
          ...row(ui.certPlace, where),
          ...row(ui.certTime, when),
          ...row(ui.certFamily, content.life.wealth[b.wealth]),
          ...row(ui.certLife, lifeValue),
        ),
        h('p', { class: 'muted small center', style: 'margin-top:14px', text: fill(ui.cardSoul, { n: app.save.soul.no, k: lifeCount(app.save.soul) + 1 }) }),
      ),
      button(ui.startLife, 'primary wide', () => (sfx.tap(), go.life()), { 'data-action': 'start-life' }),
      button(content.soul.ui.buttons.share!, 'ghost wide', () => openShare('birth'), { 'data-action': 'share-birth' }),
    ),
  );
  mount(screen);
}
