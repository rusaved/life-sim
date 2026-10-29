import { expect, test } from '@playwright/test';
import { liveToEnd, watch } from './helpers.ts';

test('ссылка друга: «Друг прожил 58 лет», подсказка у тусклой кнопки, после смерти «у друга 58, у тебя …», в ссылке свои годы', async ({ page, context }) => {
  const w = watch(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('?fresh=1&s=r4k2x9qa&a=58');
  await expect(page.locator('[data-shared] h3')).toHaveText('Друг прожил 58 лет. Получится дольше?');
  await expect(page.locator('[data-action="born-same"]')).toBeDisabled();
  await expect(page.locator('[data-hint="inclination"]')).toHaveText('Сначала выбери склонность');
  await page.locator('[data-inclination]').first().click();
  await expect(page.locator('[data-hint="inclination"]')).toHaveCount(0);
  await page.locator('[data-action="born-same"]').click();
  await page.locator('[data-action="start-life"]').click({ timeout: 10_000 });
  // Первая жизнь новой души: вопрос приходит сразу, в нулевой год.
  await expect(page.locator('.ask')).toBeVisible({ timeout: 5_000 });
  expect(await page.locator('[data-age]').getAttribute('data-age')).toBe('0');
  await liveToEnd(page);
  const mine = await page.locator('.years').textContent();
  await expect(page.locator('[data-friend]')).toContainText('У друга 58, у тебя ');
  expect(mine).toBeTruthy();
  await expect(page.locator('canvas[data-card="death"]')).toBeVisible({ timeout: 5_000 });
  await page.locator('[data-action="copy"]').click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/\?s=r4k2x9qa&a=\d+/);
  expect(w.errors).toEqual([]);
  expect(w.foreign).toEqual([]);
});
