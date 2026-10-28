import { expect, test } from '@playwright/test';
import { bornNew, checkLayout, liveToEnd, watch } from './helpers.ts';

test('жизнь до конца на 16×: первое решение ≤ 20 с, итог, карточки, лист «Поделиться» сам, без ошибок', async ({ page }) => {
  const w = watch(page);
  await bornNew(page);
  await expect(page.locator('.ask')).toBeVisible({ timeout: 20_000 });
  const first = await page.evaluate(() => window.__FIRST_DECISION_MS__ ?? -1);
  expect(first).toBeGreaterThan(0);
  expect(first).toBeLessThanOrEqual(20_000);
  await checkLayout(page, 'решение');
  await page.locator('.ask [data-choice="0"]').click();
  await checkLayout(page, 'жизнь');
  const decisions = await liveToEnd(page);
  expect(decisions).toBeGreaterThan(0);
  await expect(page.locator('[data-epitaph]')).not.toBeEmpty();
  await expect(page.locator('[data-remembered]')).toBeVisible();
  // Лист «Поделиться» открывается сам, карточки обоих размеров рисуются.
  const card = page.locator('canvas[data-card="death"]');
  await expect(card).toBeVisible({ timeout: 5_000 });
  await expect(card).toHaveAttribute('data-size', '1080x1350');
  await checkLayout(page, 'лист «Поделиться»');
  await page.locator('[data-format="story"]').click();
  await expect(card).toHaveAttribute('data-size', '1080x1920');
  const painted = await card.evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let light = 0;
    for (let i = 0; i < d.length; i += 4 * 97) if (d[i]! > 150) light++;
    return light;
  });
  expect(painted).toBeGreaterThan(100);
  await page.locator('[data-action="close-share"]').click();
  await checkLayout(page, 'итог');
  expect(w.errors).toEqual([]);
  expect(w.foreign).toEqual([]);
});
