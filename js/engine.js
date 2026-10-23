/* ============================================================
   빛의 미로 — 광선 추적 엔진 (engine.js)
   - 직진 / 반사(입사각=반사각) / 굴절(스넬의 법칙) / 얇은 렌즈
   - 좌표계: 논리 보드 960 x 600 (px), 셀 60px → 16 x 10 칸
   ============================================================ */
(function (global) {
  'use strict';

  const BOARD_W = 960, BOARD_H = 600, CELL = 60;
  const EPS = 1e-6;
  const MAX_BOUNCES = 60;

  // ---------- 벡터 유틸 ----------
  const V = {
    add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
    sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
    mul: (a, s) => ({ x: a.x * s, y: a.y * s }),
    dot: (a, b) => a.x * b.x + a.y * b.y,
    len: (a) => Math.hypot(a.x, a.y),
    norm: (a) => { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; },
    perp: (a) => ({ x: -a.y, y: a.x }),
    fromAngle: (deg) => { const r = deg * Math.PI / 180; return { x: Math.cos(r), y: Math.sin(r) }; },
    toAngle: (v) => Math.atan2(v.y, v.x) * 180 / Math.PI,
    reflect: (d, n) => { const k = 2 * (d.x * n.x + d.y * n.y); return { x: d.x - k * n.x, y: d.y - k * n.y }; },
  };

  // 셀 좌표 → 픽셀 중심
  const cellToPx = (cx, cy) => ({ x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL });
  const pxToCell = (x, y) => ({ cx: Math.floor(x / CELL), cy: Math.floor(y / CELL) });

  // ---------- 교차 계산 ----------
  // 광선 (o, d) 와 선분 (a, b) : t(광선 거리) 반환, 없으면 null
  function raySegment(o, d, a, b) {
    const e = V.sub(b, a);
    const denom = d.x * e.y - d.y * e.x;
    if (Math.abs(denom) < EPS) return null;
    const ao = V.sub(a, o);
    const t = (ao.x * e.y - ao.y * e.x) / denom;
    const u = (ao.x * d.y - ao.y * d.x) / denom;
    if (t > EPS && u >= -EPS && u <= 1 + EPS) {
      return { t, u: Math.min(1, Math.max(0, u)) };
    }
    return null;
  }

  // 광선과 축정렬 사각형 (x0,y0,x1,y1) : 가장 가까운 면 + 법선
  function rayRect(o, d, r) {
    let tmin = -Infinity, tmax = Infinity, nmin = null;
    const axes = [
      { o: o.x, d: d.x, lo: r.x0, hi: r.x1, nlo: { x: -1, y: 0 }, nhi: { x: 1, y: 0 } },
      { o: o.y, d: d.y, lo: r.y0, hi: r.y1, nlo: { x: 0, y: -1 }, nhi: { x: 0, y: 1 } },
    ];
    for (const ax of axes) {
      if (Math.abs(ax.d) < EPS) {
        if (ax.o < ax.lo || ax.o > ax.hi) return null;
      } else {
        let t1 = (ax.lo - ax.o) / ax.d, t2 = (ax.hi - ax.o) / ax.d;
        let n1 = ax.nlo, n2 = ax.nhi;
        if (t1 > t2) { [t1, t2] = [t2, t1]; [n1, n2] = [n2, n1]; }
        if (t1 > tmin) { tmin = t1; nmin = n1; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return null;
      }
    }
    if (tmax < EPS) return null;
    if (tmin > EPS) return { t: tmin, n: nmin, inside: false };
    // 광선 시작점이 사각형 내부 → 나가는 면
    // 나가는 면의 법선(바깥 방향)
    let bestT = Infinity, bestN = null;
    for (const ax of axes) {
      if (Math.abs(ax.d) < EPS) continue;
      const tl = (ax.lo - ax.o) / ax.d, th = (ax.hi - ax.o) / ax.d;
      if (tl > EPS && tl < bestT) { bestT = tl; bestN = ax.nlo; }
      if (th > EPS && th < bestT) { bestT = th; bestN = ax.nhi; }
    }
    return bestN ? { t: bestT, n: bestN, inside: true } : null;
  }

  // 광선과 원
  function rayCircle(o, d, c, r) {
    const oc = V.sub(o, c);
    const b = V.dot(oc, d);
    const cc = V.dot(oc, oc) - r * r;
    const disc = b * b - cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    let t = -b - s;
    if (t < EPS) t = -b + s;
    if (t < EPS) return null;
    return { t };
  }

  // ---------- 객체 기하 ----------
  function objRect(o) {
    const w = (o.w || 1) * CELL, h = (o.h || 1) * CELL;
    return { x0: o.x - w / 2, y0: o.y - h / 2, x1: o.x + w / 2, y1: o.y + h / 2 };
  }
  function objSegment(o) {
    const len = (o.len || 1) * CELL;
    const dir = V.fromAngle(o.angle || 0);
    const half = V.mul(dir, len / 2);
    return { a: V.sub(o, half), b: V.add(o, half), dir };
  }

  // ---------- 광선 추적 ----------
  /**
   * level.objects 를 바탕으로 모든 광원에서 광선을 추적한다.
   * 반환: { rays:[{color, pts:[{x,y}], events:[...]}], targets:Map(id→hitCount), hazards:Set, screenHits:[] }
   */
  function trace(objects, opts = {}) {
    const result = { rays: [], hits: new Map(), hazards: new Set(), screenHits: [], events: [] };
    const sources = objects.filter(o => o.type === 'source');
    for (const s of sources) {
      const beams = [];
      if (s.mode === 'flashlight') {
        const spread = s.spread || 36, n = s.rays || 73;
        for (let i = 0; i < n; i++) {
          const a = s.angle - spread / 2 + spread * i / (n - 1);
          beams.push({ o: { x: s.x, y: s.y }, d: V.fromAngle(a), weak: true });
        }
      } else if (s.beams === 3) {
        const dir = V.fromAngle(s.angle), p = V.perp(dir);
        const gap = s.gap || 22;
        for (const k of [-1, 0, 1]) {
          beams.push({ o: V.add({ x: s.x, y: s.y }, V.mul(p, gap * k)), d: dir });
        }
      } else {
        beams.push({ o: { x: s.x, y: s.y }, d: V.fromAngle(s.angle) });
      }
      for (const b of beams) {
        const ray = traceRay(b.o, b.d, objects, s, result, opts);
        ray.color = s.color || '#ff3b5c';
        ray.weak = !!b.weak;
        result.rays.push(ray);
      }
    }
    return result;
  }

  function traceRay(origin, dir, objects, source, result, opts) {
    const pts = [{ x: origin.x, y: origin.y }];
    const events = [];
    let o = { x: origin.x, y: origin.y }, d = V.norm(dir);
    let medium = null; // 현재 들어가 있는 매질 객체 (water/glass)
    let lastObj = null;
    const passed = new Set(); // 통과한 투명 크리스탈 (한 광선이 같은 걸 두번 세지 않게)

    for (let bounce = 0; bounce < MAX_BOUNCES; bounce++) {
      let best = { t: Infinity, obj: null, n: null, u: 0, inside: false };

      // 보드 경계
      const edgeT = rayRect(o, d, { x0: 0, y0: 0, x1: BOARD_W, y1: BOARD_H });
      if (edgeT && edgeT.inside) best = { t: edgeT.t, obj: { type: 'edge' }, n: edgeT.n };

      for (const obj of objects) {
        if (obj === source && (obj.type === 'source')) continue;
        if (obj.type === 'source' || obj.type === 'deco') continue;
        if (obj.hidden) continue;
        let hit = null;
        switch (obj.type) {
          case 'wall': case 'blocker': case 'screen': {
            const r = rayRect(o, d, objRect(obj));
            if (r && !r.inside) hit = { t: r.t, n: r.n };
            break;
          }
          case 'water': case 'glass': {
            const r = rayRect(o, d, objRect(obj));
            if (r) hit = { t: r.t, n: r.n, inside: r.inside };
            break;
          }
          case 'mirror': {
            const sg = objSegment(obj);
            const r = raySegment(o, d, sg.a, sg.b);
            if (r) hit = { t: r.t, n: V.perp(sg.dir), u: r.u };
            break;
          }
          case 'lens': {
            const sg = objSegment(obj);
            const r = raySegment(o, d, sg.a, sg.b);
            if (r) hit = { t: r.t, n: V.perp(sg.dir), u: r.u };
            break;
          }
          case 'target': case 'hazard': case 'object': {
            if (obj.type === 'target' && passed.has(obj)) break;
            const r = rayCircle(o, d, obj, obj.r || 18);
            if (r) hit = { t: r.t };
            break;
          }
        }
        if (hit && hit.t < best.t - EPS && obj !== lastObj) {
          best = { t: hit.t, obj, n: hit.n, u: hit.u || 0, inside: !!hit.inside };
        } else if (hit && obj === lastObj && hit.t > CELL * 0.02 && hit.t < best.t - EPS) {
          // 같은 매질 내부에서 나갈 때는 허용
          if (obj.type === 'water' || obj.type === 'glass') best = { t: hit.t, obj, n: hit.n, u: hit.u || 0, inside: !!hit.inside };
        }
      }

      const p = V.add(o, V.mul(d, best.t));
      pts.push(p);
      const obj = best.obj;
      if (!obj || obj.type === 'edge') { events.push({ type: 'edge', p }); break; }

      if (obj.type === 'wall' || obj.type === 'blocker') { events.push({ type: 'absorb', p, obj }); break; }
      if (obj.type === 'screen') {
        // 스크린 위 위치 기록 (0~1, 스크린 긴 방향 기준)
        const r = objRect(obj);
        const horizontal = (r.x1 - r.x0) >= (r.y1 - r.y0);
        const u = horizontal ? (p.x - r.x0) / (r.x1 - r.x0) : (p.y - r.y0) / (r.y1 - r.y0);
        result.screenHits.push({ obj, u, p });
        events.push({ type: 'screen', p, obj });
        break;
      }
      if (obj.type === 'target') {
        result.hits.set(obj, (result.hits.get(obj) || 0) + 1);
        passed.add(obj);
        events.push({ type: 'target', p, obj });
        lastObj = obj;
        o = V.add(p, V.mul(d, 0.5));
        if (obj.absorb) break; // 불투명 타깃이면 흡수
        continue; // 투명 크리스탈: 계속 진행
      }
      if (obj.type === 'object') { result.hits.set(obj, (result.hits.get(obj) || 0) + 1); events.push({ type: 'object', p, obj }); break; }
      if (obj.type === 'hazard') { result.hazards.add(obj); events.push({ type: 'hazard', p, obj }); break; }

      if (obj.type === 'mirror') {
        let n = best.n;
        if (V.dot(n, d) > 0) n = V.mul(n, -1);
        const incident = Math.acos(Math.min(1, Math.abs(V.dot(d, n)))) * 180 / Math.PI;
        d = V.reflect(d, n);
        events.push({ type: 'reflect', p, obj, n, angle: incident });
        o = p; lastObj = obj;
        continue;
      }

      if (obj.type === 'water' || obj.type === 'glass') {
        const nIdx = obj.n || (obj.type === 'water' ? 1.33 : 1.5);
        let n = best.n;
        let n1, n2;
        if (!best.inside) { // 들어감 (공기→매질)
          n1 = 1; n2 = nIdx;
          if (V.dot(n, d) > 0) n = V.mul(n, -1);
        } else { // 나감 (매질→공기)
          n1 = nIdx; n2 = 1;
          if (V.dot(n, d) > 0) n = V.mul(n, -1);
        }
        // 스넬의 법칙
        const cosI = -V.dot(n, d);
        const sinI = Math.sqrt(Math.max(0, 1 - cosI * cosI));
        const sinT = n1 / n2 * sinI;
        const angI = Math.asin(Math.min(1, sinI)) * 180 / Math.PI;
        if (sinT > 1) { // 전반사
          d = V.reflect(d, n);
          events.push({ type: 'tir', p, obj, n, angle: angI });
          o = p; lastObj = obj;
          continue;
        }
        const cosT = Math.sqrt(1 - sinT * sinT);
        const eta = n1 / n2;
        const newD = V.add(V.mul(d, eta), V.mul(n, eta * cosI - cosT));
        const angT = Math.asin(sinT) * 180 / Math.PI;
        d = V.norm(newD);
        events.push({ type: 'refract', p, obj, n, angleIn: angI, angleOut: angT, entering: !best.inside });
        o = p; lastObj = obj; medium = best.inside ? null : obj;
        continue;
      }

      if (obj.type === 'lens') {
        // 얇은 렌즈: 광축 = 렌즈 법선 방향. 렌즈 선 위의 위치 h(렌즈 중심 기준)로 꺾임.
        const sg = objSegment(obj);
        let axis = best.n; // 법선
        if (V.dot(axis, d) < 0) axis = V.mul(axis, -1); // 진행방향과 같은 쪽
        const alongLens = sg.dir; // 렌즈 면 방향
        const h = V.dot(V.sub(p, obj), alongLens); // 중심으로부터 거리 (부호 있음)
        const f = (obj.kind === 'concave' ? -1 : 1) * (obj.f || 170);
        // 입사 기울기 (렌즈면 방향 성분 / 광축 성분)
        const dAxis = V.dot(d, axis), dAlong = V.dot(d, alongLens);
        const slopeIn = dAlong / dAxis;
        const slopeOut = slopeIn - h / f;
        const newD = V.norm(V.add(V.mul(axis, 1), V.mul(alongLens, slopeOut)));
        events.push({ type: 'lens', p, obj, h, f });
        d = newD; o = p; lastObj = obj;
        continue;
      }
      break;
    }
    return { pts, events };
  }

  // ---------- 승리 판정 ----------
  function evaluate(level, tr) {
    const objs = level.objects;
    const targets = objs.filter(o => o.type === 'target' || o.type === 'object');
    let litCount = 0;
    const targetState = targets.map(t => {
      const need = t.need || 1;
      const got = tr.hits.get(t) || 0;
      const lit = got >= need;
      if (lit) litCount++;
      return { obj: t, got, need, lit };
    });
    // 스크린 구역 판정
    const screens = objs.filter(o => o.type === 'screen');
    const zoneState = [];
    for (const sc of screens) {
      for (const z of (sc.zones || [])) {
        const hits = tr.screenHits.filter(h => h.obj === sc && h.u >= z.u0 && h.u <= z.u1).length;
        const lit = hits >= (z.minHits || 2);
        const ok = z.want === 'lit' ? lit : !lit;
        zoneState.push({ screen: sc, zone: z, lit, ok });
      }
    }
    const hazardsHit = tr.hazards.size > 0;
    const win = targetState.every(t => t.lit) && zoneState.every(z => z.ok) && !hazardsHit && (targetState.length + zoneState.length > 0);
    return { win, targetState, zoneState, litCount, hazardsHit };
  }

  global.LightEngine = { V, BOARD_W, BOARD_H, CELL, cellToPx, pxToCell, objRect, objSegment, trace, evaluate, rayRect, raySegment };
})(window);
