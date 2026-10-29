// Что: договор площадки — всё, что игра знает о сайте, ВКонтакте и будущих площадках.
// Кто зовёт: src/main.ts, src/ui/*; реализуют null.ts и vk.ts.
// Держать: типы мостов площадок наружу src/platform не выходят.

export type PlatformName = 'null' | 'vk';

export type ShareResult = 'shared' | 'cancelled' | 'unavailable';

export interface Platform {
  readonly name: PlatformName;
  init(): Promise<void>;
  /** Сохранение целиком текстом; null — сохранения нет. */
  load(): Promise<string | null>;
  save(data: string): void;
  /** Своя кнопка «Поделиться» площадки (ссылка и текст); нет — системное меню браузера. */
  shareLink?(text: string, url: string): Promise<ShareResult>;
  /** Весь экран (только из касания игрока); false — площадка не даёт или браузер отказал. */
  requestFullscreen(): Promise<boolean>;
  /** История площадки с картинкой 1080×1920 (data:image/png). */
  shareStory?(dataUrl: string): Promise<ShareResult>;
}
