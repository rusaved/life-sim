import { describe, expect, it, vi } from 'vitest';
import { createVkPlatform, launchedByPlatform } from '../src/platform/vk.ts';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

function fakeBridge(cloud: Record<string, string>, failInit = false) {
  const calls: string[] = [];
  return {
    calls,
    send: async (method: string, params?: Record<string, unknown>) => {
      calls.push(method);
      if (method === 'VKWebAppInit') {
        if (failInit) throw new Error('no bridge');
        return { result: true };
      }
      if (method === 'VKWebAppStorageGet') return { keys: (params!.keys as string[]).map((key) => ({ key, value: cloud[key] ?? '' })) };
      if (method === 'VKWebAppStorageSet') {
        cloud[String(params!.key)] = String(params!.value);
        return { result: true };
      }
      return { result: true };
    },
  };
}

describe('площадка vk', () => {
  it('VKWebAppInit первым, сохранение в VK Storage, берётся свежее', async () => {
    store.clear();
    const cloud: Record<string, string> = { save: JSON.stringify({ v: 1, t: 50 }) };
    store.set('life-sim:save', JSON.stringify({ v: 1, t: 10 }));
    const bridge = fakeBridge(cloud);
    const p = createVkPlatform(bridge, 'https://example.org/');
    expect(bridge.calls[0]).toBe('VKWebAppInit');
    await p.init();
    expect(JSON.parse((await p.load())!).t).toBe(50);
    p.save(JSON.stringify({ v: 1, t: 99 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse(cloud.save!).t).toBe(99);
    expect(JSON.parse(store.get('life-sim:save')!).t).toBe(99);
  });
  it('без моста — локальная копия', async () => {
    store.clear();
    store.set('life-sim:save', JSON.stringify({ v: 1, t: 7 }));
    const p = createVkPlatform(fakeBridge({}, true), '');
    await p.init();
    expect(JSON.parse((await p.load())!).t).toBe(7);
    expect(await p.shareLink!('t', 'u')).toBe('unavailable');
  });
  it('запуск из VK — по подписи', () => {
    expect(launchedByPlatform('?vk_app_id=1&sign=abc')).toBe(true);
    expect(launchedByPlatform('?mock=vk')).toBe(false);
  });
});
