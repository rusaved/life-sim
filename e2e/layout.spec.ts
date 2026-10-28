import { expect, test } from '@playwright/test';
import { checkLayout, watch } from './helpers.ts';

test('экраны души, свидетельства и «Об игре» помещаются', async ({ page }) => {
  const w = watch(page);
  await page.goto('?fresh=1');
  await page.waitForTimeout(500);
  await checkLayout(page, 'душа');
  await page.locator('[data-inclination]').first().click();
  await page.locator('[data-mode="russia"]').click();
  await expect(page.locator('[data-screen="birth"]')).toBeVisible({ timeout: 10_000 });
  await checkLayout(page, 'свидетельство');
  await page.locator('[data-action="share-birth"]').click();
  await expect(page.locator('canvas[data-card="birth"]')).toHaveAttribute('data-size', '1080x1350');
  await checkLayout(page, 'карточка рождения');
  await page.locator('[data-action="close-share"]').click();
  await page.getByRole('button', { name: 'Об игре' }).click();
  await expect(page.locator('[data-screen="about"]')).toBeVisible();
  await checkLayout(page, 'об игре');
  // Звук выключается и помнится.
  await page.getByRole('button', { name: 'Назад' }).click();
  await page.locator('[data-sound]').first().click();
  await page.reload();
  await expect(page.locator('[data-sound]').first()).toHaveAttribute('aria-label', 'Звук выключен');
  expect(w.errors).toEqual([]);
  expect(w.foreign).toEqual([]);
});
