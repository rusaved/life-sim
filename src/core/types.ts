// Что: общие типы данных content/ и состояния жизни.
// Кто зовёт: всё ядро src/core и интерфейс.
// Держать: поля совпадают с JSON в content/ — проверка контента сверяет.

import type { Sex } from './text.ts';
import type { Mode } from './rng.ts';

export interface Scales {
  health: number;
  happiness: number;
  knowledge: number;
  bonds: number;
}
export type ScaleKey = keyof Scales;
export const SCALE_KEYS: ScaleKey[] = ['health', 'happiness', 'knowledge', 'bonds'];

export type Place = 'capital' | 'city' | 'village';
export type Wealth = 'poor' | 'middle' | 'rich';

export interface Choice {
  label: string;
  effect: Scales;
  result: string;
}

export interface GameEvent {
  id: string;
  era?: number[];
  years?: number[];
  age: number[];
  where: string[];
  wealth: string[];
  weight: number;
  text: string;
  decision: boolean;
  choices: Choice[];
  effect?: Scales;
}

export interface EventTags {
  modern?: boolean;
  needs?: string[];
  needsNo?: string[];
  gives?: string[];
  choices?: Record<string, string[]>;
}

export interface Country {
  iso2: string;
  region: string;
  income: string;
  lifeExp: number;
  infantMort: number;
  under5Mort: number;
  urban: number;
  literacy: number;
  gdpPppPc: number;
  birthShare: number;
}

export interface RegionGroup {
  group: string;
  birthShare: number;
  lifeExp: number;
  infantMort: number;
  under5Mort: number;
  urban: number;
  literacy: number;
  gdpPppPc: number;
}

export interface Era {
  year: number;
  lifeExp: { all: number; male: number; female: number };
  infantMort: number;
  urbanShare: number;
  capitalShare: number;
  literacy: number;
  birthsPerYear: number;
}

export interface Birth {
  seed: string;
  mode: Mode;
  sex: Sex;
  /** Код страны iso2, 'region:<группа>' для «другой страны региона» или 'RU' для эпох. */
  country: string;
  place: Place;
  wealth: Wealth;
  year: number;
  /** Эпоха (год начала десятилетия) в режиме «Россия». */
  era: number | null;
  lifeExp: number;
  infantMort: number;
  childMort: number;
  literacy: number;
}

export type { Sex, Mode };
