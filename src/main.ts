// Что: вход игры — площадка, сохранение (?fresh=1 — с чистого листа), ссылка друга ?s=<seed>, первый экран.
// Кто зовёт: index.html.
// Держать: до первого экрана ничего тяжёлого — первое решение не позже 20 с от открытия.

import './style.css';
import { app, freshSave, go, persist } from './app.ts';
import { loadPlatform } from './platform/index.ts';
import { SAVE_KEY, localRemove } from './platform/storage.ts';
import { decodeSave } from './core/save.ts';
import { makeBirth } from './core/birth.ts';
import { replay } from './core/life.ts';
import { isSeed } from './core/rng.ts';
import { showSoul } from './ui/soul-screen.ts';
import { showBirth } from './ui/birth-screen.ts';
import { showLife } from './ui/life-screen.ts';
import { showEnd } from './ui/end-screen.ts';
import { showAbout } from './ui/about-screen.ts';
import { setSound } from './ui/sound.ts';

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  if (params.get('fresh') === '1') {
    localRemove(SAVE_KEY);
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('vkmock:')) localStorage.removeItem(k);
    } catch {
      /* приватный режим */
    }
  }
  app.platform = await loadPlatform();
  await app.platform.init();
  app.save = (params.get('fresh') === '1' ? null : decodeSave(await app.platform.load())) ?? freshSave();
  app.life = null;
  if (app.save.life) {
    try {
      const s = app.save.life;
      app.life = replay(makeBirth(s.seed), s.bias, s.actions);
    } catch {
      app.save.life = null;
    }
  }
  const shared = params.get('s');
  app.sharedSeed = isSeed(shared) ? shared : null;
  setSound(app.save.sound);

  let back = showSoul;
  go.soul = () => ((back = showSoul), showSoul());
  go.birth = (mode, seed) => showBirth(mode, seed);
  go.life = () => ((back = showLife), showLife());
  go.end = () => ((back = showEnd), showEnd());
  go.about = () => {
    const ret = document.querySelector('[data-screen="end"]') ? () => go.soul() : back === showLife ? showLife : back;
    showAbout(ret);
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && persist());
  showSoul();
}

void boot();
