import { expect, test } from '@playwright/test';
import { bornNew, liveToEnd, watch } from './helpers.ts';

test('vk/: заглушка моста, сохранение через VK Storage, ни одного чужого запроса', async ({ page }) => {
  const w = watch(page);
  await bornNew(page, 'vk/', 'russia');
  await liveToEnd(page);
  const calls = await page.evaluate(() => (window as unknown as { __VK_MOCK__: { calls: Array<{ method: string }> } }).__VK_MOCK__.calls.map((c) => c.method));
  expect(calls[0]).toBe('VKWebAppInit');
  expect(calls).toContain('VKWebAppStorageSet');
  await expect(page.locator('[data-action="story"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('.memorial li')).toHaveCount(1);
  expect(w.errors).toEqual([]);
  expect(w.foreign).toEqual([]);
});
