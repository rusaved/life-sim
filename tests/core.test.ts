import { describe, expect, it } from 'vitest';
import { makeBirth } from '../src/core/birth.ts';
import { condition } from '../src/core/conditions.ts';
import { choose, pendingCrossroad, pendingEvent, pendingPause, replay, setFocus, startLife, step, type Life } from '../src/core/life.ts';
import { lifeExpectancy, calibrateAging } from '../src/core/mortality.ts';
import { isSeed, newSeed, seedMode } from '../src/core/rng.ts';
import { decodeSave, encodeSave, soulCode, soulFromCode, SAVE_LIMIT } from '../src/core/save.ts';
import { newSoul, rememberLife, soulBias, summarize, deathPost } from '../src/core/soul.ts';
import { agePair, gender, yearsWord } from '../src/core/text.ts';

const ZERO = { health: 0, happiness: 0, knowledge: 0, bonds: 0 };

function liveToEnd(life: Life, pickChoice = (n: number) => n - 1): Life {
  for (let guard = 0; !life.death && guard < 500; guard++) {
    const e = pendingEvent(life);
    const p = pendingPause(life);
    const c = pendingCrossroad(life);
    if (e) choose(life, pickChoice(e.choices.length));
    else if (p) choose(life, pickChoice(p.answers.length));
    else if (c) choose(life, pickChoice(c.options.length));
    else step(life);
    if (life.age === 7) setFocus(life, 'study');
  }
  return life;
}

describe('текст', () => {
  it('род и слово «год»', () => {
    expect(gender('Я {m:родился|f:родилась}', 'f')).toBe('Я родилась');
    expect([1, 2, 5, 11, 21, 22, 64, 100].map(yearsWord)).toEqual(['год', 'года', 'лет', 'лет', 'год', 'года', 'года', 'лет']);
    expect(agePair(0)).toEqual({ age: 'меньше', years: 'года' });
  });
});

describe('зерно и рождение', () => {
  it('одно зерно — один младенец', () => {
    for (const mode of ['world', 'russia'] as const) {
      const seed = newSeed(mode);
      expect(isSeed(seed)).toBe(true);
      expect(seedMode(seed)).toBe(mode);
      expect(makeBirth(seed)).toEqual(makeBirth(seed));
    }
  });
  it('Россия: эпоха, год и место из данных', () => {
    const b = makeBirth('rabcdefg');
    expect(b.country).toBe('RU');
    expect(b.era).not.toBeNull();
    expect(b.year - b.era!).toBeGreaterThanOrEqual(0);
    expect(b.year - b.era!).toBeLessThanOrEqual(9);
    expect(['capital', 'city', 'village']).toContain(b.place);
  });
  it('старение подобрано под ожидаемую жизнь', () => {
    for (const seed of ['w1234567', 'wzzzzzzz', 'r0000000', 'r9999999']) {
      const b = makeBirth(seed);
      expect(Math.abs(lifeExpectancy(b, calibrateAging(b)) - b.lifeExp)).toBeLessThan(0.2);
    }
  });
});

describe('жизнь', () => {
  it('проживается до конца, повтор по записи даёт то же', () => {
    const birth = makeBirth('wq1w2e3r');
    const life = liveToEnd(startLife(birth, ZERO));
    expect(life.death).not.toBeNull();
    const again = replay(birth, ZERO, life.actions);
    expect(again.death).toEqual(life.death);
    expect(again.scales).toEqual(life.scales);
    expect(again.log.length).toBe(life.log.length);
  });
  it('первое решение приходит в первые годы', () => {
    for (const seed of ['wabc1234', 'wxyz9876', 'r1a2b3c4']) {
      const life = startLife(makeBirth(seed), ZERO);
      while (!life.pending && !life.death) step(life);
      if (!life.death) expect(life.age).toBeLessThanOrEqual(2);
    }
  });
});

describe('душа', () => {
  it('запоминает черту, строка и пост собираются', () => {
    let soul = newSoul(() => 0.5);
    soul.inclination = 'clear-mind';
    const life = liveToEnd(startLife(makeBirth('wsoul001'), soulBias(soul)));
    const s = summarize(life, soul);
    soul = rememberLife(soul, life, s);
    expect(soul.traits).toEqual([s.trait.id]);
    expect(soul.lives).toHaveLength(1);
    expect(s.cause).not.toMatch(/[{}]/);
    expect(deathPost(life, s, 3)).not.toMatch(/[{}]/);
    expect(soulBias(soul).knowledge).toBeGreaterThan(0);
  });
  it('условия словами', () => {
    const f = { age: 85, scales: { health: 40, happiness: 75, knowledge: 10, bonds: 80 }, war: false, famine: true, partner: true, children: 0, grandchildren: false, risky: 5, loss: false, moves: 0 };
    expect(condition('прожил больше 80 лет и Связи ≥ 70')(f)).toBe(true);
    expect(condition('пережил войну или голод')(f)).toBe(true);
    expect(condition('выбрал рискованный вариант 5 и более раз за жизнь')(f)).toBe(true);
    expect(condition('Здоровье < 40 и прожил больше 40 лет')(f)).toBe(false);
    expect(() => condition('что-то новое')(f)).toThrow();
  });
});

describe('сохранение', () => {
  it('туда и обратно, в пределах VK Storage', () => {
    const soul = newSoul();
    for (let i = 0; i < 40; i++) soul.lives.push({ seed: 'w1234567', place: 'Другая страна: Латинская Америка, город', era: 'наше время', age: 77, trait: 'warm-hands', sex: 'f', lifeShort: 'тёплая жизнь среди людей' });
    soul.traits = Array(40).fill('warm-hands');
    const text = encodeSave({ v: 1, t: 1, soul, life: { seed: 'w7654321', bias: ZERO, actions: 'y0yyy1'.repeat(40) }, mode: 'world', sound: false });
    expect(text.length).toBeLessThanOrEqual(SAVE_LIMIT);
    const back = decodeSave(text)!;
    expect(back.life?.seed).toBe('w7654321');
    expect(back.sound).toBe(false);
    expect(decodeSave('{broken')).toBeNull();
  });
  it('код души', () => {
    const soul = newSoul();
    soul.traits = ['courage', 'roots'];
    expect(soulFromCode(soulCode(soul))).toEqual(soul);
    expect(soulFromCode('мусор')).toBeNull();
  });
});
