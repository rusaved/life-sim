// Что: случайность с зерном — одно и то же зерно даёт одно и то же рождение и тот же ход случая.
// Кто зовёт: birth.ts, life.ts, soul.ts, scripts/sim-lives.ts.
// Держать: состояние — одно число uint32, его можно сохранить и продолжить.

/** FNV-1a: из строки зерна — число. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}

export interface Rng {
  state: number;
}

export function makeRng(seed: string): Rng {
  return { state: hashSeed(seed) || 1 };
}

/** mulberry32: следующее число в [0, 1). */
export function next(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function int(rng: Rng, from: number, to: number): number {
  return from + Math.floor(next(rng) * (to - from + 1));
}

export function pick<T>(rng: Rng, list: readonly T[]): T {
  if (!list.length) throw new Error('pick: пустой список');
  return list[Math.floor(next(rng) * list.length)]!;
}

/** Выбор по весам; веса неотрицательные, хотя бы один больше нуля. */
export function weighted<T>(rng: Rng, list: readonly T[], weight: (x: T) => number): T {
  let total = 0;
  for (const x of list) total += Math.max(0, weight(x));
  let r = next(rng) * total;
  for (const x of list) {
    r -= Math.max(0, weight(x));
    if (r < 0) return x;
  }
  return list[list.length - 1]!;
}

const SEED_RE = /^[wr][0-9a-z]{4,12}$/;

export type Mode = 'world' | 'russia';

export function isSeed(text: string | null | undefined): text is string {
  return !!text && SEED_RE.test(text);
}

export function seedMode(seed: string): Mode {
  return seed[0] === 'r' ? 'russia' : 'world';
}

/** Новое зерно: буква режима и 7 знаков. */
export function newSeed(mode: Mode, random: () => number = Math.random): string {
  let s = mode === 'russia' ? 'r' : 'w';
  for (let i = 0; i < 7; i++) s += Math.floor(random() * 36).toString(36);
  return s;
}
