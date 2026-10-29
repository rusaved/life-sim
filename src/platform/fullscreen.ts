// Что: весь экран через Fullscreen API браузера.
// Кто зовёт: null.ts (сайт), vk.ts (заглушка ?mock=vk в обычной вкладке; в живом VK и ОК экран у площадки — не просим).
// Держать: браузер разрешает только из касания игрока; отказ — не ошибка, игра остаётся в окне.

export async function wholeScreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  if (document.fullscreenElement) return true;
  const el = document.documentElement;
  if (typeof el.requestFullscreen !== 'function') return false;
  try {
    await el.requestFullscreen({ navigationUI: 'hide' });
    return true;
  } catch {
    return false;
  }
}
