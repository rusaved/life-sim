// Что: вход игры — площадка, сохранение (?fresh=1 — с чистого листа), ссылка друга ?s=<seed>&a=<прожил лет>, первый экран.
// Кто зовёт: index.html.
// Весь экран по касанию; скрытая вкладка — сохранение и тишина (жизнь ставит на паузу экран жизни).
// Держать: до первого экрана ничего тяжёлого — первое решение не позже 20 с от открытия.

import './style.css';
import { app, freshSave, go, parseAge, persist } from './app.ts';
import { loadPlatform } from './platform/index.ts';
import { SAVE_KEY, localRemove } from './platform/storage.ts';
import { decodeSave } from './core/save.ts';
import { makeBirth } from './core/birth.ts';
import { replay } from './core/life.ts';
import { lifeOptions } from './core/soul.ts';
import { isSeed } from './core/rng.ts';
import { showSoul } from './ui/soul-screen.ts';
import { showBirth } from './ui/birth-screen.ts';
import { showLife } from './ui/life-screen.ts';
import { showEnd } from './ui/end-screen.ts';
import { showAbout } from './ui/about-screen.ts';
import { setHidden, setSound } from './ui/sound.ts';

const WHOLE_SCREEN_EVERY_MS = 1000;

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
  // ?fresh=1 срабатывает один раз: после перезагрузки сохранение живёт.
  if (params.has('fresh')) {
    const url = new URL(location.href);
    url.searchParams.delete('fresh');
    history.replaceState(null, '', url);
  }
  app.platform = await loadPlatform();
  await app.platform.init();
  app.save = (params.get('fresh') === '1' ? null : decodeSave(await app.platform.load())) ?? freshSave();
  app.life = null;
  app.friendAge = app.save.life?.friend ?? null;
  if (app.save.life) {
    try {
      const s = app.save.life;
      app.life = replay(makeBirth(s.seed), s.bias, s.actions, lifeOptions(app.save.soul));
    } catch {
      app.save.life = null;
    }
  }
  const shared = params.get('s');
  app.sharedSeed = isSeed(shared) ? shared : null;
  app.sharedAge = app.sharedSeed ? parseAge(params.get('a')) : null;
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
  document.addEventListener('visibilitychange', () => {
    const hidden = document.visibilityState === 'hidden';
    setHidden(hidden);
    if (hidden) persist();
  });
  // Весь экран по касанию пальцем (браузер даёт только из касания): после выхода и сворачивания — снова, не чаще раза в секунду.
  let askedAt = -Infinity;
  window.addEventListener(
    'pointerup',
    (ev) => {
      if (ev.pointerType === 'mouse' || document.fullscreenElement) return;
      const now = performance.now();
      if (now - askedAt < WHOLE_SCREEN_EVERY_MS) return;
      askedAt = now;
      void app.platform.requestFullscreen();
    },
    true,
  );
  showSoul();
}

void boot();
