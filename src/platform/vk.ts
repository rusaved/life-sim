// Что: площадка ВКонтакте и Одноклассников через VK Bridge — VKWebAppInit первым, сохранение в VK Storage (локальная копия как запас),
// «Поделиться» ссылкой и история с картинкой.
// Кто зовёт: src/platform/index.ts (мост из npm или заглушка ?mock=vk); tests/vk.test.ts с поддельным мостом.
// Держать: у каждого вызова моста предел времени (вне VK и без сети игра не висит); значение VK Storage — до 4 096 знаков.

import type { Platform, ShareResult } from './types.ts';
import { SAVE_KEY, localGet, localSet, newest } from './storage.ts';

export interface VkBridgeLike {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

export const VK_KEY = 'save';
export const VK_VALUE_MAX = 4096;
const TIMEOUT_MS = 4000;

/** Игру запустил сам VK или ОК (подписанные параметры), а не обычная вкладка. */
export function launchedByPlatform(search: string): boolean {
  const q = new URLSearchParams(search);
  return q.has('vk_app_id') && q.has('sign');
}

export function createVkPlatform(bridge: VkBridgeLike, appLink: string): Platform {
  const call = (method: string, params?: Record<string, unknown>): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method}: timeout`)), TIMEOUT_MS);
      let sent: Promise<unknown>;
      try {
        sent = bridge.send(method, params);
      } catch (e) {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      sent.then(
        (r) => {
          clearTimeout(timer);
          resolve(r);
        },
        (e: unknown) => {
          clearTimeout(timer);
          reject(e instanceof Error ? e : new Error(String(e)));
        },
      );
    });
  let bridgeOk = false;
  const initDone = call('VKWebAppInit').then(
    () => (bridgeOk = true),
    () => (bridgeOk = false),
  );
  const outcome = (r: unknown): ShareResult => (r ? 'shared' : 'cancelled');

  return {
    name: 'vk',
    async init() {
      await initDone;
    },
    async load() {
      await initDone;
      const local = localGet(SAVE_KEY);
      if (!bridgeOk) return local;
      try {
        const r = (await call('VKWebAppStorageGet', { keys: [VK_KEY] })) as { keys?: Array<{ key: string; value: string }> };
        const cloud = r.keys?.find((k) => k.key === VK_KEY)?.value || null;
        return newest(local, cloud);
      } catch {
        return local;
      }
    },
    save(data) {
      localSet(SAVE_KEY, data);
      if (!bridgeOk || data.length > VK_VALUE_MAX) return;
      call('VKWebAppStorageSet', { key: VK_KEY, value: data }).catch(() => {
        /* без сети: останется локальная копия, следующая запись догонит */
      });
    },
    async shareLink(_text, url) {
      if (!bridgeOk) return 'unavailable';
      try {
        return outcome(await call('VKWebAppShare', { link: appLink || url }));
      } catch {
        return 'cancelled';
      }
    },
    async shareStory(dataUrl) {
      if (!bridgeOk) return 'unavailable';
      try {
        return outcome(await call('VKWebAppShowStoryBox', { background_type: 'image', blob: dataUrl, locked: true }));
      } catch {
        return 'cancelled';
      }
    },
  };
}
