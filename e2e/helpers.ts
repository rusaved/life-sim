import { expect, type Page } from '@playwright/test';

/** Ошибки консоли и страницы, и запросы на чужие хосты — каждый тест проверяет, что их нет. */
export function watch(page: Page): { errors: string[]; foreign: string[] } {
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['127.0.0.1', 'localhost'].includes(u.hostname) && !u.protocol.startsWith('data') && !u.protocol.startsWith('blob')) foreign.push(r.url());
  });
  return { errors, foreign };
}

/** Новая душа: склонность и мир — два касания до жребия. */
export async function bornNew(page: Page, path = '', mode: 'world' | 'russia' = 'world'): Promise<void> {
  await page.goto(`${path}?fresh=1${path.startsWith("vk") ? "&mock=vk" : ""}`);
  await page.locator('[data-inclination]').first().click();
  await page.locator(`[data-mode="${mode}"]`).click();
  await page.locator('[data-action="start-life"]').click({ timeout: 10_000 });
  await expect(page.locator('[data-screen="life"]')).toBeVisible();
}

/** Жизнь до конца: 16× и первый вариант в каждом решении; возвращает число решений. */
export async function liveToEnd(page: Page): Promise<number> {
  await page.locator('[data-speed="16"]').click();
  let decisions = 0;
  const end = page.locator('[data-screen="end"]');
  for (let i = 0; i < 400; i++) {
    if (await end.isVisible()) return decisions;
    const choice = page.locator('.ask [data-choice="0"]');
    if (await choice.isVisible()) {
      await choice.click();
      decisions++;
    } else {
      // Касание скорости между годами: так же ловится миг смерти (раньше таймер итога снимался и экран застывал).
      await page.locator('[data-speed="16"]').click({ timeout: 2_000 }).catch(() => {});
      await page.waitForTimeout(40);
    }
  }
  throw new Error('жизнь не закончилась');
}

/** Ничего шире экрана; касания от 44 px; шрифт от 14 px у видимого текста. */
export async function checkLayout(page: Page, where: string): Promise<void> {
  // Касания меряются без трансформаций (нажатая кнопка чуть сжимается), анимации появления успевают закончиться.
  await page.waitForTimeout(350);
  const r = await page.evaluate(() => {
    const vw = window.innerWidth;
    const wide: string[] = [];
    const small: string[] = [];
    const tiny: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height || getComputedStyle(el).visibility === 'hidden') continue;
      if (el.closest('.sheet-back') && !document.querySelector('.sheet-back')) continue;
      if (box.right > vw + 1 || box.left < -1) wide.push(`${el.tagName}.${el.className} ${Math.round(box.left)}..${Math.round(box.right)}`);
      if ((el.tagName === 'BUTTON' || el.tagName === 'SUMMARY') && (el.offsetHeight < 44 || el.offsetWidth < 44)) small.push(`${el.textContent?.slice(0, 20)} ${el.offsetWidth}×${el.offsetHeight}`);
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (own && parseFloat(getComputedStyle(el).fontSize) < 14) tiny.push(`${el.tagName} «${el.textContent?.slice(0, 20)}» ${getComputedStyle(el).fontSize}`);
    }
    return { wide, small, tiny, scroll: document.documentElement.scrollWidth - vw };
  });
  expect(r.wide, `${where}: шире экрана`).toEqual([]);
  expect(r.scroll, `${where}: горизонтальная прокрутка`).toBeLessThanOrEqual(0);
  expect(r.small, `${where}: касания меньше 44 px`).toEqual([]);
  expect(r.tiny, `${where}: шрифт меньше 14 px`).toEqual([]);
}
