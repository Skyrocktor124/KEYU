#!/usr/bin/env python3
"""「她，自有力量」配乐（25s，纯代码合成，D 大调）。

段落对齐镜头：
  0–6.5   黎明前：弦乐长音 Dmaj9 + 稀疏钢琴单音 + 风声
  6.5–12.5 起风：钢琴分解和弦 Bm7 – Gmaj7 – D/F# – Asus4→A，旋律下行
  12.5–18 日出：弦乐渐强，G – A – Bm – G，旋律上行到 B5；14.2 张开双臂处一记低音膨胀
  18.5–25 片名：D – Gmaj7 – A – D，19.3 片名浮现一声钟片，结尾钢琴上行琶音余音淡出

运行：uv run --with numpy --with scipy python score.py 输出.wav
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
DUR = 25.0
N = int(SR * DUR)
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(11)


def f(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(t0, sig, pan=0.0, gain=1.0):
    s = int(t0 * SR)
    e = min(N, s + len(sig))
    if e <= s:
        return
    seg = sig[: e - s] * gain
    L[s:e] += seg * np.sqrt(0.5 * (1 - pan))
    R[s:e] += seg * np.sqrt(0.5 * (1 + pan))


def piano(m, dur=3.0, vel=0.6):
    """毛毡钢琴：带非谐性的分音、每个分音不同衰减、两根弦微失谐、琴槌噪声。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f0 = f(m)
    B = 0.00025
    out = np.zeros(n)
    tau0 = 2.8 * (262 / f0) ** 0.35
    for k in range(1, 11):
        fk = k * f0 * np.sqrt(1 + B * k * k)
        if fk > 9000:
            break
        amp = (1 / k ** 1.15) * np.exp(-(k - 1) * (0.55 - 0.25 * vel))
        tau = tau0 / (1 + 0.55 * (k - 1))
        env = 0.65 * np.exp(-t / (tau * 0.18)) + 0.35 * np.exp(-t / tau)
        for det in (-0.35, 0.35):
            out += amp * env * np.sin(2 * np.pi * fk * (1 + det / 1731) * t + k * 0.7)
    a = int(0.004 * SR)
    out[:a] *= np.linspace(0, 1, a)
    rel = int(0.25 * SR)
    out[-rel:] *= np.linspace(1, 0, rel)
    ham = rng.standard_normal(int(0.03 * SR)) * np.exp(-np.arange(int(0.03 * SR)) / SR * 140)
    ham = sosfilt(butter(2, 1800, 'low', fs=SR, output='sos'), ham)
    out[: len(ham)] += ham * 0.08
    return out * vel * 0.16


def strings(notes, dur, att=1.6, rel=1.8, gain=0.05):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        for v, det in enumerate((-6, 0, 6)):
            fr = f(m) * (1 + det / 1731)
            vib = 1 + 0.0016 * np.sin(2 * np.pi * (5.1 + 0.3 * v) * t + v)
            ph = 2 * np.pi * np.cumsum(fr * vib) / SR
            for k in range(1, 14):
                if fr * k > 7000:
                    break
                out += np.sin(k * ph + v * 1.3 + k) / k ** 1.5
    env = np.minimum(1, t / att) * np.minimum(1, np.maximum(0, dur - t) / rel)
    out = sosfilt(butter(2, 2600, 'low', fs=SR, output='sos'), out * env)
    return out * gain / max(1, len(notes))


