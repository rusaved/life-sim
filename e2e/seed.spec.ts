import { expect, test } from '@playwright/test';
import { watch } from './helpers.ts';

test('?s=<seed> повторяет рождение: то же свидетельство', async ({ page }) => {
  const w = watch(page);
  const certificate = async (): Promise<string> => {
    await page.locator('[data-inclination]').first().click();
    await expect(page.locator('[data-shared]')).toBeVisible();
    await page.locator('[data-action="born-same"]').click();
    await expect(page.locator('[data-screen="birth"]')).toBeVisible({ timeout: 10_000 });
    return (await page.locator('.cert dl').textContent()) ?? '';
  };
  await page.goto('?fresh=1&s=r4k2x9qa');
  const a = await certificate();
  await page.goto('?fresh=1&s=r4k2x9qa');
  const b = await certificate();
  expect(a).toBe(b);
  expect(a).toContain('Россия');
  await page.goto('?fresh=1&s=wq7m3z1b');
  const c = await certificate();
  expect(c).not.toContain('Россия, в');
  expect(w.errors).toEqual([]);
});
