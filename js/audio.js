/* ============================================================
   빛의 미로 — 사운드 (audio.js)  Web Audio 합성 (외부 파일 없음)
   ============================================================ */
(function (global) {
  'use strict';
  class Sound {
    constructor() { this.ctx = null; this.enabled = true; this.bgmOn = true; this.bgmNodes = null; this.master = null; }
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
    }
    tone(freq, dur = 0.15, type = 'sine', vol = 0.3, when = 0, slide = 0) {
      if (!this.enabled || !this.ctx) return;
      const t0 = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    click() { this.tone(880, 0.06, 'square', 0.08); }
    place() { this.tone(520, 0.08, 'triangle', 0.25); this.tone(780, 0.1, 'triangle', 0.2, 0.06); }
    rotate() { this.tone(660, 0.05, 'square', 0.07); }
    pickup() { this.tone(440, 0.07, 'triangle', 0.2, 0, 200); }
    bad() { this.tone(180, 0.25, 'sawtooth', 0.2, 0, -80); }
    lit() { [0, 4, 7, 12].forEach((s, i) => this.tone(523 * Math.pow(2, s / 12), 0.18, 'sine', 0.25, i * 0.06)); }
    win() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(392 * Math.pow(2, s / 12), 0.35, 'triangle', 0.3, i * 0.09)); this.tone(784, 0.8, 'sine', 0.2, 0.7); }
    bat() { this.tone(300, 0.12, 'sawtooth', 0.2); this.tone(240, 0.2, 'sawtooth', 0.18, 0.12); }
    // 아주 가벼운 배경음: 펜타토닉 아르페지오 + 패드
    startBgm() {
      if (!this.ctx || this.bgmNodes || !this.bgmOn) return;
      const ctx = this.ctx; const g = ctx.createGain(); g.gain.value = 0.11; g.connect(this.master);
      const notes = [0, 2, 4, 7, 9, 12, 9, 7, 4, 2]; const base = 261.63; let i = 0;
      const pad = ctx.createOscillator(); pad.type = 'sine'; pad.frequency.value = base / 2; const pg = ctx.createGain(); pg.gain.value = 0.35; pad.connect(pg); pg.connect(g); pad.start();
      const pad2 = ctx.createOscillator(); pad2.type = 'triangle'; pad2.frequency.value = base * 0.75; const pg2 = ctx.createGain(); pg2.gain.value = 0.12; pad2.connect(pg2); pg2.connect(g); pad2.start();
      const timer = setInterval(() => {
        if (!this.bgmOn || !this.enabled) return;
        const n = notes[i % notes.length]; i++;
        const f = base * Math.pow(2, n / 12) * (Math.floor(i / 20) % 2 ? 1.5 : 1);
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
        const t0 = ctx.currentTime; og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02); og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
        o.connect(og); og.connect(g); o.start(t0); o.stop(t0 + 0.6);
      }, 320);
      this.bgmNodes = { g, pad, pad2, timer };
    }
    stopBgm() { if (!this.bgmNodes) return; clearInterval(this.bgmNodes.timer); this.bgmNodes.pad.stop(); this.bgmNodes.pad2.stop(); this.bgmNodes.g.disconnect(); this.bgmNodes = null; }
    toggle() { this.enabled = !this.enabled; if (!this.enabled) this.stopBgm(); else { this.init(); this.startBgm(); } return this.enabled; }
  }
  global.LightSound = new Sound();
})(window);
