// Что: локальное хранилище браузера с защитой от приватного режима и выбор свежего сохранения из двух.
// Кто зовёт: null.ts, vk.ts.
// Держать: любое обращение к localStorage может бросить — всегда через try.

export const SAVE_KEY = 'life-sim:save';

export function localGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function localSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* приватный режим: сохранение живёт до закрытия вкладки */
  }
}

export function localRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* нечего удалять */
  }
}

/** Время записи из сохранения (поле t); 0 — не разобрать. */
export function savedAt(text: string | null | undefined): number {
  if (!text) return 0;
  try {
    const t = (JSON.parse(text) as { t?: unknown }).t;
    return typeof t === 'number' ? t : 0;
  } catch {
    return 0;
  }
}

/** Из двух сохранений — более позднее. */
export function newest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return savedAt(b) > savedAt(a) ? b : a;
}
