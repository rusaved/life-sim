// Что: шанс умереть в каждый год жизни по статистике места рождения — младенческая и детская смертность, несчастные случаи,
// старение (закон Гомперца — Мейкхема), для эпох России — годы войн и голода. Старение подбирается так, чтобы ожидаемая длина жизни
// совпала с данными страны или эпохи.
// Кто зовёт: life.ts (каждый год), scripts/sim-lives.ts (сверка с данными).
// Держать: статистика главная — шкала «Здоровье» и достаток лишь слегка умножают риск.

import type { Birth } from './types.ts';

/** Скорость старения: риск растёт примерно вдвое каждые 8 лет. */
const AGING_RATE = 0.085;
const MAX_AGE = 115;

export interface HazardParts {
  infancy: number;
  accident: number;
  aging: number;
  war: number;
  famine: number;
}

/** Годы войн и голода для эпох России: добавочный риск за год (оценки, уже учтены в ожидаемой длине жизни эпохи). */
export function russiaExtra(year: number, age: number, birth: Birth): { war: number; famine: number } {
  let war = 0;
  let famine = 0;
  const male = birth.sex === 'm';
  const village = birth.place === 'village' ? 1.4 : birth.place === 'capital' ? 0.4 : 1;
  if (year >= 1914 && year <= 1917 && male && age >= 18 && age <= 45) war += 0.03;
  if (year >= 1918 && year <= 1922) war += 0.012;
  if (year >= 1921 && year <= 1922) famine += 0.025 * village;
  if (year >= 1932 && year <= 1933) famine += 0.02 * village;
  if (year >= 1941 && year <= 1945) war += male && age >= 17 && age <= 55 ? 0.09 : 0.015;
  if (year >= 1941 && year <= 1944) famine += 0.012;
  if (year >= 1946 && year <= 1947) famine += 0.008 * village;
  return { war, famine };
}

/** Трудные годы, которые человек застал (для черты «Стойкость»). */
export function hardYear(year: number): { war: boolean; famine: boolean } {
  return {
    war: (year >= 1914 && year <= 1922) || (year >= 1941 && year <= 1945),
    famine: (year >= 1921 && year <= 1922) || (year >= 1932 && year <= 1933) || (year >= 1941 && year <= 1947),
  };
}

function accidentRate(e0: number): number {
  return 0.0006 + 0.00008 * Math.max(0, 80 - e0);
}

export function hazard(birth: Birth, agingBase: number, age: number): HazardParts {
  const year = birth.year + age;
  const extra = birth.mode === 'russia' ? russiaExtra(year, age, birth) : { war: 0, famine: 0 };
  let infancy = 0;
  if (age === 0) infancy = -Math.log(1 - Math.min(0.9, birth.infantMort / 1000));
  else if (age <= 4) {
    const q = Math.min(0.9, birth.childMort / 1000 / (1 - birth.infantMort / 1000));
    infancy = -Math.log(Math.pow(1 - q, 1 / 4));
  }
  // До 2 лет риск — только младенческая и детская смертность из данных: войны, голод и болезни этих лет в ней уже есть.
  if (age < 2) return { infancy, accident: age >= 1 ? accidentRate(birth.lifeExp) : 0, aging: 0, war: 0, famine: 0 };
  return { infancy, accident: accidentRate(birth.lifeExp), aging: agingBase * Math.exp(AGING_RATE * age), ...extra };
}

export function totalHazard(p: HazardParts): number {
  return p.infancy + p.accident + p.aging + p.war + p.famine;
}

/** Ожидаемая длина жизни при данном уровне старения. */
export function lifeExpectancy(birth: Birth, agingBase: number): number {
  let alive = 1;
  let e0 = 0;
  for (let age = 0; age <= MAX_AGE; age++) {
    const q = age === MAX_AGE ? 1 : 1 - Math.exp(-totalHazard(hazard(birth, agingBase, age)));
    const dead = alive * q;
    e0 += (alive - dead) + dead * 0.5;
    alive -= dead;
  }
  return e0;
}

/** Уровень старения, при котором ожидаемая длина жизни совпадает с данными (поиск делением пополам по логарифму). */
export function calibrateAging(birth: Birth): number {
  let lo = Math.log(1e-9);
  let hi = Math.log(1);
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (lifeExpectancy(birth, Math.exp(mid)) > birth.lifeExp) lo = mid;
    else hi = mid;
  }
  return Math.exp((lo + hi) / 2);
}

/** Множитель риска от шкалы «Здоровье» и достатка: здоровье 0 — ×1,8, 100 — ×0,55; бедность ×1,1, достаток ×0,85. */
export function personalFactor(health: number, wealth: Birth['wealth']): number {
  const w = wealth === 'poor' ? 1.1 : wealth === 'rich' ? 0.85 : 1;
  return Math.exp((0.6 * (HEALTH_CENTER - health)) / 50) * w;
}

/** Здоровье, при котором риск равен статистике места (средний игрок держится около него — сверяет scripts/sim-lives.ts). */
export const HEALTH_CENTER = 65;
