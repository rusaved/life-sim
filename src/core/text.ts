// Что: шаблоны текста — род {m:…|f:…}, подстановки {place}, слово «год/года/лет», сборка строк.
// Кто зовёт: всё, что показывает тексты из content/.
// Держать: неизвестная подстановка остаётся как есть — проверка контента её ловит.

export type Sex = 'm' | 'f';

const GENDER_RE = /\{m:([^|{}]*)\|f:([^{}]*)\}/g;

export function gender(text: string, sex: Sex): string {
  return text.replace(GENDER_RE, (_, m: string, f: string) => (sex === 'm' ? m : f));
}

export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{([a-z]+)\}/g, (all, key: string) => (key in vars ? String(vars[key]) : all));
}

/** 1 год, 2 года, 5 лет, 11 лет, 21 год. */
export function yearsWord(n: number): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return 'лет';
  if (b === 1) return 'год';
  if (b >= 2 && b <= 4) return 'года';
  return 'лет';
}

/** Возраст словами: «меньше года» для младенцев, иначе «64 года». Пара для шаблонов {age} {years}. */
export function agePair(age: number): { age: string; years: string } {
  if (age < 1) return { age: 'меньше', years: 'года' };
  return { age: String(age), years: yearsWord(age) };
}

export function ageText(age: number): string {
  const p = agePair(age);
  return `${p.age} ${p.years}`;
}

export function capitalize(text: string): string {
  return text ? text[0]!.toUpperCase() + text.slice(1) : text;
}
