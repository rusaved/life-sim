// Что: выбирает площадку этой сборки по __PLATFORM__; чужие модули в сборку не попадают.
// Кто зовёт: src/main.ts.
// Держать: ветки сравнивают константу сборки, поэтому лишние динамические импорты выпадают.

import type { Platform } from './types.ts';
import vk from '../../content/vk.json';
import brand from '../../content/brand.json';

export async function loadPlatform(): Promise<Platform> {
  if (__PLATFORM__ === 'vk') {
    const m = await import('./vk.ts');
    const mock = new URLSearchParams(location.search).get('mock') === 'vk' && !m.launchedByPlatform(location.search);
    const bridge = mock ? (await import('./vk-mock.ts')).createVkMock() : (await import('@vkontakte/vk-bridge')).default;
    const appLink = vk.appId ? `https://vk.com/app${vk.appId}` : brand.siteUrl;
    return m.createVkPlatform(bridge as unknown as import('./vk.ts').VkBridgeLike, appLink);
  }
  const m = await import('./null.ts');
  return m.createNullPlatform();
}
