/**
 * 即时反馈特效：WebAudio 音效（无外部资源）+ Canvas 彩带 + 飘字。
 * 所有特效尊重 prefers-reduced-motion 与静音开关。
 */

let ctx: AudioContext | null = null;
let muted = false;

export function setSoundMuted(m: boolean) {
  muted = m;
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function tone(freq: number, dur = 0.1, type: OscillatorType = 'sine', vol = 0.12, delay = 0) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch {
    // 音频不可用时静默
  }
}

export const sfx = {
  correct() {
    tone(659, 0.09);
    tone(988, 0.12, 'sine', 0.1, 0.07);
  },
  wrong() {
    tone(180, 0.18, 'sawtooth', 0.07);
  },
  combo(n: number) {
    tone(520 + Math.min(n, 12) * 45, 0.08, 'triangle', 0.11);
  },
  flip() {
    tone(420, 0.05, 'triangle', 0.06);
  },
  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'sine', 0.12, i * 0.09));
  },
  quest() {
    tone(740, 0.09);
    tone(880, 0.12, 'sine', 0.1, 0.08);
  },
  tick() {
    tone(1200, 0.03, 'square', 0.04);
  },
};

/** 全屏彩带（升级 / 满分时刻） */
export function confetti(count = 140) {
  if (reducedMotion()) return;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:100';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const c = canvas.getContext('2d')!;
  const colors = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#eab308'];
  const parts = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.4,
    vx: (Math.random() - 0.5) * 3,
    vy: 2.5 + Math.random() * 3.5,
    size: 5 + Math.random() * 6,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.25,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const frame = (t: number) => {
    const elapsed = t - start;
    c.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.globalAlpha = Math.max(0, 1 - elapsed / 1800);
      c.fillStyle = p.color;
      c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      c.restore();
    }
    if (elapsed < 1800) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/** 飘字（+XP 等） */
export function floatText(text: string) {
  if (reducedMotion()) return;
  const el = document.createElement('div');
  el.className = 'fx-float';
  el.textContent = text;
  el.style.marginLeft = `${Math.round((Math.random() - 0.5) * 80)}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
