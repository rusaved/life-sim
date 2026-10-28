// Что: условия из content/soul.json словами («прожил больше 80 лет и Связи ≥ 70») — разбор в проверку по итогам жизни.
// Кто зовёт: soul.ts (черты, эпитафии, цитаты карточки), scripts/validate-content.ts (каждое условие разбирается).
// Держать: незнакомое условие — ошибка, а не молчаливое «нет»: так новый текст не пропадёт тихо.

import type { Scales } from './types.ts';

export interface LifeFacts {
  age: number;
  scales: Scales;
  war: boolean;
  famine: boolean;
  partner: boolean;
  children: number;
  grandchildren: boolean;
  risky: number;
  loss: boolean;
  moves: number;
}

type Check = (f: LifeFacts) => boolean;

const SCALE: Record<string, keyof Scales> = { Здоровье: 'health', Счастье: 'happiness', Знания: 'knowledge', Связи: 'bonds' };

function clause(text: string): Check {
  const t = text.trim();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^прожил больше (\d+) лет$/))) {
    const n = Number(m[1]);
    return (f) => f.age > n;
  }
  if ((m = t.match(/^прожил меньше (\d+) лет$/))) {
    const n = Number(m[1]);
    return (f) => f.age < n;
  }
  if ((m = t.match(/^(Здоровье|Счастье|Знания|Связи)(?: в конце жизни)? (≥|<) (\d+)$/))) {
    const key = SCALE[m[1]!]!;
    const n = Number(m[3]);
    return m[2] === '≥' ? (f) => f.scales[key] >= n : (f) => f.scales[key] < n;
  }
  if ((m = t.match(/^все четыре шкалы в конце жизни ≥ (\d+)$/))) {
    const n = Number(m[1]);
    return (f) => Object.values(f.scales).every((v) => v >= n);
  }
  switch (t) {
    case 'пережил войну или голод':
      return (f) => f.war || f.famine;
    case 'пережил войну':
      return (f) => f.war;
    case 'пережил голод':
      return (f) => f.famine;
    case 'есть семья (брак или дети)':
      return (f) => f.partner || f.children > 0;
    case 'есть дети или внуки':
      return (f) => f.children > 0 || f.grandchildren;
    case 'любая жизнь (запасной вариант)':
      return () => true;
    case 'выбрал рискованный вариант 5 и более раз за жизнь':
      return (f) => f.risky >= 5;
    case 'пережил потерю близкого человека':
      return (f) => f.loss;
    case 'прожил всю жизнь на одном месте, без переездов':
      return (f) => f.moves === 0 && f.age >= 18;
    case 'переезжал 3 и более раз':
      return (f) => f.moves >= 3;
  }
  throw new Error(`условие не разобрано: «${t}»`);
}

const cache = new Map<string, Check>();

export function condition(text: string): Check {
  let c = cache.get(text);
  if (!c) {
    // «5 и более раз» — одно условие, а не два.
    const parts = text.replace(' и более', '\u0000более').split(' и ').map((t) => clause(t.replace('\u0000более', ' и более')));
    c = (f) => parts.every((p) => p(f));
    cache.set(text, c);
  }
  return c;
}
