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
  /** Сколько прожил друг (?a= в ссылке после смерти), пока по ссылке не родились. */
  sharedAge: number | null;
  /** Итог друга для текущей жизни, рождённой по его ссылке: после смерти — «у друга 58, у тебя 74». */
  friendAge: number | null;
}

export const app = {} as AppState;

export function freshSave(): SaveData {
  return { v: 1, t: Date.now(), soul: newSoul(), life: null, mode: 'world' as Mode, sound: true };
}

export function persist(): void {
  const life = app.life;
  app.save.life = life && !life.death ? { seed: life.birth.seed, bias: life.bias, actions: life.actions, ...(app.friendAge !== null ? { friend: app.friendAge } : {}) } : null;
  app.save.t = Date.now();
  app.platform.save(encodeSave(app.save));
}

/** Метка сборки: зашита в сборки Pages и VK, видна только по ?build=1 (игроку она ни к чему). */
export function buildLabel(): string {
  return __BUILD_LABEL__ && new URLSearchParams(location.search).get('build') === '1' ? __BUILD_LABEL__ : '';
}

/** Ссылка «Родись тем же младенцем»; после смерти в ней и прожитые годы — друг увидит, сколько надо прожить. */
export function seedUrl(seed: string, age?: number): string {
  return `${content.brand.siteUrl}?s=${seed}${age !== undefined ? `&a=${age}` : ''}`;
}

/** Прожитые годы из ссылки друга: целое 0–120, иначе null. */
export function parseAge(text: string | null): number | null {
  if (!text || !/^\d{1,3}$/.test(text)) return null;
  const n = Number(text);
  return n <= 120 ? n : null;
}

/** Переходы между экранами; заполняет src/main.ts. */
export const go = {
  soul: (): void => {},
  birth: (_mode: Mode, _seed?: string): void => {},
  life: (): void => {},
  end: (): void => {},
  about: (): void => {},
};
