// Что: весь контент игры одним объектом — события, паузы, душа, данные стран и эпох, свои тексты, бренд.
// Кто зовёт: ядро src/core, интерфейс, scripts/sim-lives.ts и scripts/validate-content.ts (через Node, поэтому импорт с with json).
// Держать: тексты и числа — только в content/, здесь лишь склейка.

import worldEvents from '../../content/events/world.json' with { type: 'json' };
import russiaEvents from '../../content/events/russia.json' with { type: 'json' };
import pauses from '../../content/pauses.json' with { type: 'json' };
import soul from '../../content/soul.json' with { type: 'json' };
import world from '../../content/data/world.json' with { type: 'json' };
import eras from '../../content/data/russia-eras.json' with { type: 'json' };
import countryNames from '../../content/data/country-names.json' with { type: 'json' };
import life from '../../content/life.json' with { type: 'json' };
import tags from '../../content/event-tags.json' with { type: 'json' };
import brand from '../../content/brand.json' with { type: 'json' };
import type { Country, Era, EventTags, GameEvent, RegionGroup, Scales } from './types.ts';

export interface Pause {
  age: number;
  question: string;
  answers: string[];
}

export interface Trait {
  id: string;
  name: string;
  short: string;
  trigger: string;
  bias: Scales;
}

export interface Inclination {
  id: string;
  name: string;
  short: string;
  bias: Scales;
}

export interface WhenText {
  when: string;
  text: string;
  type?: string;
}

export const content = {
  worldEvents: worldEvents as GameEvent[],
  russiaEvents: russiaEvents as GameEvent[],
  pauses: pauses as Pause[],
  soul: soul as unknown as {
    inclinations: Inclination[];
    traits: Trait[];
    soulLines: { life: string[]; remembered: string[] };
    deathCauses: Record<string, string[]>;
    epitaphs: WhenText[];
    shareTexts: { death: string[]; birth: string[] };
    cardQuotes: WhenText[];
    ui: { buttons: Record<string, string>; screens: Record<string, string>; sharedBanner: { title: string; line: string; friendTitle: string; friendEnd: string; needInclination: string } };
  },
  world: world as unknown as {
    source: string;
    years: Record<string, string[]>;
    topShare: number;
    countries: Country[];
    otherByRegion: RegionGroup[];
  },
  eras: (eras as unknown as { eras: Era[] }).eras,
  countryNames: (countryNames as { names: Record<string, string> }).names,
  life,
  tags: (tags as { events: Record<string, EventTags> }).events,
  brand,
};

export type Content = typeof content;

export function eventTags(id: string): EventTags {
  return content.tags[id] ?? {};
}
