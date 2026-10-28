// Что: карточки жизни рисуются в браузере на canvas — рождение и смерть, пост 1080×1350 и история 1080×1920.
// Кто зовёт: src/ui/share.ts (превью, «Поделиться», «Сохранить картинку»), e2e (карточки рисуются).
// Держать: крупный текст, без мелких цифр; только системные шрифты (никаких внешних загрузок); тексты приходят готовыми.

export type CardFormat = 'post' | 'story';
export const CARD_SIZE: Record<CardFormat, { w: number; h: number }> = { post: { w: 1080, h: 1350 }, story: { w: 1080, h: 1920 } };

export interface CardData {
  top: string;
  kicker: string;
  title: string;
  subtitle: string;
  big: string;
  line: string;
  quote: string;
  traits: string;
  footer: string;
  site: string;
}

const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const INK = '#efe7da';
const MUTED = '#a99d8c';
const GOLD = '#d2b07a';

interface Block {
  text: string;
  font: string;
  size: number;
  color: string;
  gap: number;
  lineHeight?: number;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawCard(canvas: HTMLCanvasElement, data: CardData, format: CardFormat): void {
  const { w, h } = CARD_SIZE[format];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#221c15');
  bg.addColorStop(0.55, '#17130e');
  bg.addColorStop(1, '#0f0c09');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, h * 0.36, 0, w / 2, h * 0.36, w * 0.75);
  glow.addColorStop(0, 'rgba(210,176,122,0.10)');
  glow.addColorStop(1, 'rgba(210,176,122,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  const inset = 56;
  ctx.strokeStyle = 'rgba(210,176,122,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);

  const story = format === 'story';
  const k = story ? 1.2 : 1;
  const spread = story ? 1.7 : 1;
  const maxWidth = w - 220;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Верх и низ — на своих местах; середина — по центру между ними.
  ctx.fillStyle = MUTED;
  ctx.font = `500 ${Math.round(38 * k)}px ${SANS}`;
  ctx.fillText(data.top, w / 2, inset + 110 * k);

  const blocks: Block[] = [
    { text: data.kicker, font: SANS, size: 40, color: GOLD, gap: 0 },
    { text: data.title, font: SERIF, size: 92, color: INK, gap: 34, lineHeight: 1.12 },
    { text: data.subtitle, font: SERIF, size: 54, color: MUTED, gap: 22 },
    { text: data.big, font: SERIF, size: 70, color: INK, gap: 46 },
    { text: data.line, font: SANS, size: 40, color: INK, gap: 50, lineHeight: 1.3 },
    { text: data.quote ? `«${data.quote}»` : '', font: SERIF, size: 56, color: GOLD, gap: 54, lineHeight: 1.22 },
    { text: data.traits, font: SANS, size: 38, color: MUTED, gap: 54, lineHeight: 1.3 },
  ].filter((b) => b.text);

  const laid = blocks.map((b) => {
    const size = Math.round(b.size * k);
    const italic = b.color === GOLD && b.font === SERIF ? 'italic ' : '';
    ctx.font = `${italic}${b.font === SERIF ? 500 : 500} ${size}px ${b.font}`;
    const lines = wrap(ctx, b.text, maxWidth).slice(0, 4);
    const lh = size * (b.lineHeight ?? 1.18);
    return { b, size, italic, lines, lh, height: lines.length * lh, gap: b.gap * k * spread };
  });
  const total = laid.reduce((sum, x) => sum + x.height + x.gap, 0);
  const areaTop = inset + 170 * k;
  const areaBottom = h - inset - 190 * k;
  let y = areaTop + Math.max(0, (areaBottom - areaTop - total) / 2);
  for (const x of laid) {
    y += x.gap;
    ctx.fillStyle = x.b.color;
    ctx.font = `${x.italic}500 ${x.size}px ${x.b.font}`;
    for (const line of x.lines) {
      y += x.lh;
      ctx.fillText(line, w / 2, y - x.lh * 0.22);
    }
    if (x.b.font === SERIF && x.b.size === 70) {
      // Тонкая черта с точкой под годами жизни.
      ctx.strokeStyle = 'rgba(210,176,122,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 120, y + 26 * k);
      ctx.lineTo(w / 2 - 14, y + 26 * k);
      ctx.moveTo(w / 2 + 14, y + 26 * k);
      ctx.lineTo(w / 2 + 120, y + 26 * k);
      ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(w / 2, y + 26 * k, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = INK;
  ctx.font = `500 ${Math.round(46 * k)}px ${SERIF}`;
  ctx.fillText(data.footer, w / 2, h - inset - 100 * k);
  ctx.fillStyle = MUTED;
  ctx.font = `400 ${Math.round(34 * k)}px ${SANS}`;
  ctx.fillText(data.site, w / 2, h - inset - 48 * k);
}

export function cardBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
