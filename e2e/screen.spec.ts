import { expect, test, type Page } from '@playwright/test';
import { watch } from './helpers.ts';

/** Считаем просьбы о весь экран: настоящий вызов браузера остаётся, сверху — счётчик. */
async function countAsks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __ASKS__: number };
    w.__ASKS__ = 0;
    const real = Element.prototype.requestFullscreen;
    Element.prototype.requestFullscreen = function (this: Element, ...a: Parameters<typeof real>) {
      w.__ASKS__++;
      return real.apply(this, a);
    };
  });
}
const asks = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { __ASKS__: number }).__ASKS__);
const whole = (page: Page): Promise<boolean> => page.evaluate(() => !!document.fullscreenElement);

for (const path of ['', 'vk/']) {
  test(`весь экран по первому касанию, не чаще раза в секунду, после выхода — снова (${path || 'сайт'})`, async ({ page }) => {
    const w = watch(page);
    await countAsks(page);
    await page.goto(`${path}?fresh=1${path ? '&mock=vk' : ''}`);
    await expect(page.locator('[data-screen="soul"]')).toBeVisible();
    await page.locator('[data-inclination]').first().tap();
    await expect.poll(() => whole(page)).toBe(true);
    expect(await asks(page)).toBe(1);
    // Вышли из весь экран (жест «назад» или сворачивание): следующее касание просит снова, но не чаще раза в секунду.
    await page.evaluate(() => document.exitFullscreen());
    await expect.poll(() => whole(page)).toBe(false);
    await page.waitForTimeout(1100);
    await page.locator('[data-inclination]').nth(1).tap();
    await page.locator('[data-inclination]').nth(2).tap();
    await expect.poll(() => whole(page)).toBe(true);
    expect(await asks(page)).toBe(2);
    expect(w.errors).toEqual([]);
    expect(w.foreign).toEqual([]);
  });
}

test('в живом VK весь экран не просим', async ({ page }) => {
  await countAsks(page);
  // Параметры запуска VK: мост настоящий (вне VK он молчит и отвечает по таймауту), игра идёт с локальным сохранением.
  await page.goto('vk/?fresh=1&vk_app_id=1&sign=test');
  await expect(page.locator('[data-screen="soul"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-inclination]').first().tap();
  await page.waitForTimeout(300);
  expect(await asks(page)).toBe(0);
  expect(await whole(page)).toBe(false);
});

test('скрытая вкладка: жизнь на паузе и тишина, вернулись — годы идут дальше', async ({ page }) => {
  const w = watch(page);
  await page.goto('?fresh=1&s=r0long02');
  await page.locator('[data-inclination]').first().click();
  await page.locator('[data-action="born-same"]').click();
  await page.locator('[data-action="start-life"]').click({ timeout: 10_000 });
  await page.locator('.ask [data-choice="0"]').click();
  await page.locator('[data-speed="16"]').click();
  const setHidden = (hidden: boolean): Promise<void> =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  const age = async (): Promise<number> => Number(await page.locator('[data-age]').getAttribute('data-age'));
  // Решения по пути закрываем, пока жизнь не пойдёт годами.
  await page.waitForTimeout(300);
  await setHidden(true);
  const before = await age();
  const hadAsk = await page.locator('.ask').isVisible();
  await page.waitForTimeout(1500);
  expect(await age()).toBe(before);
  // Звук после касаний уже создан: в скрытой вкладке он спит.
  await expect(page.locator('html')).toHaveAttribute('data-audio', 'suspended');
  await setHidden(false);
  if (hadAsk) await page.locator('.ask [data-choice="0"]').click();
  await expect.poll(age, { timeout: 5_000 }).toBeGreaterThan(before);
  expect(w.errors).toEqual([]);
});
