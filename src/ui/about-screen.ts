// Что: экран «Об игре» — как устроена игра, откуда цифры (источники и годы данных), метка сборки (по ?build=1).
// Кто зовёт: кнопка «Об игре» в верхней строке.
// Держать: источники — те же, что в docs/data-sources.md; ссылки только текстом, без загрузок.

import { buildLabel } from '../app.ts';
import { content } from '../core/data.ts';
import { fill } from '../core/text.ts';
import { ICONS, h, iconButton, mount } from './dom.ts';

export function showAbout(back: () => void): void {
  const a = content.life.about;
  const w = content.world;
  const main = ['cbr', 'pop', 'lifeExp', 'infantMort', 'under5Mort', 'urban'].flatMap((k) => w.years[k] ?? []).map(Number);
  const years = `${Math.min(...main)}–${Math.max(...main)}`;
  const screen = h(
    'section',
    { class: 'screen', dataset: { screen: 'about' } },
    h('div', { class: 'topbar' }, iconButton(ICONS.back, content.life.ui.back, back), h('div', { class: 'brand', text: content.brand.title })),
    h(
      'div',
      { class: 'scroll about fade-in' },
      h('h2', { text: a.title, style: 'margin:8px 0 14px' }),
      ...a.lines.map((t) => h('p', { text: t })),
      h('h3', { text: a.sourcesTitle, style: 'margin:18px 0 10px' }),
      h('p', { text: fill(a.worldSource, { years }) }),
      h('p', { class: 'muted', text: fill(a.countries, { n: w.countries.length, share: Math.round(w.topShare * 100) }) }),
      h('p', { text: a.russiaSource }),
      buildLabel() ? h('p', { class: 'muted small', style: 'margin-top:18px', dataset: { build: '' }, text: fill(a.build, { label: buildLabel() }) }) : null,
    ),
  );
  mount(screen);
}
