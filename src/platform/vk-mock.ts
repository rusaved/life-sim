// Что: заглушка VK Bridge для ?mock=vk в обычной вкладке и для e2e сборки vk/: init, Storage в localStorage, «Поделиться» и история —
// короткое окошко с ответом.
// Кто зовёт: src/platform/index.ts (только ?mock=vk без параметров запуска VK и ОК).
// Держать: ни одного запроса в сеть; вызовы видны в window.__VK_MOCK__.calls.

import type { VkBridgeLike } from './vk.ts';

const STORE = 'vkmock:';

function notice(text: string): Promise<void> {
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.dataset.vkMock = 'window';
    box.textContent = text;
    box.style.cssText =
      'position:fixed;left:16px;right:16px;bottom:24px;z-index:10000;background:#2b2722;color:#f3ece2;border-radius:12px;padding:14px 16px;font:500 15px/1.4 system-ui,sans-serif;text-align:center';
    document.body.appendChild(box);
    setTimeout(() => {
      box.remove();
      resolve();
    }, 1200);
  });
}

export function createVkMock(): VkBridgeLike {
  const w = window as unknown as { __VK_MOCK__?: { calls: Array<{ method: string }> } };
  w.__VK_MOCK__ = { calls: [] };
  const get = (k: string): string => {
    try {
      return localStorage.getItem(STORE + k) ?? '';
    } catch {
      return '';
    }
  };
  const set = (k: string, v: string): void => {
    try {
      localStorage.setItem(STORE + k, v);
    } catch {
      /* приватный режим */
    }
  };
  return {
    async send(method, params) {
      w.__VK_MOCK__!.calls.push({ method });
      switch (method) {
        case 'VKWebAppInit':
          return { result: true };
        case 'VKWebAppStorageGet':
          return { keys: ((params?.keys as string[]) ?? []).map((key) => ({ key, value: get(key) })) };
        case 'VKWebAppStorageSet':
          set(String(params?.key), String(params?.value ?? ''));
          return { result: true };
        case 'VKWebAppShare':
          await notice('Заглушка VK: окно «Поделиться ссылкой»');
          return [{ type: 'message' }];
        case 'VKWebAppShowStoryBox':
          await notice('Заглушка VK: редактор истории с картинкой');
          return { result: true };
        default:
          throw new Error(`${method}: нет в заглушке`);
      }
    },
  };
}
