// Что: тихий звук интерфейса — короткие мягкие тоны WebAudio без файлов: касание, решение, рождение, конец жизни.
// Кто зовёт: экраны src/ui; выключатель в верхней строке.
// Держать: AudioContext создаётся только после касания игрока; громкость низкая; выключенный звук и скрытая вкладка — тишина.

let ctx: AudioContext | null = null;
let enabled = true;

export function setSound(on: boolean): void {
  enabled = on;
  if (!on && ctx) void ctx.suspend();
  if (on && ctx) void ctx.resume();
}

export function soundOn(): boolean {
  return enabled;
}

/** Скрытая вкладка — тишина: звуки не играют, контекст спит до возвращения. */
let hidden = false;
export function setHidden(on: boolean): void {
  hidden = on;
  const c = ctx;
  if (!c) return;
  // Состояние звука видно e2e: data-audio у <html>.
  const mark = (): void => void (document.documentElement.dataset.audio = c.state);
  if (on) void c.suspend().then(mark, mark);
  else if (enabled) void c.resume().then(mark, mark);
}

function audio(): AudioContext | null {
  if (!enabled || hidden) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, gain = 0.035, type: OscillatorType = 'sine'): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  tap: (): void => tone(660, 0, 0.08, 0.02),
  decision: (): void => {
    tone(392, 0, 0.25, 0.025);
    tone(523, 0.08, 0.3, 0.02);
  },
  birth: (): void => {
    tone(523, 0, 0.4, 0.025);
    tone(659, 0.12, 0.45, 0.022);
    tone(784, 0.24, 0.6, 0.02);
  },
  family: (): void => {
    tone(587, 0, 0.3, 0.02);
    tone(740, 0.1, 0.4, 0.018);
  },
  end: (): void => {
    tone(330, 0, 1.4, 0.03);
    tone(247, 0.2, 1.6, 0.025);
    tone(196, 0.4, 2, 0.02);
  },
};
