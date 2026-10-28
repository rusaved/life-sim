// Что: верхняя строка экранов — название, выключатель звука, «Об игре».
// Кто зовёт: экраны души, рождения, итога.
// Держать: касания 44 px; звук сохраняется в сохранении.

import { app, go, persist } from '../app.ts';
import { content } from '../core/data.ts';
import { ICONS, h, iconButton } from './dom.ts';
import { setSound, sfx, soundOn } from './sound.ts';

export function soundButton(): HTMLButtonElement {
  const ui = content.life.ui;
  const b = iconButton(soundOn() ? ICONS.soundOn : ICONS.soundOff, soundOn() ? ui.soundOn : ui.soundOff, () => {
    const on = !soundOn();
    setSound(on);
    app.save.sound = on;
    persist();
    b.innerHTML = on ? ICONS.soundOn : ICONS.soundOff;
    b.setAttribute('aria-label', on ? ui.soundOn : ui.soundOff);
    b.title = on ? ui.soundOn : ui.soundOff;
    if (on) sfx.tap();
  });
  b.dataset.sound = 'toggle';
  return b;
}

export function topbar(withAbout = true): HTMLElement {
  return h(
    'div',
    { class: 'topbar' },
    h('div', { class: 'brand', text: content.brand.title }),
    soundButton(),
    withAbout ? iconButton(ICONS.about, content.life.ui.about, () => go.about()) : null,
  );
}
