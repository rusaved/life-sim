// Что: рождение по зерну — страна по доле рождений мира или эпоха России по числу рождений, место, пол, достаток, шансы на жизнь.
// Кто зовёт: интерфейс при «Родиться», ?s=<seed>, scripts/sim-lives.ts.
// Держать: рождение зависит только от зерна (не от души) — ссылка друга даёт того же младенца.

import { content } from './data.ts';
import { int, makeRng, next, seedMode, weighted, type Rng } from './rng.ts';
import type { Birth, Place, Wealth } from './types.ts';

/** Год «нашего времени» для режима «Мир». */
export const WORLD_YEAR = 2026;
const WEALTH: Wealth[] = ['poor', 'middle', 'rich'];
/** Разница ожидаемой жизни женщин и мужчин в мире (оценка ООН — около 5 лет). */
const SEX_GAP = 5;
/** Доля столицы среди горожан в режиме «Мир» (у разных стран 10–30 %). */
const WORLD_CAPITAL_OF_URBAN = 0.18;

function wealthFrom(rng: Rng, odds: number[]): Wealth {
  return weighted(rng, WEALTH, (w) => odds[WEALTH.indexOf(w)] ?? 0);
}

function incomeOfGdp(gdp: number): string {
  if (gdp < 3500) return 'Low income';
  if (gdp < 12000) return 'Lower middle income';
  if (gdp < 30000) return 'Upper middle income';
  return 'High income';
}

function placeFrom(rng: Rng, urbanPct: number, capitalPct: number): Place {
  const r = next(rng) * 100;
  if (r < capitalPct) return 'capital';
  if (r < urbanPct) return 'city';
  return 'village';
}

export function makeBirth(seed: string): Birth {
  const rng = makeRng(seed);
  const mode = seedMode(seed);
  const sex = next(rng) < 0.512 ? 'm' : 'f';
  const odds = content.life.wealthOdds as unknown as Record<string, number[]> & { era: Record<string, number[]> };
  if (mode === 'russia') {
    const era = weighted(rng, content.eras, (e) => e.birthsPerYear);
    const year = era.year + int(rng, 0, 9);
    const place = placeFrom(rng, era.urbanShare, era.capitalShare);
    const wealth = wealthFrom(rng, odds.era[String(era.year)] ?? [0.4, 0.5, 0.1]);
    const lifeExp = sex === 'm' ? era.lifeExp.male : era.lifeExp.female;
    // Смертность от 1 до 5 лет у эпох не дана отдельно: ранние эпохи — около половины младенческой, поздние — четверть.
    const childShare = era.year <= 1940 ? 0.55 : 0.25;
    return { seed, mode, sex, country: 'RU', place, wealth, year, era: era.year, lifeExp, infantMort: era.infantMort, childMort: era.infantMort * childShare, literacy: era.literacy };
  }
  const pool = [
    ...content.world.countries.map((c) => ({ key: c.iso2, share: c.birthShare, row: c, income: c.income })),
    ...content.world.otherByRegion.map((g) => ({ key: `region:${g.group.trim()}`, share: g.birthShare, row: g, income: incomeOfGdp(g.gdpPppPc) })),
  ];
  const hit = weighted(rng, pool, (x) => x.share);
  const { row } = hit;
  const place = placeFrom(rng, row.urban, row.urban * WORLD_CAPITAL_OF_URBAN);
  const wealth = wealthFrom(rng, odds[hit.income] ?? [0.4, 0.5, 0.1]);
  const lifeExp = row.lifeExp + (sex === 'f' ? SEX_GAP / 2 : -SEX_GAP / 2);
  const childMort = Math.max(0, row.under5Mort - row.infantMort);
  return { seed, mode, sex, country: hit.key, place, wealth, year: WORLD_YEAR, era: null, lifeExp, infantMort: row.infantMort, childMort, literacy: row.literacy };
}

/** «Индия», «Другая страна: Южная Азия», «Россия». */
export function countryName(birth: Birth): string {
  if (birth.mode === 'russia') return content.life.russia;
  if (birth.country.startsWith('region:')) {
    const group = birth.country.slice(7);
    const region = (content.life.regions as Record<string, string>)[group] ?? group;
    return content.life.otherCountry.replace('{region}', region);
  }
  return content.countryNames[birth.country] ?? birth.country;
}

/** «1940-е» или «наше время». */
export function eraName(birth: Birth): string {
  if (birth.era === null) return content.life.worldEra;
  return content.life.eraName.replace('{decade}', String(birth.era));
}

/** Место для строк души и карточек: «Россия, село», «Индия, город». */
export function placeName(birth: Birth, place = birth.place): string {
  return `${countryName(birth)}, ${content.life.places[place]}`;
}
