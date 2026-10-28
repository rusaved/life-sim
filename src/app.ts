// Что: состояние игры в браузере — площадка, сохранение (душа, текущая жизнь, режим, звук), переходы между экранами.
// Кто зовёт: src/main.ts при старте, все экраны src/ui.
// Держать: сохраняем через площадку (localStorage или VK Storage) одним текстом; экраны вызывают друг друга через go.

import type { Platform } from './platform/types.ts';
import { encodeSave, type SaveData } from './core/save.ts';
import type { Life } from './core/life.ts';
import type { Mode } from './core/rng.ts';
import { newSoul } from './core/soul.ts';
import { content } from './core/data.ts';

export interface AppState {
  platform: Platform;
  save: SaveData;
  life: Life | null;
  /** Зерно из ссылки друга (?s=), пока по нему не родились. */
  sharedSeed: string | null;
}

export const app = {} as AppState;

export function freshSave(): SaveData {
  return { v: 1, t: Date.now(), soul: newSoul(), life: null, mode: 'world' as Mode, sound: true };
}

export function persist(): void {
  const life = app.life;
  app.save.life = life && !life.death ? { seed: life.birth.seed, bias: life.bias, actions: life.actions } : null;
  app.save.t = Date.now();
  app.platform.save(encodeSave(app.save));
}

/** Ссылка «Родись тем же младенцем». */
export function seedUrl(seed: string): string {
  return `${content.brand.siteUrl}?s=${seed}`;
}

/** Переходы между экранами; заполняет src/main.ts. */
export const go = {
  soul: (): void => {},
  birth: (_mode: Mode, _seed?: string): void => {},
  life: (): void => {},
  end: (): void => {},
  about: (): void => {},
};
