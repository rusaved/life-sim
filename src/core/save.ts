// Что: сохранение игры одним коротким текстом — душа, текущая жизнь (зерно, сдвиг души и запись действий), последний режим, звук;
// код переноса души.
// Кто зовёт: src/main.ts и интерфейс через площадку (localStorage или VK Storage).
// Держать: текст до 4 096 знаков (предел значения VK Storage) — жизнь хранится записью действий, строк души не больше MAX_LINES.

import type { Mode } from './rng.ts';
import { isSeed } from './rng.ts';
import { MAX_LINES, type Soul } from './soul.ts';
import type { Scales } from './types.ts';

export interface SavedLife {
  seed: string;
  bias: Scales;
  actions: string;
}

export interface SaveData {
  v: 1;
  t: number;
  soul: Soul;
  life: SavedLife | null;
  mode: Mode;
  sound: boolean;
}

export const SAVE_LIMIT = 4096;

export function encodeSave(data: SaveData): string {
  let text = JSON.stringify(data);
  // Запас: если строк души много, старые уходят первыми.
  let soul = data.soul;
  while (text.length > SAVE_LIMIT && soul.lives.length > 1) {
    soul = { ...soul, lives: soul.lives.slice(1) };
    text = JSON.stringify({ ...data, soul });
  }
  return text;
}

function isSoul(x: unknown): x is Soul {
  const s = x as Soul;
  return !!s && typeof s.no === 'number' && Array.isArray(s.traits) && Array.isArray(s.lives) && (s.inclination === null || typeof s.inclination === 'string');
}

export function decodeSave(text: string | null): SaveData | null {
  if (!text) return null;
  try {
    const d = JSON.parse(text) as SaveData;
    if (d.v !== 1 || !isSoul(d.soul)) return null;
    const life = d.life && isSeed(d.life.seed) && typeof d.life.actions === 'string' ? d.life : null;
    return { v: 1, t: Number(d.t) || 0, soul: { ...d.soul, lives: d.soul.lives.slice(-MAX_LINES) }, life, mode: d.mode === 'russia' ? 'russia' : 'world', sound: d.sound !== false };
  } catch {
    return null;
  }
}

const CODE_PREFIX = 'ДУША-';

/** Код переноса души: только душа, без текущей жизни. */
export function soulCode(soul: Soul): string {
  const bytes = new TextEncoder().encode(JSON.stringify(soul));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return CODE_PREFIX + btoa(bin);
}

export function soulFromCode(code: string): Soul | null {
  const raw = code.trim().replace(/\s+/g, '');
  const body = raw.startsWith(CODE_PREFIX) ? raw.slice(CODE_PREFIX.length) : raw;
  try {
    const bin = atob(body);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const soul = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return isSoul(soul) ? { ...soul, lives: soul.lives.slice(-MAX_LINES) } : null;
  } catch {
    return null;
  }
}
