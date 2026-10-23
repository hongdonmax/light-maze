/* ============================================================
   빛의 미로 — 렌더러 (render.js)  Canvas 2D
   ============================================================ */
(function (global) {
  'use strict';
  const E = global.LightEngine;
  const { V, BOARD_W, BOARD_H, CELL } = E;
  const TAU = Math.PI * 2;

  function rr(ctx, x, y, w, h, r) { // rounded rect path
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.images = {}; this.t = 0; this.particles = [];
      this.studyMode = false;
    }
    loadImage(key, src) {
      return new Promise(res => { const im = new Image(); im.onload = () => { this.images[key] = im; res(im); }; im.onerror = () => res(null); im.src = src; });
    }
    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = Math.round(rect.width * dpr); this.canvas.height = Math.round(rect.height * dpr);
      this.scale = rect.width / BOARD_W; this.dpr = dpr;
    }
    toBoard(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: (clientX - rect.left) / this.scale, y: (clientY - rect.top) / this.scale };
    }

    // ---------- 메인 ----------
    draw(state, dt) {
      this.t += dt;
      const ctx = this.ctx; const { level, trace: tr, evalr } = state;
      ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
      ctx.clearRect(0, 0, BOARD_W, BOARD_H);
      this.drawBackground(level, state);
      if (level.dark) {
        this.drawDarkRoom(state);
      } else {
        this.drawGrid();
        this.drawBeams(tr, state);
      }
      for (const o of level.objects) this.drawObject(o, state);
      if (state.ghost) { ctx.globalAlpha = 0.55; this.drawObject(state.ghost, state); ctx.globalAlpha = 1; }
      this.drawEvents(tr, state);
      this.drawParticles(dt);
      if (state.selected) this.drawSelection(state.selected, state);
    }

    drawBackground(level, state) {
      const ctx = this.ctx;
      const img = this.images[level.bgKey];
      if (img) {
        const s = Math.max(BOARD_W / img.width, BOARD_H / img.height);
        const w = img.width * s, h = img.height * s;
        ctx.save(); try { ctx.filter = 'blur(3px) saturate(0.9)'; } catch (e) { }
        ctx.drawImage(img, (BOARD_W - w) / 2 - 4, (BOARD_H - h) / 2 - 4, w + 8, h + 8);
        ctx.restore();
        ctx.fillStyle = level.dark ? 'rgba(2,4,14,0.92)' : 'rgba(8,10,30,0.66)';
        ctx.fillRect(0, 0, BOARD_W, BOARD_H);
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, BOARD_H);
        g.addColorStop(0, '#141a3a'); g.addColorStop(1, '#0a0d22');
        ctx.fillStyle = g; ctx.fillRect(0, 0, BOARD_W, BOARD_H);
      }
      // 비네팅
      const vg = ctx.createRadialGradient(BOARD_W / 2, BOARD_H / 2, BOARD_H * 0.4, BOARD_W / 2, BOARD_H / 2, BOARD_W * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    }
    drawGrid() {
      const ctx = this.ctx; ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = CELL; x < BOARD_W; x += CELL) { ctx.moveTo(x, 0); ctx.lineTo(x, BOARD_H); }
      for (let y = CELL; y < BOARD_H; y += CELL) { ctx.moveTo(0, y); ctx.lineTo(BOARD_W, y); }
      ctx.stroke(); ctx.restore();
    }

    // ---------- 어둠상자 (1-1) ----------
    drawDarkRoom(state) {
      const ctx = this.ctx; const tr = state.trace;
      // 손전등 부채꼴 영역만 밝힘
      for (const ray of tr.rays) { if (!ray.weak) continue; }
      const fans = this.flashlightPolygons(tr);
      ctx.save();
      for (const f of fans) {
        ctx.beginPath(); ctx.moveTo(f.origin.x, f.origin.y);
        for (const p of f.pts) ctx.lineTo(p.x, p.y);
        ctx.closePath();
        const g = ctx.createRadialGradient(f.origin.x, f.origin.y, 10, f.origin.x, f.origin.y, 760);
        g.addColorStop(0, 'rgba(255,240,190,0.55)'); g.addColorStop(0.5, 'rgba(255,220,150,0.28)'); g.addColorStop(1, 'rgba(255,200,120,0.05)');
        ctx.fillStyle = g; ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,230,160,0.12)'; ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    }
    flashlightPolygons(tr) {
      // 같은 광원에서 나온 weak 광선을 모아 다각형 생성
      const groups = new Map();
      for (const ray of tr.rays) {
        if (!ray.weak) continue;
        const o = ray.pts[0]; const key = o.x + ',' + o.y;
        if (!groups.has(key)) groups.set(key, { origin: o, pts: [] });
        groups.get(key).pts.push(ray.pts[1]);
      }
      return [...groups.values()];
    }

    // ---------- 광선 ----------
    drawBeams(tr, state) {
      const ctx = this.ctx;
      // 손전등 부채꼴
      const fans = this.flashlightPolygons(tr);
      for (const f of fans) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.moveTo(f.origin.x, f.origin.y);
        for (const p of f.pts) ctx.lineTo(p.x, p.y);
        ctx.closePath();
        const g = ctx.createRadialGradient(f.origin.x, f.origin.y, 5, f.origin.x, f.origin.y, 900);
        g.addColorStop(0, 'rgba(255,235,170,0.55)'); g.addColorStop(1, 'rgba(255,210,120,0.06)');
        ctx.fillStyle = g; ctx.fill();
        ctx.restore();
      }
      // 레이저
      for (const ray of tr.rays) {
        if (ray.weak) continue;
        const col = ray.color;
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // 글로우
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = col; ctx.shadowBlur = 22;
        ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.globalAlpha = 0.55;
        this.pathOf(ray.pts); ctx.stroke();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        ctx.strokeStyle = col; ctx.lineWidth = 3.5; this.pathOf(ray.pts); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4; this.pathOf(ray.pts); ctx.stroke();
        // 흐르는 점
        ctx.setLineDash([6, 26]); ctx.lineDashOffset = -this.t * 220;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; this.pathOf(ray.pts); ctx.stroke();
        ctx.restore();
      }
    }
    pathOf(pts) { const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); }

    // ---------- 이벤트(반사·굴절 지점) ----------
    drawEvents(tr, state) {
      const ctx = this.ctx;
      for (const ray of tr.rays) {
        if (ray.weak) continue;
        for (const ev of ray.events) {
          if (ev.type === 'reflect' || ev.type === 'refract' || ev.type === 'tir' || ev.type === 'lens') {
            // 반짝임
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const r = 7 + Math.sin(this.t * 8) * 2;
            const g = ctx.createRadialGradient(ev.p.x, ev.p.y, 0, ev.p.x, ev.p.y, r * 2.2);
            g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,120,150,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ev.p.x, ev.p.y, r * 2.2, 0, TAU); ctx.fill();
            ctx.restore();
            if (this.studyMode) this.drawStudyOverlay(ev);
          }
          if (ev.type === 'absorb') {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(ev.p.x, ev.p.y, 0, ev.p.x, ev.p.y, 16);
            g.addColorStop(0, 'rgba(255,200,200,0.8)'); g.addColorStop(1, 'rgba(255,80,80,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ev.p.x, ev.p.y, 16, 0, TAU); ctx.fill(); ctx.restore();
          }
        }
      }
    }
    drawStudyOverlay(ev) {
      const ctx = this.ctx; const n = ev.n; if (!n) return;
      ctx.save();
      ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ev.p.x - n.x * 70, ev.p.y - n.y * 70); ctx.lineTo(ev.p.x + n.x * 70, ev.p.y + n.y * 70); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 13px "Noto Sans KR", sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
      let label = '';
      if (ev.type === 'reflect') label = `입사각 ${ev.angle.toFixed(0)}° = 반사각 ${ev.angle.toFixed(0)}°`;
      if (ev.type === 'refract') label = `입사각 ${ev.angleIn.toFixed(0)}° → 굴절각 ${ev.angleOut.toFixed(0)}°`;
      if (ev.type === 'tir') label = `전반사! (입사각 ${ev.angle.toFixed(0)}°)`;
      if (ev.type === 'lens') label = ev.f > 0 ? '볼록 렌즈: 모임' : '오목 렌즈: 퍼짐';
      const w = ctx.measureText(label).width + 14;
      const bx = Math.min(BOARD_W - w - 4, ev.p.x + 12), by = Math.max(4, ev.p.y - 34);
      ctx.fillStyle = 'rgba(10,12,30,0.85)'; rr(ctx, bx, by, w, 22, 6); ctx.fill();
      ctx.fillStyle = '#ffe28a'; ctx.fillText(label, bx + 7, by + 16);
      ctx.restore();
    }

    // ---------- 객체 ----------
    drawObject(o, state) {
      const ctx = this.ctx;
      switch (o.type) {
        case 'wall': return this.drawWall(o, '#3a3550', '#6a6190');
        case 'blocker': return this.drawWall(o, '#5a3f2e', '#9a7050', true);
        case 'mirror': return this.drawMirror(o, state);
        case 'water': return this.drawMedium(o, 'rgba(60,160,255,0.28)', 'rgba(140,210,255,0.9)', '물');
        case 'glass': return this.drawMedium(o, 'rgba(200,240,255,0.22)', 'rgba(255,255,255,0.9)', '유리');
        case 'lens': return this.drawLens(o, state);
        case 'target': return this.drawTarget(o, state);
        case 'object': return this.drawTreasure(o, state);
        case 'hazard': return this.drawBat(o, state);
        case 'screen': return this.drawScreen(o, state);
        case 'source': return this.drawSource(o, state);
      }
    }
    // 스프라이트 그리기 도우미: 중심(x,y)에 높이 h로
    spr(key, x, y, h, opt = {}) {
      const im = this.images[key]; if (!im) return false;
      const ctx = this.ctx; const w = h * im.width / im.height;
      ctx.save(); ctx.translate(x, y);
      if (opt.rot) ctx.rotate(opt.rot);
      if (opt.flipY) ctx.scale(1, -1);
      if (opt.alpha !== undefined) ctx.globalAlpha *= opt.alpha;
      if (opt.glow) { ctx.shadowColor = opt.glow; ctx.shadowBlur = opt.glowBlur || 24; }
      ctx.drawImage(im, -w / 2 + (opt.dx || 0), -h / 2 + (opt.dy || 0), w, h);
      ctx.restore(); return true;
    }
    drawWall(o, c1, c2, movable) {
      const ctx = this.ctx; const r = E.objRect(o);
      if (movable && this.images.rock) { // 바위(옮길 수 있는 장애물)
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(o.x, o.y + 22, 24, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        this.spr('rock', o.x, o.y, 58); return;
      }
      if (this.images.rock_tex) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
        rr(ctx, r.x0 + 2, r.y0 + 2, r.x1 - r.x0 - 4, r.y1 - r.y0 - 4, 10);
        if (!this._rockPat) this._rockPat = ctx.createPattern(this.images.rock_tex, 'repeat');
        ctx.fillStyle = this._rockPat; ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        const g = ctx.createLinearGradient(r.x0, r.y0, r.x1, r.y1); g.addColorStop(0, 'rgba(120,100,170,0.25)'); g.addColorStop(1, 'rgba(10,8,30,0.55)');
        ctx.fillStyle = g; ctx.fill();
        // 이끼 띠(위쪽)
        ctx.save(); ctx.clip();
        const mg = ctx.createLinearGradient(0, r.y0, 0, r.y0 + 14); mg.addColorStop(0, 'rgba(120,200,90,0.75)'); mg.addColorStop(1, 'rgba(120,200,90,0)');
        ctx.fillStyle = mg; ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, 14); ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2; rr(ctx, r.x0 + 3, r.y0 + 3, r.x1 - r.x0 - 6, r.y1 - r.y0 - 6, 8); ctx.stroke();
        ctx.restore(); return;
      }
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
      const g = ctx.createLinearGradient(r.x0, r.y0, r.x1, r.y1); g.addColorStop(0, c2); g.addColorStop(1, c1);
      ctx.fillStyle = g; rr(ctx, r.x0 + 2, r.y0 + 2, r.x1 - r.x0 - 4, r.y1 - r.y0 - 4, 10); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; rr(ctx, r.x0 + 4, r.y0 + 4, r.x1 - r.x0 - 8, r.y1 - r.y0 - 8, 8); ctx.stroke();
      // 돌 무늬
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      const n = Math.max(1, Math.round(((r.x1 - r.x0) * (r.y1 - r.y0)) / 2200));
      for (let i = 0; i < n; i++) { const px = r.x0 + 12 + ((i * 37) % Math.max(1, r.x1 - r.x0 - 24)), py = r.y0 + 12 + ((i * 53) % Math.max(1, r.y1 - r.y0 - 24)); ctx.beginPath(); ctx.ellipse(px, py, 7, 4, (i % 3) * 0.6, 0, TAU); ctx.fill(); }
      if (movable) { ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText('🪨', o.x, o.y + 7); }
      ctx.restore();
    }
    drawMirror(o, state) {
      const ctx = this.ctx; const sg = E.objSegment(o);
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate((o.angle || 0) * Math.PI / 180);
      const L = (o.len || 1) * CELL;
      // 뒷판
      ctx.fillStyle = '#2b2f45'; rr(ctx, -L / 2 - 3, -7, L + 6, 14, 5); ctx.fill();
      // 거울면
      const g = ctx.createLinearGradient(-L / 2, 0, L / 2, 0);
      g.addColorStop(0, '#dfe9ff'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#bcd0ff');
      ctx.fillStyle = g; rr(ctx, -L / 2, -4, L, 8, 3); ctx.fill();
      ctx.shadowColor = '#9fd3ff'; ctx.shadowBlur = 10; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.lineTo(L / 2, 0); ctx.stroke();
      ctx.restore();
      if (o.fixed) { ctx.save(); ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('🔒', o.x, o.y - 14); ctx.restore(); }
    }
    drawMedium(o, fill, edge, label) {
      const ctx = this.ctx; const r = E.objRect(o);
      ctx.save();
      ctx.fillStyle = fill; rr(ctx, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 8); ctx.fill();
      ctx.strokeStyle = edge; ctx.lineWidth = 2; rr(ctx, r.x0 + 1, r.y0 + 1, r.x1 - r.x0 - 2, r.y1 - r.y0 - 2, 7); ctx.stroke();
      if (o.type === 'water') {
        // 물결
        ctx.save(); ctx.beginPath(); rr(ctx, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 8); ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
        for (let k = 0; k < 4; k++) {
          const yy = r.y0 + 14 + k * ((r.y1 - r.y0 - 20) / 4);
          ctx.beginPath();
          for (let x = r.x0; x <= r.x1; x += 6) ctx.lineTo(x, yy + Math.sin((x / 18) + this.t * 2 + k) * 3);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(r.x0 + 10, r.y1 - 12); ctx.lineTo(r.x1 - 12, r.y0 + 10); ctx.stroke();
      }
      ctx.font = 'bold 13px "Noto Sans KR", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'center';
      ctx.fillText(label, (r.x0 + r.x1) / 2, r.y1 - 8);
      ctx.restore();
    }
    drawLens(o, state) {
      const ctx = this.ctx; const L = (o.len || 1.6) * CELL;
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate((o.angle || 0) * Math.PI / 180);
      const convex = o.kind !== 'concave';
      ctx.beginPath();
      if (convex) {
        ctx.moveTo(-L / 2, 0); ctx.quadraticCurveTo(0, -24, L / 2, 0); ctx.quadraticCurveTo(0, 24, -L / 2, 0);
      } else {
        ctx.moveTo(-L / 2, -14); ctx.lineTo(L / 2, -14); ctx.quadraticCurveTo(0, 2, L / 2, 14); ctx.lineTo(-L / 2, 14); ctx.quadraticCurveTo(0, -2, -L / 2, -14);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -20, 0, 20); g.addColorStop(0, 'rgba(220,245,255,0.75)'); g.addColorStop(0.5, 'rgba(160,220,255,0.35)'); g.addColorStop(1, 'rgba(220,245,255,0.75)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.font = 'bold 12px "Noto Sans KR", sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText(convex ? '볼록' : '오목', o.x, o.y + L / 2 + 16); ctx.restore();
    }
    drawTarget(o, state) {
      const ctx = this.ctx; const ts = state.evalr && state.evalr.targetState.find(t => t.obj === o);
      const lit = ts && ts.lit; const got = ts ? ts.got : 0; const need = o.need || 1;
      const r = o.r || 18; const pulse = 1 + (lit ? Math.sin(this.t * 6) * 0.08 : 0);
      ctx.save(); ctx.translate(o.x, o.y);
      if (lit || got > 0) {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3.2);
        g.addColorStop(0, lit ? 'rgba(255,240,200,0.9)' : 'rgba(255,200,230,0.5)'); g.addColorStop(1, 'rgba(255,120,220,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 3.2, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.scale(pulse, pulse);
      if (this.images.crystal_on && this.images.crystal_off) {
        const h = r * 2.9;
        ctx.restore();
        this.spr(lit ? 'crystal_on' : 'crystal_off', o.x, o.y - r * 0.15, h * pulse, { glow: lit ? 'rgba(255,220,120,0.9)' : (got > 0 ? 'rgba(255,150,220,0.7)' : null), glowBlur: 26 });
        ctx.save(); ctx.translate(o.x, o.y);
      } else {
      // 보석 (6각)
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * TAU / 6; const rr2 = i % 2 ? r * 0.86 : r; ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
      ctx.closePath();
      const g2 = ctx.createLinearGradient(-r, -r, r, r);
      if (lit) { g2.addColorStop(0, '#fff6c8'); g2.addColorStop(0.5, '#ffd36b'); g2.addColorStop(1, '#ff8ad6'); }
      else { g2.addColorStop(0, '#6a5a9a'); g2.addColorStop(1, '#2d2650'); }
      ctx.fillStyle = g2; ctx.fill();
      ctx.strokeStyle = lit ? '#fff' : 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.1); ctx.lineTo(0, -r * 0.75); ctx.lineTo(r * 0.3, -r * 0.2); ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
      }
      ctx.restore();
      if (need > 1) {
        ctx.save(); ctx.translate(o.x, o.y);
        for (let i = 0; i < need; i++) {
          const a0 = -Math.PI / 2 + i * TAU / need + 0.12, a1 = -Math.PI / 2 + (i + 1) * TAU / need - 0.12;
          ctx.beginPath(); ctx.arc(0, 0, r + 8, a0, a1); ctx.lineWidth = 4; ctx.strokeStyle = i < got ? '#ffd36b' : 'rgba(255,255,255,0.25)'; ctx.stroke();
        }
        ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(`${Math.min(got, need)}/${need}`, 0, r + 26);
        ctx.restore();
      }
    }
    drawTreasure(o, state) {
      const ctx = this.ctx; const ts = state.evalr && state.evalr.targetState.find(t => t.obj === o);
      const lit = ts && ts.lit; const got = ts ? ts.got : 0;
      const vis = Math.min(1, got / (o.need || 1)) * 0.85 + (lit ? 0.15 : 0);
      if (vis <= 0.02) return;
      if (this.images.chest_closed) {
        this.spr(lit ? 'chest_open' : 'chest_closed', o.x, o.y - 6, 64, { alpha: vis, glow: lit ? 'rgba(255,211,107,0.95)' : null, glowBlur: 30 });
        ctx.save(); ctx.globalAlpha = vis; ctx.font = 'bold 12px "Noto Sans KR", sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText(lit ? '보물상자가 보여요!' : '무언가 있는 것 같아…', o.x, o.y + 42); ctx.restore();
        return;
      }
      ctx.save(); ctx.globalAlpha = vis; ctx.translate(o.x, o.y);
      if (lit) { ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 24; }
      // 상자
      ctx.fillStyle = '#8a5a2b'; rr(ctx, -26, -10, 52, 30, 6); ctx.fill();
      ctx.fillStyle = '#b57a3a'; rr(ctx, -26, -24, 52, 18, 8); ctx.fill();
      ctx.fillStyle = '#ffd36b'; ctx.fillRect(-26, -8, 52, 4); ctx.fillRect(-4, -14, 8, 14);
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(0, -6, 4, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = vis; ctx.font = 'bold 12px "Noto Sans KR", sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText(lit ? '보물상자가 보여요!' : '무언가 있는 것 같아…', o.x, o.y + 40); ctx.restore();
    }
    drawBat(o, state) {
      const ctx = this.ctx; const hit = state.trace && state.trace.hazards.has(o);
      const flap = hit ? Math.sin(this.t * 25) * 0.6 : Math.sin(this.t * 1.5) * 0.05;
      if (this.images.bat_sleep) {
        const bob = hit ? Math.sin(this.t * 18) * 4 : Math.sin(this.t * 1.6) * 2;
        const shake = hit ? Math.sin(this.t * 40) * 0.08 : 0;
        this.spr(hit ? 'bat_awake' : 'bat_sleep', o.x, o.y + bob, hit ? 56 : 52, { rot: shake, glow: hit ? 'rgba(255,60,60,0.8)' : null, glowBlur: 20 });
        ctx.save(); ctx.font = 'bold 12px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = hit ? '#ff7b7b' : 'rgba(255,255,255,0.8)';
        ctx.fillText(hit ? '박쥐가 깼어요! 😱' : 'z z z', o.x + (hit ? 0 : 22), o.y - 30 - (hit ? 0 : (this.t * 8 % 6)));
        ctx.restore();
        return;
      }
      ctx.save(); ctx.translate(o.x, o.y);
      if (hit) { ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 20; }
      ctx.fillStyle = hit ? '#5a1a2a' : '#2a2238';
      // 날개
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1); ctx.rotate(flap);
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.quadraticCurveTo(22, -18, 34, -4); ctx.quadraticCurveTo(28, 2, 24, 8); ctx.quadraticCurveTo(18, 2, 12, 10); ctx.quadraticCurveTo(10, 4, 6, 6); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.beginPath(); ctx.ellipse(0, 2, 9, 12, 0, 0, TAU); ctx.fill();
      // 귀
      ctx.beginPath(); ctx.moveTo(-7, -8); ctx.lineTo(-4, -17); ctx.lineTo(0, -8); ctx.moveTo(7, -8); ctx.lineTo(4, -17); ctx.lineTo(0, -8); ctx.fill();
      // 눈
      ctx.fillStyle = hit ? '#ff4d4d' : '#101018';
      if (hit) { ctx.beginPath(); ctx.arc(-3, -1, 2.2, 0, TAU); ctx.arc(3, -1, 2.2, 0, TAU); ctx.fill(); }
      else { ctx.strokeStyle = '#8fb'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-5, -1); ctx.lineTo(-1, -1); ctx.moveTo(1, -1); ctx.lineTo(5, -1); ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.font = 'bold 12px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = hit ? '#ff7b7b' : 'rgba(255,255,255,0.75)';
      ctx.fillText(hit ? '박쥐가 깼어요! 😱' : 'z z z', o.x, o.y - 24); ctx.restore();
    }
    drawScreen(o, state) {
      const ctx = this.ctx; const r = E.objRect(o);
      ctx.save();
      ctx.fillStyle = '#e9e4d2'; rr(ctx, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 4); ctx.fill();
      ctx.strokeStyle = '#8a8470'; ctx.lineWidth = 2; ctx.stroke();
      const horizontal = (r.x1 - r.x0) >= (r.y1 - r.y0); const len = horizontal ? r.x1 - r.x0 : r.y1 - r.y0;
      // 비친 빛
      for (const h of state.trace.screenHits) {
        if (h.obj !== o) continue;
        ctx.fillStyle = 'rgba(255,230,140,0.35)';
        if (horizontal) ctx.fillRect(r.x0 + h.u * len - 4, r.y0, 8, r.y1 - r.y0); else ctx.fillRect(r.x0, r.y0 + h.u * len - 4, r.x1 - r.x0, 8);
      }
      // 구역
      for (const z of (o.zones || [])) {
        const zs = state.evalr && state.evalr.zoneState.find(s => s.zone === z);
        const ok = zs && zs.ok;
        const a0 = z.u0 * len, a1 = z.u1 * len;
        ctx.fillStyle = z.want === 'dark' ? 'rgba(60,40,90,0.35)' : 'rgba(255,200,80,0.25)';
        if (horizontal) ctx.fillRect(r.x0 + a0, r.y0, a1 - a0, r.y1 - r.y0); else ctx.fillRect(r.x0, r.y0 + a0, r.x1 - r.x0, a1 - a0);
        ctx.strokeStyle = ok ? '#4ade80' : '#f87171'; ctx.lineWidth = 2.5;
        if (horizontal) ctx.strokeRect(r.x0 + a0, r.y0 - 2, a1 - a0, r.y1 - r.y0 + 4); else ctx.strokeRect(r.x0 - 2, r.y0 + a0, r.x1 - r.x0 + 4, a1 - a0);
        const cx = horizontal ? r.x0 + (a0 + a1) / 2 : r.x1 + 16, cy = horizontal ? r.y1 + 16 : r.y0 + (a0 + a1) / 2;
        ctx.font = '16px sans-serif'; ctx.textAlign = horizontal ? 'center' : 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff'; ctx.fillText((z.want === 'dark' ? '🦇' : '🏮') + (ok ? '✅' : '❌'), cx, cy);
        ctx.font = 'bold 11px "Noto Sans KR", sans-serif'; ctx.fillStyle = ok ? '#bbf7d0' : '#fecaca';
        ctx.fillText(z.want === 'dark' ? '그림자!' : '밝게!', horizontal ? cx : cx + 42, horizontal ? cy + 16 : cy);
      }
      ctx.restore();
    }
    drawSource(o, state) {
      const ctx = this.ctx; const a = (o.angle || 0) * Math.PI / 180;
      ctx.save(); ctx.translate(o.x, o.y);
      // 받침
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 14, 22, 8, 0, 0, TAU); ctx.fill();
      ctx.rotate(a);
      const col = o.color || '#ff3b5c';
      const sprKey = o.mode === 'flashlight' ? 'flashlight' : (o.label === '빛물고기' ? 'fish' : 'emitter');
      if (this.images[sprKey]) {
        ctx.restore();
        const flip = Math.cos(a) < 0; // 왼쪽을 향하면 위아래를 뒤집어 똑바로 보이게
        if (o.beams === 3) { // 3구 레이저: 세 개의 노즐 받침
          ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(a);
          ctx.fillStyle = 'rgba(30,34,70,0.9)'; rr(ctx, -6, -(o.gap || 40) - 9, 26, 2 * (o.gap || 40) + 18, 8); ctx.fill();
          ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12;
          for (const k of [-1, 0, 1]) { rr(ctx, 12, k * (o.gap || 40) - 5, 12, 10, 3); ctx.fill(); }
          ctx.restore();
        }
        if (sprKey === 'flashlight') this.spr('flashlight', o.x, o.y, 30, { rot: a, flipY: flip, dx: -18 });
        else if (sprKey === 'fish') this.spr('fish', o.x, o.y, 46, { rot: a, flipY: flip, glow: 'rgba(120,255,200,0.8)' });
        else this.spr('emitter', o.x, o.y, o.beams === 3 ? 34 : 40, { rot: a, flipY: flip, dx: -22 });
      } else if (o.mode === 'flashlight') {
        ctx.fillStyle = '#3b3f55'; rr(ctx, -30, -9, 40, 18, 6); ctx.fill();
        ctx.fillStyle = '#6c7390'; ctx.beginPath(); ctx.moveTo(8, -12); ctx.lineTo(24, -16); ctx.lineTo(24, 16); ctx.lineTo(8, 12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff2b0'; ctx.shadowColor = '#ffe28a'; ctx.shadowBlur = 18; ctx.fillRect(22, -14, 4, 28);
      } else {
        ctx.fillStyle = '#2d3150'; rr(ctx, -26, -11, 44, 22, 7); ctx.fill();
        ctx.fillStyle = '#4a5078'; rr(ctx, -20, -7, 30, 14, 5); ctx.fill();
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 16; rr(ctx, 14, -6, 12, 12, 3); ctx.fill();
        if (o.beams === 3) { ctx.shadowBlur = 8; ctx.fillRect(14, -46, 10, 8); ctx.fillRect(14, 38, 10, 8); ctx.fillStyle = '#2d3150'; ctx.shadowBlur = 0; ctx.fillRect(-10, -44, 24, 88 - 0); ctx.fillStyle = col; ctx.shadowBlur = 12; ctx.fillRect(10, -(o.gap || 40) - 4, 14, 8); ctx.fillRect(10, (o.gap || 40) - 4, 14, 8); ctx.fillRect(10, -4, 14, 8); }
      }
      if (!this.images[sprKey]) ctx.restore();
      if (o.label) { ctx.save(); ctx.font = 'bold 12px "Noto Sans KR", sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(o.label, o.x, o.y + 34); ctx.restore(); }
      // 회전 가능 표시
      if (state.level.sourceRotatable) {
        ctx.save(); ctx.translate(o.x, o.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        // 손잡이
        const hx = Math.cos(a) * 44, hy = Math.sin(a) * 44;
        ctx.fillStyle = '#ffd36b'; ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(hx, hy, 9, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    drawSelection(o, state) {
      const ctx = this.ctx;
      ctx.save(); ctx.translate(o.x, o.y);
      ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -this.t * 40;
      ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      if (o.type === 'mirror' || o.type === 'lens' || o.type === 'source') {
        const a = (o.angle || 0) * Math.PI / 180; const R = 50;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#ffd36b'; ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(Math.cos(a) * R, Math.sin(a) * R, 9, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#1a1a2a'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('↻', Math.cos(a) * R, Math.sin(a) * R + 1);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Noto Sans KR", sans-serif';
        ctx.fillText(`${Math.round(((o.angle % 360) + 360) % 360)}°`, 0, -R - 14);
      }
      ctx.restore();
    }

    // ---------- 파티클 ----------
    burst(x, y, color, n = 18) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, s = 60 + Math.random() * 160;
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + Math.random() * 0.5, color, r: 2 + Math.random() * 3 });
      }
    }
    drawParticles(dt) {
      const ctx = this.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
      this.particles = this.particles.filter(p => (p.life -= dt) > 0);
      for (const p of this.particles) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt;
        ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  global.LightRenderer = Renderer;
})(window);
