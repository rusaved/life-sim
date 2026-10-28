import { expect, test } from '@playwright/test';
import { bornNew, liveToEnd, watch } from './helpers.ts';

test('посреди жизни перезагрузка — «Продолжить» с того же возраста', async ({ page }) => {
  const w = watch(page);
  // Зерно, чья жизнь при первых вариантах длится 95 лет (Россия, 1960-е): проверка не зависит от случая.
  await page.goto('?fresh=1&s=r0long02');
  await page.locator('[data-inclination]').first().click();
  await page.locator('[data-action="born-same"]').click();
  await page.locator('[data-action="start-life"]').click({ timeout: 10_000 });
  await page.locator('[data-speed="16"]').click();
  for (let i = 0; i < 6; i++) {
    const choice = page.locator('.ask [data-choice="0"]');
    await choice.waitFor({ timeout: 20_000 }).catch(() => {});
    if (await page.locator('[data-screen="end"]').isVisible()) break;
    if (await choice.isVisible()) await choice.click();
  }
  await expect(page.locator('.ask')).toBeVisible({ timeout: 20_000 });
  const age = await page.locator('[data-age]').getAttribute('data-age');
  await page.reload();
  await page.locator('[data-action="continue"]').click();
  await expect(page.locator('.ask')).toBeVisible();
  expect(await page.locator('[data-age]').getAttribute('data-age')).toBe(age);
  expect(w.errors).toEqual([]);
});

test('душа переживает перезагрузку: черта и строка жизни', async ({ page }) => {
  const w = watch(page);
  await bornNew(page);
  await liveToEnd(page);
  const trait = await page.locator('[data-remembered]').getAttribute('data-remembered');
  await page.reload();
  await expect(page.locator('[data-screen="soul"]')).toBeVisible();
  await expect(page.locator('.memorial li')).toHaveCount(1);
  await expect(page.locator('.trait')).toHaveCount(1);
  expect(trait).toBeTruthy();
  // Вторая жизнь: мир выбирается одним касанием, свидетельство говорит «жизнь 2».
  await page.locator('[data-mode]').first().click();
  await expect(page.locator('.cert')).toContainText('жизнь 2', { timeout: 10_000 });
  expect(w.errors).toEqual([]);
});