def bell(m, dur=5.0, gain=0.12):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for r, a, d in ((1, 1, 2.6), (2.0, 0.5, 1.6), (2.76, 0.35, 1.1), (5.4, 0.18, 0.5), (8.93, 0.08, 0.3)):
        out += a * np.exp(-t / d) * np.sin(2 * np.pi * f(m) * r * t)
    out[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return out * gain


def swell(t0, dur, m=38, gain=0.18):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    sig = (np.sin(2 * np.pi * f(m) * t) + 0.5 * np.sin(2 * np.pi * f(m + 12) * t)) * env
    add(t0, sig, 0, gain)


# ---------- 0–6.5 黎明前 ----------
add(0.2, strings([38, 50, 57, 64, 66], 7.2, att=2.5, rel=2.0, gain=0.06), 0)
add(1.4, piano(38, 5, 0.45), -0.2)
for t0, m in ((1.5, 69), (2.6, 78), (3.8, 76), (5.0, 74)):
    add(t0, piano(m, 3.5, 0.5), 0.15)

# ---------- 6.5–12.5 起风 ----------
E8 = 0.25
chB = [(6.5, 35, [59, 62, 66, 69]), (8.0, 31, [55, 59, 62, 66]), (9.5, 30, [57, 62, 66, 69]), (11.0, 33, [57, 62, 64, 69]), (11.75, 33, [57, 61, 64, 69])]
for t0, root, ch in chB:
    add(t0, piano(root + 12, 2.6, 0.55), -0.25)
    add(t0, piano(root + 24, 2.2, 0.35), -0.15)
    seq = [ch[0], ch[1], ch[2], ch[3], ch[2], ch[1]] if t0 < 11 else [ch[1], ch[3], ch[2]]
    for k, m in enumerate(seq):
        add(t0 + k * E8, piano(m, 1.8, 0.3), 0.2 if k % 2 else -0.05)
for t0, m in ((6.5, 78), (7.25, 76), (8.0, 74), (8.75, 71), (9.5, 69), (10.25, 74), (11.0, 76), (11.75, 73)):
    add(t0 + 0.02, piano(m, 2.6, 0.62), 0.05)
add(6.5, strings([47, 54, 62], 6.4, att=2.0, rel=1.5, gain=0.035), 0)

# ---------- 12.5–18 日出 ----------
chC = [(12.5, 31, [55, 59, 62, 67]), (14.0, 33, [57, 61, 64, 69]), (15.5, 35, [59, 62, 66, 71]), (17.0, 31, [55, 59, 62, 67])]
for i, (t0, root, ch) in enumerate(chC):
    add(t0, piano(root, 3.0, 0.6), -0.25)
    add(t0, piano(root + 12, 3.0, 0.5), -0.2)
    seq = [ch[0], ch[1], ch[2], ch[3], ch[2] + 12, ch[3], ch[2], ch[1]][:6]
    for k, m in enumerate(seq):
        add(t0 + k * E8, piano(m, 2.0, 0.34 + 0.04 * i), 0.22 if k % 2 else -0.08)
    add(t0, strings([root + 12, ch[1], ch[2], ch[3]], 1.9, att=0.9 if i else 1.4, rel=0.7, gain=0.05 + 0.025 * i), 0)
for t0, m in ((12.5, 74), (13.25, 76), (14.0, 78), (14.75, 81), (15.5, 83), (16.5, 81), (17.0, 79), (17.75, 78)):
    add(t0 + 0.02, piano(m, 2.8, 0.72), 0.05)
    add(t0 + 0.02, strings([m - 12], 1.1, att=0.3, rel=0.6, gain=0.022), 0.1)
swell(13.4, 2.4, 26, 0.16)

# ---------- 18.5–25 片名 ----------
chD = [(18.5, 38, [62, 66, 69, 74]), (20.0, 31, [55, 59, 62, 66]), (21.5, 33, [57, 61, 64, 69]), (22.5, 38, [62, 66, 69, 74])]
for i, (t0, root, ch) in enumerate(chD):
    last = i == 3
    add(t0, piano(root, 4.5 if last else 2.6, 0.55), -0.25)
    add(t0, piano(root + 12, 4.5 if last else 2.6, 0.45), -0.2)
    seq = ch + [ch[1] + 12, ch[3] + 12] if last else [ch[0], ch[1], ch[2], ch[3], ch[2], ch[1]]
    for k, m in enumerate(seq):
        add(t0 + k * (0.2 if last else E8), piano(m, 3.2 if last else 1.8, 0.32), 0.22 if k % 2 else -0.08)
    add(t0, strings([root + 12, ch[0], ch[1], ch[2]], 2.6 if last else 1.6, att=0.8, rel=1.2 if last else 0.6, gain=0.06 if not last else 0.05), 0)
for t0, m in ((18.5, 78), (19.25, 76), (20.0, 74), (20.75, 71), (21.5, 73), (22.5, 74)):
    add(t0 + 0.02, piano(m, 3.0, 0.6), 0.05)
add(19.3, bell(86, 5.0, 0.07), 0.3)
add(19.3, bell(93, 4.0, 0.035), -0.3)

# ---------- 风声 ----------
noise = rng.standard_normal((2, N))
wind = np.stack([sosfilt(butter(2, [160, 900], 'band', fs=SR, output='sos'), noise[i]) for i in range(2)])
tt = np.arange(N) / SR
gust = 0.5 + 0.25 * np.sin(tt * 1.1) + 0.15 * np.sin(tt * 2.9 + 1) + 0.6 * np.clip((tt - 13.6) / 1.6, 0, 1) * np.clip((22 - tt) / 2.5, 0, 1)
wenv = gust * np.clip(tt / 2.0, 0, 1)
L += wind[0] * wenv * 0.022
R += wind[1] * wenv * 0.022

# ---------- 混响（合成脉冲响应） ----------
irn = int(3.2 * SR)
it = np.arange(irn) / SR
ir = rng.standard_normal((2, irn)) * np.exp(-it / 0.85)
ir = np.stack([sosfilt(butter(1, 5200, 'low', fs=SR, output='sos'), ir[i]) for i in range(2)])
ir /= np.max(np.abs(ir))
wetL = fftconvolve(L, ir[0])[:N] * 0.014
wetR = fftconvolve(R, ir[1])[:N] * 0.014
L = L * 0.8 + wetL
R = R * 0.8 + wetR

# ---------- 母带 ----------
fade_in = np.clip(tt / 0.6, 0, 1)
fade_out = np.clip((DUR - tt) / 1.3, 0, 1) ** 1.4
for ch in (L, R):
    ch *= fade_in * fade_out
pk = max(np.abs(L).max(), np.abs(R).max())
L = np.tanh(L / pk * 1.15) / np.tanh(1.15) * 0.89
R = np.tanh(R / pk * 1.15) / np.tanh(1.15) * 0.89

out = sys.argv[1] if len(sys.argv) > 1 else 'score.wav'
import wave
with wave.open(out, 'w') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.stack([L, R], 1) * 32767).astype(np.int16).tobytes())
print('wrote', out)
