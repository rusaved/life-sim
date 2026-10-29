import { expect, test, type Page } from '@playwright/test';
import { bornNew, checkLayout, watch } from './helpers.ts';

/** Видимые кнопки, вылезшие за край экрана (хоть на пиксель). */
async function outside(page: Page, scope: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const out: string[] = [];
    for (const b of Array.from(document.querySelectorAll<HTMLElement>(`${sel} button`))) {
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.top < -1 || r.left < -1 || r.bottom > innerHeight + 1 || r.right > innerWidth + 1) out.push(`${b.textContent?.slice(0, 24)} ${Math.round(r.top)}..${Math.round(r.bottom)}`);
    }
    return out;
  }, scope);
}
const scrolls = (page: Page, sel: string): Promise<number> => page.locator(sel).evaluate((el) => el.scrollHeight - el.clientHeight);
const shot = (page: Page, name: string): Promise<Buffer> =>
  page.screenshot({ path: `docs/evidence/LS2/${name}-${page.viewportSize()!.width}x${page.viewportSize()!.height}.jpg`, type: 'jpeg', quality: 60, scale: 'css' });

test('телефон боком: вопрос и все ответы справа без прокрутки, лента ≥ 120 px, лист «Поделиться» без прокрутки', async ({ page }) => {
  const w = watch(page);
  await bornNew(page, '', 'russia');
  let asked = 0;
  // Несколько вопросов подряд: каждый целиком на экране.
  for (let i = 0; i < 400 && asked < 12; i++) {
    if (await page.locator('[data-screen="end"]').isVisible()) break;
    const ask = page.locator('.ask');
    if (await ask.isVisible()) {
      await page.waitForTimeout(250);
      expect(await outside(page, '.ask'), `вопрос ${asked + 1}: кнопки за краем`).toEqual([]);
      expect(await scrolls(page, '.ask'), `вопрос ${asked + 1}: прокрутка`).toBeLessThanOrEqual(1);
      const feed = await page.locator('.feed').boundingBox();
      expect(feed!.height, 'лента').toBeGreaterThanOrEqual(120);
      if (asked === 1) await shot(page, 'landscape-ask'), await checkLayout(page, 'вопрос боком');
      await page.locator('.ask [data-choice]').last().click();
      asked++;
    } else {
      await page.locator('[data-action="skip"]').click({ timeout: 1_000 }).catch(() => {});
      await page.waitForTimeout(40);
    }
  }
  expect(asked).toBeGreaterThan(0);
  expect(await outside(page, '[data-screen="life"]')).toEqual([]);
  // До конца жизни — и лист «Поделиться».
  for (let i = 0; i < 600; i++) {
    if (await page.locator('[data-screen="end"]').isVisible()) break;
    const choice = page.locator('.ask [data-choice="0"]');
    if (await choice.isVisible()) await choice.click();
    else await page.locator('[data-action="skip"]').click({ timeout: 1_000 }).catch(() => {});
    await page.waitForTimeout(30);
  }
  const sheet = page.locator('.sheet');
  await expect(sheet).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(400);
  for (const format of ['post', 'story']) {
    await page.locator(`.seg [data-format="${format}"]`).click();
    await page.waitForTimeout(150);
    expect(await outside(page, '.sheet'), `лист ${format}: кнопки за краем`).toEqual([]);
    expect(await scrolls(page, '.sheet'), `лист ${format}: прокрутка`).toBeLessThanOrEqual(1);
  }
  await shot(page, 'landscape-share');
  await checkLayout(page, 'лист боком');
  await page.locator('[data-action="close-share"]').click();
  await checkLayout(page, 'итог боком');
  expect(w.errors).toEqual([]);
});

test('телефон боком: душа, свидетельство и карточка рождения', async ({ page }) => {
  const w = watch(page);
  await page.goto('?fresh=1');
  await checkLayout(page, 'душа боком');
  await page.locator('[data-inclination]').first().click();
  await page.locator('[data-mode="world"]').click();
  await expect(page.locator('[data-screen="birth"]')).toBeVisible({ timeout: 10_000 });
  await checkLayout(page, 'свидетельство боком');
  await page.locator('[data-action="share-birth"]').click();
  await page.waitForTimeout(400);
  expect(await outside(page, '.sheet')).toEqual([]);
  expect(await scrolls(page, '.sheet')).toBeLessThanOrEqual(1);
  expect(w.errors).toEqual([]);
});
