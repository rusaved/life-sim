// Что: площадка «свой сайт» — без моста, сохранение в localStorage.
// Кто зовёт: src/platform/index.ts.
// Держать: никаких внешних запросов.

import type { Platform } from './types.ts';
import { SAVE_KEY, localGet, localSet } from './storage.ts';
import { wholeScreen } from './fullscreen.ts';

export function createNullPlatform(): Platform {
  return {
    name: 'null',
    async init() {},
    async load() {
      return localGet(SAVE_KEY);
    },
    save(data) {
      localSet(SAVE_KEY, data);
    },
    requestFullscreen: wholeScreen,
  };
}
