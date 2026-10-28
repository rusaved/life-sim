// Что: лист «Поделиться» — превью карточки (пост или история), «Поделиться» (системное меню с картинкой, где можно; в VK — его окно),
// «Сохранить картинку», «Скопировать текст и ссылку», в VK — «В историю». Текст поста от первого лица пишется сам.
// Кто зовёт: итог жизни (открывается сам), свидетельство о рождении.
// Держать: ссылка несёт зерно рождения ?s=<seed>; ни одного внешнего запроса — картинка рисуется здесь же.

import { app, seedUrl } from '../app.ts';
import { content } from '../core/data.ts';
import { countryName, eraName, placeName } from '../core/birth.ts';
import { hashSeed } from '../core/rng.ts';
import { birthPost, deathPost, lifeCount, traitList, type LifeSummary } from '../core/soul.ts';
import { ageText, capitalize, fill, gender } from '../core/text.ts';
import { cardBlob, drawCard, type CardData, type CardFormat } from './card.ts';
import { button, h, toast } from './dom.ts';
import { sfx } from './sound.ts';

let lastSummary: LifeSummary | null = null;
export function setSummary(s: LifeSummary): void {
  lastSummary = s;
}

function siteHost(): string {
  return content.brand.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function cardData(kind: 'birth' | 'death'): CardData {
  const ui = content.life.ui;
  const life = app.life!;
  const soul = app.save.soul;
  const footer = `${content.brand.title} · ${ui.cardFooter}`;
  if (kind === 'death' && lastSummary) {
    const s = lastSummary;
    const others = traitList(soul)
      .map((t) => t.trait.name)
      .filter((n) => n !== s.trait.name)
      .slice(0, 1);
    return {
      top: fill(ui.cardSoul, { n: soul.no, k: s.lifeNo }),
      kicker: fill(ui.lifeYears, { from: s.from, to: s.to }),
      title: s.place,
      subtitle: s.era,
      big: ageText(s.age),
      line: s.cause,
      quote: s.quote,
      traits: `${ui.cardTraits}: ${[s.trait.name, ...others].join(' · ')}`,
      footer,
      site: siteHost(),
    };
  }
  const b = life.birth;
  const traits = traitList(soul).slice(0, 2).map((t) => t.trait.name);
  return {
    top: fill(ui.cardSoul, { n: soul.no, k: lifeCount(soul) + 1 }),
    kicker: ui.birthCard,
    title: gender(ui.bornLine, b.sex),
    subtitle: `${countryName(b)}, ${content.life.placeIn[b.place]}`,
    big: b.era === null ? `${capitalize(eraName(b))}, ${b.year}` : String(b.year),
    line: `${capitalize(content.life.wealth[b.wealth])}. ${fill(ui.cardBirthLine, { n: Math.round(b.lifeExp) })}`,
    quote: '',
    traits: traits.length ? `${ui.cardTraits}: ${traits.join(' · ')}` : '',
    footer,
    site: siteHost(),
  };
}

export function postText(kind: 'birth' | 'death'): string {
  const life = app.life!;
  const variant = hashSeed(life.birth.seed + kind);
  return kind === 'death' && lastSummary ? deathPost(life, lastSummary, variant) : birthPost(life, variant);
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = h('textarea', { style: 'position:fixed;opacity:0' }) as HTMLTextAreaElement;
    area.value = text;
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export function openShare(kind: 'birth' | 'death'): void {
  if (!app.life || document.querySelector('.sheet-back')) return;
  const ui = content.life.ui;
  const buttons = content.soul.ui.buttons;
  const platform = app.platform;
  const seed = app.life.birth.seed;
  const url = seedUrl(seed);
  const text = postText(kind);
  const data = cardData(kind);
  let format: CardFormat = 'post';
  const canvas = h('canvas', { 'data-card': kind, role: 'img', 'aria-label': `${data.title}. ${data.big}` }) as HTMLCanvasElement;
  const render = (): void => {
    drawCard(canvas, data, format);
    canvas.dataset.format = format;
    canvas.dataset.size = `${canvas.width}x${canvas.height}`;
    for (const b of seg.querySelectorAll('button')) b.classList.toggle('on', (b as HTMLElement).dataset.format === format);
  };
  const seg = h(
    'div',
    { class: 'seg', role: 'group' },
    ...(['post', 'story'] as CardFormat[]).map((f) =>
      h('button', { type: 'button', class: 'chip', dataset: { format: f }, text: f === 'post' ? ui.formatPost : ui.formatStory, onclick: () => ((format = f), render()) }),
    ),
  );
  const file = async (): Promise<File | null> => {
    const blob = await cardBlob(canvas);
    return blob ? new File([blob], `life-${seed}-${format}.png`, { type: 'image/png' }) : null;
  };
  const share = async (): Promise<void> => {
    sfx.tap();
    if (platform.shareLink) {
      const r = await platform.shareLink(text, url);
      if (r !== 'unavailable') return;
    }
    try {
      const f = await file();
      if (f && navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], text: `${text} ${url}` });
        return;
      }
      if (navigator.share) {
        await navigator.share({ text, url });
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    toast((await copy(`${text} ${url}`)) ? ui.copied : ui.shareFail);
  };
  const save = async (): Promise<void> => {
    sfx.tap();
    const f = await file();
    if (!f) return toast(ui.shareFail);
    const href = URL.createObjectURL(f);
    const a = h('a', { href, download: f.name, style: 'display:none' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
    toast(ui.saved);
  };
  const story = async (): Promise<void> => {
    sfx.tap();
    format = 'story';
    render();
    const r = await platform.shareStory!(canvas.toDataURL('image/png'));
    if (r === 'unavailable') toast(ui.shareFail);
  };
  const close = (): void => back.remove();
  const sheet = h(
    'div',
    { class: 'sheet', role: 'dialog', 'aria-label': ui.shareTitle, dataset: { sheet: kind } },
    h('div', { class: 'row' }, h('h3', { class: 'grow', text: ui.shareTitle }), button(ui.close, 'ghost', close, { 'data-action': 'close-share' })),
    h('p', { class: 'muted small', text: ui.shareHint }),
    h('div', { class: 'preview' }, canvas),
    seg,
    button(buttons.share!, 'primary wide', () => void share(), { 'data-action': 'share' }),
    platform.shareStory ? button(ui.story, 'wide', () => void story(), { 'data-action': 'story' }) : null,
    h(
      'div',
      { class: 'row' },
      button(buttons.saveImage!, 'grow', () => void save(), { 'data-action': 'save-image' }),
      button(buttons.copyTextAndLink!, 'grow', () => void copy(`${text} ${url}`).then((ok) => toast(ok ? ui.copied : ui.shareFail)), { 'data-action': 'copy' }),
    ),
  );
  const back = h('div', { class: 'sheet-back', onclick: (e: Event) => e.target === back && close() }, sheet);
  document.body.append(back);
  render();
}

export { placeName };
