import { defineConfig } from '@playwright/test';

// e2e против собранной ссылки продюсера (dist-pages: сайт в корне, vk/ рядом) на своём статическом сервере.
// Телефон стоя — главный экран: 405×880, 405×720, 375×667; ПК — 1280×800. Запуск — только в итоге вехи (npm run verify).
const port = Number(process.env.E2E_PORT || 4191);
const phone = (width: number, height: number) => ({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 3,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: `http://127.0.0.1:${port}/`,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone-405x880', use: phone(405, 880) },
    { name: 'phone-405x720', use: phone(405, 720), testMatch: /(life|layout)\.spec\.ts$/ },
    { name: 'phone-375x667', use: phone(375, 667), testMatch: /(life|layout)\.spec\.ts$/ },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } }, testMatch: /(layout|vk)\.spec\.ts$/ },
  ],
  webServer: {
    command: `node scripts/serve-static.mjs dist-pages ${port}`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
