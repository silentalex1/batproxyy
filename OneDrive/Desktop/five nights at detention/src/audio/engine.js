function noiseBuffer(ctx, seconds) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

const JINGLE = [
  [659, 0], [784, 0.36], [880, 0.72], [784, 1.08],
  [659, 1.44], [587, 1.8], [659, 2.16], [523, 2.52],
  [587, 2.88], [659, 3.24], [523, 3.6], [440, 3.96]
];

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.humNodes = null;
    this.buzzNodes = null;
    this.breathNodes = null;
    this.jingleTimer = null;
    this.volume = 0.72;
    this.ahoogaSrc = "";
    this.jobSrc = "";
    this.jobEl = null;
  }

  setAhoogaSrc(src) {
    this.ahoogaSrc = src;
  }

  setJobSrc(src) {
    this.jobSrc = src;
  }

  job() {
    try {
      if (!this.jobEl) {
        const el = document.createElement("video");
        el.src = this.jobSrc;
        el.playsInline = true;
        el.preload = "auto";
        el.style.position = "fixed";
        el.style.width = "1px";
        el.style.height = "1px";
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
        el.style.left = "-10px";
        document.body.appendChild(el);
        this.jobEl = el;
      }
      this.jobEl.volume = Math.max(0, Math.min(1, this.volume));
      this.jobEl.currentTime = 0;
      const played = this.jobEl.play();
      if (played && typeof played.catch === "function") played.catch(() => {});
    } catch {}
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
  }

  tone(freq, dur, type, gain, delay = 0) {
    const ctx = this.ensure();
    const at = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  slide(from, to, dur, type, gain, delay = 0) {
    const ctx = this.ensure();
    const at = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  burst(seconds, gain, rate, delay = 0, q = 1) {
    const ctx = this.ensure();
    const at = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, seconds);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = rate;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(at);
  }

  startHum() {
    const ctx = this.ensure();
    if (this.humNodes) return;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const air = ctx.createBufferSource();
    const airFilter = ctx.createBiquadFilter();
    const airGain = ctx.createGain();
    const g = ctx.createGain();
    osc.type = "sine";
    osc2.type = "triangle";
    osc.frequency.value = 48;
    osc2.frequency.value = 97;
    g.gain.value = 0.03;
    air.buffer = noiseBuffer(ctx, 4);
    air.loop = true;
    airFilter.type = "lowpass";
    airFilter.frequency.value = 320;
    airGain.gain.value = 0.035;
    osc.connect(g);
    osc2.connect(g);
    g.connect(this.master);
    air.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(this.master);
    osc.start();
    osc2.start();
    air.start();
    this.humNodes = { osc, osc2, air, g, airGain };
  }

  stopHum() {
    if (!this.humNodes) return;
    try {
      this.humNodes.osc.stop();
      this.humNodes.osc2.stop();
      this.humNodes.air.stop();
    } catch {}
    this.humNodes = null;
  }

  startBuzz() {
    const ctx = this.ensure();
    if (this.buzzNodes) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const hiss = ctx.createBufferSource();
    const hissFilter = ctx.createBiquadFilter();
    const hissGain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 118;
    g.gain.value = 0.018;
    hiss.buffer = noiseBuffer(ctx, 3);
    hiss.loop = true;
    hissFilter.type = "bandpass";
    hissFilter.frequency.value = 4200;
    hissGain.gain.value = 0.02;
    osc.connect(g);
    g.connect(this.master);
    hiss.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(this.master);
    osc.start();
    hiss.start();
    this.buzzNodes = { osc, hiss };
  }

  stopBuzz() {
    if (!this.buzzNodes) return;
    try {
      this.buzzNodes.osc.stop();
      this.buzzNodes.hiss.stop();
    } catch {}
    this.buzzNodes = null;
  }

  startBreath() {
    const ctx = this.ensure();
    if (this.breathNodes) return;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    src.buffer = noiseBuffer(ctx, 4);
    src.loop = true;
    filter.type = "bandpass";
    filter.frequency.value = 620;
    filter.Q.value = 0.9;
    g.gain.value = 0.0;
    lfo.type = "sine";
    lfo.frequency.value = 0.34;
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
    lfo.start();
    this.breathNodes = { src, lfo };
  }

  stopBreath() {
    if (!this.breathNodes) return;
    try {
      this.breathNodes.src.stop();
      this.breathNodes.lfo.stop();
    } catch {}
    this.breathNodes = null;
  }

  jingleOnce() {
    JINGLE.forEach(([f, t]) => {
      this.tone(f, 0.3, "triangle", 0.055, t);
      this.tone(f * 2, 0.16, "sine", 0.02, t);
    });
  }

  jingle() {
    if (this.jingleTimer) return;
    this.ensure();
    this.jingleOnce();
    this.jingleTimer = window.setInterval(() => this.jingleOnce(), 4400);
  }

  stopJingle() {
    if (!this.jingleTimer) return;
    window.clearInterval(this.jingleTimer);
    this.jingleTimer = null;
  }

  door() {
    this.slide(140, 44, 0.3, "square", 0.09);
    this.burst(0.3, 0.14, 320);
    this.tone(58, 0.16, "square", 0.09, 0.26);
  }

  camera() {
    this.burst(0.24, 0.17, 1800);
    this.tone(240, 0.08, "square", 0.04);
  }

  glitch() {
    this.burst(0.9, 0.3, 900);
    this.slide(220, 48, 0.6, "sawtooth", 0.08);
  }

  scare() {
    this.stopJingle();
    this.burst(1.6, 0.5, 700, 0, 0.6);
    this.slide(900, 42, 1.3, "sawtooth", 0.22);
    this.tone(58, 1.4, "square", 0.16);
    this.tone(1400, 0.3, "sawtooth", 0.1, 0.02);
    this.tone(96, 0.9, "sawtooth", 0.12, 0.3);
  }

  click() {
    this.tone(620, 0.05, "square", 0.03);
  }

  chime() {
    this.tone(392, 0.9, "sine", 0.035);
    this.tone(523, 1.1, "sine", 0.028, 0.1);
  }

  win() {
    this.stopJingle();
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.7, "sine", 0.07, i * 0.16));
    this.burst(1.2, 0.06, 2600, 0.6);
  }

  powerDown() {
    this.stopBuzz();
    this.stopBreath();
    this.slide(220, 34, 1.4, "sawtooth", 0.1);
    this.tone(44, 1.8, "sine", 0.11);
    this.burst(1.1, 0.14, 140);
    this.stopHum();
  }

  knock() {
    this.tone(72, 0.13, "square", 0.1);
    this.burst(0.16, 0.18, 240);
    this.tone(62, 0.14, "square", 0.09, 0.17);
    this.tone(58, 0.14, "square", 0.07, 0.33);
  }

  bang() {
    this.tone(52, 0.5, "square", 0.2);
    this.burst(0.5, 0.34, 180, 0, 0.6);
    this.tone(150, 0.2, "sawtooth", 0.09, 0.03);
    this.tone(46, 0.4, "square", 0.13, 0.22);
  }

  dash() {
    for (let i = 0; i < 9; i += 1) {
      this.burst(0.1, 0.14, 260 + i * 40, i * 0.13, 2.2);
      this.tone(70 + i * 4, 0.07, "square", 0.05, i * 0.13);
    }
  }

  step() {
    const d = Math.random() * 0.05;
    this.burst(0.11, 0.075, 200 + Math.random() * 120, d, 2.4);
    this.burst(0.11, 0.06, 240 + Math.random() * 120, d + 0.28, 2.4);
  }

  ahooga() {
    try {
      const el = new Audio(this.ahoogaSrc);
      el.volume = Math.max(0, Math.min(1, this.volume));
      const played = el.play();
      if (played && typeof played.catch === "function") played.catch(() => {});
    } catch {}
  }

  clang() {
    const f = 180 + Math.random() * 260;
    this.tone(f, 0.5, "triangle", 0.045);
    this.tone(f * 1.48, 0.4, "sine", 0.03, 0.02);
    this.burst(0.3, 0.05, 2200, 0.01);
  }
}

export const audio = new AudioEngine();
