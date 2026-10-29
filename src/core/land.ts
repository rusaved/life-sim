// Что: приметы места рождения — снег, жара круглый год, метро, советский быт — и проверка, подходит ли событие месту.
// Кто зовёт: life.ts (отбор событий), scripts/sim-lives.ts (бот ищет в прожитых текстах снег, метро и прочее не по месту),
// scripts/validate-content.ts (у текста со снегом или метро должна быть метка).
// Держать: списки стран — в content/places.json; метки событий land (нужны все) и landNo (ни одной) — в content/event-tags.json.

import places from '../../content/places.json' with { type: 'json' };
import { eventTags } from './data.ts';
import type { Birth, Place } from './types.ts';

export const LAND_KEYS = ['snow', 'warm', 'metro', 'postSoviet'] as const;
export type LandKey = (typeof LAND_KEYS)[number];

const lists = places as unknown as Record<LandKey, string[]> & { metroSinceRussia: number; words: Record<string, string[]> };
const WORDS = Object.entries(lists.words).map(([key, list]) => ({ key, re: list.map((w) => new RegExp(w)) }));

/** Приметы, о которых говорит текст: snow, metro, postSoviet; «warm!» — текст не для жарких стран (листопад). */
export function landWords(text: string): string[] {
  const low = text.toLowerCase();
  return WORDS.filter((w) => w.re.some((re) => re.test(low))).map((w) => w.key);
}

/** Текст говорит о том, чего в этом месте не бывает (null — всё на месте). */
export function textMismatch(text: string, land: ReadonlySet<LandKey>): string | null {
  const bad = landWords(text).filter((k) => (k === 'warm!' ? land.has('warm') : !land.has(k as LandKey)));
  return bad.length ? bad.join(', ') : null;
}

/** Приметы места: метро — только в столице и городе (в эпохах России — в столице с 1935 года). */
export function landOf(birth: Birth, place: Place = birth.place, year = birth.year): Set<LandKey> {
  const out = new Set<LandKey>();
  if (birth.mode === 'russia') {
    out.add('snow').add('postSoviet');
    if (place === 'capital' && year >= lists.metroSinceRussia) out.add('metro');
    return out;
  }
  const key = birth.country.startsWith('region:') ? birth.country.trim() : birth.country;
  for (const k of LAND_KEYS) if (lists[k].some((c) => c.trim() === key)) out.add(k);
  if (place === 'village') out.delete('metro');
  return out;
}

/** Почему событие не подходит месту (null — подходит). */
export function landMismatch(id: string, land: ReadonlySet<LandKey>): string | null {
  const t = eventTags(id);
  const missing = (t.land ?? []).filter((k) => !land.has(k as LandKey));
  if (missing.length) return `нужно ${missing.join(', ')}`;
  const extra = (t.landNo ?? []).filter((k) => land.has(k as LandKey));
  if (extra.length) return `не бывает при ${extra.join(', ')}`;
  return null;
}
