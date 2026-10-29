import { expect, test } from '@playwright/test';
import { watch } from './helpers.ts';

test('метка сборки: на сайте не видна, по ?build=1 видна на сайте и в vk/', async ({ page }) => {
  const w = watch(page);
  await page.goto('?fresh=1');
  await expect(page.locator('[data-screen="soul"]')).toBeVisible();
  await expect(page.locator('[data-build]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Об игре' }).click();
  await expect(page.locator('[data-screen="about"]')).toBeVisible();
  await expect(page.locator('[data-build]')).toHaveCount(0);
  await page.goto('?build=1');
  await page.getByRole('button', { name: 'Об игре' }).click();
  await expect(page.locator('[data-build]')).toContainText('LS');
  await page.goto('vk/?mock=vk&build=1');
  await page.getByRole('button', { name: 'Об игре' }).click();
  await expect(page.locator('[data-build]')).toContainText('LS');
  expect(w.errors).toEqual([]);
  expect(w.foreign).toEqual([]);
});
