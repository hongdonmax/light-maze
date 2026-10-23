/* ============================================================
   빛의 미로 — 게임 로직 & UI (game.js)
   ============================================================ */
(function (global) {
  'use strict';
  const E = global.LightEngine, L = global.LightLevels, S = global.LightSound;
  const { CELL, BOARD_W, BOARD_H } = E;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const STORE_KEY = 'lightmaze.progress.v1';

  const PIECE_INFO = {
    mirror: { name: '평면거울', icon: '🪞', desc: '빛을 반사해요. 회전 가능' },
    blocker: { name: '바위', icon: '🪨', desc: '빛을 막아 그림자를 만들어요' },
    wall: { name: '벽', icon: '🧱', desc: '빛을 막아요' },
    water: { name: '물 블록', icon: '💧', desc: '빛이 굴절해요 (n=1.33)' },
    glass: { name: '유리 블록', icon: '🧊', desc: '빛이 굴절해요 (n=1.5)' },
    lens_convex: { name: '볼록 렌즈', icon: '🔍', desc: '빛을 한 점으로 모아요' },
    lens_concave: { name: '오목 렌즈', icon: '👓', desc: '빛을 퍼뜨려요' },
    target: { name: '크리스탈', icon: '💎', desc: '빛이 닿으면 밝아져요' },
    source: { name: '레이저', icon: '🔦', desc: '빛을 내보내요' },
  };
  const pieceKey = (inv) => inv.type === 'lens' ? `lens_${inv.kind}` : inv.type;

  // 루미의 스테이지 대사 (지도서 차시 흐름에 맞춤)
  const STAGE_TALK = {
    '1-1': '여기는 캄캄한 <b>어둠상자</b> 동굴이야. 손전등을 끄면 아무것도 안 보이지? 물체를 보려면 <b>빛</b>이 꼭 필요해! 노란 손잡이로 손전등을 돌려 봐.',
    '1-2': '레이저 빛은 휘지 않고 <b>곧게</b> 나아가. 발사기와 크리스탈을 잇는 <b>직선</b>을 상상해 봐!',
    '1-3': '빛이 <b>불투명한 바위</b>에 막히면 뒤에 <b>그림자</b>가 생겨. 바위를 손전등 가까이 두면 그림자가 커져!',
    '2-1': '드디어 <b>거울</b>이다! 빛이 거울에 부딪치면 나아가는 방향이 바뀌어. 이걸 빛의 <b>반사</b>라고 해.',
    '2-2': '거울 두 개로 빛을 두 번 꺾어 보자. 들어온 각도와 나가는 각도는 <b>같아</b>!',
    '2-3': '쉿… 박쥐가 자고 있어. 빛이 박쥐에 닿기 <b>전에</b> 거울로 길을 바꿔야 해!',
    '2-4': '벽 너머가 안 보이네? 거울 두 개를 나란히 기울이면 <b>잠망경</b>이 돼. 잠수함도 이 원리를 써!',
    '3-1': '호수다! 빛이 공기에서 물로 <b>비스듬히</b> 들어가면 경계에서 <b>꺾여</b>. 크리스탈을 똑바로 겨누면 빗나갈걸?',
    '3-2': '이번엔 빛을 물에 <b>수직으로</b> 넣어 보자. 수직으로 들어간 빛은 꺾일까, 안 꺾일까?',
    '3-3': '물속 빛물고기의 빛이 <b>물 밖으로</b> 나갈 때도 경계에서 꺾여. 수면 쪽으로 눕듯이 꺾이니까 크리스탈보다 조금 더 <b>가파르게</b> 겨눠 봐!',
    '3-4': '유리 블록도 물처럼 빛을 <b>굴절</b>시켜. 들어갈 때 한 번, 나올 때 한 번 꺾이는 걸 잘 봐!',
    '4-1': '가운데가 두꺼운 <b>볼록 렌즈</b>는 빛을 한 점으로 <b>모아</b>. 세 줄기 빛을 모두 크리스탈에 모아 볼까?',
    '4-2': '가운데가 얇은 <b>오목 렌즈</b>는 빛을 <b>퍼뜨려</b>. 크리스탈 세 개를 한꺼번에 밝혀 보자!',
    '4-3': '좁은 틈으로 빛을 모두 통과시키려면? 볼록 렌즈로 빛이 모이는 점을 <b>틈</b>에 맞춰 봐!',
    '5-1': '마지막 미로야! <b>직진·반사·굴절</b>을 모두 써서 크리스탈 두 개를 밝히고 박쥐는 피하자. 할 수 있어!',
  };
  const CHEERS = ['오, 크리스탈에 빛이 닿았어! ✨', '좋아, 그 방향이야!', '빛의 길이 보이기 시작했어!', '거의 다 왔어! 조금만 더!'];

  class Game {
    constructor() {
      this.canvas = $('#board');
      this.R = new global.LightRenderer(this.canvas);
      this.progress = this.loadProgress();
      this.state = { level: null, trace: { rays: [], hits: new Map(), hazards: new Set(), screenHits: [] }, evalr: null, selected: null, ghost: null };
      this.drag = null; this.lastTime = 0; this.winLock = false; this.stableSince = 0;
      this.bindUI();
      this.loadAssets();
      requestAnimationFrame((t) => this.loop(t));
      window.addEventListener('resize', () => this.R.resize());
      this.showScreen('title');
      this.renderTitle();
    }

    // ---------- 저장 ----------
    loadProgress() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { stars: {}, concepts: [], quiz: false }; } catch (e) { return { stars: {}, concepts: [], quiz: false }; } }
    saveProgress() { try { localStorage.setItem(STORE_KEY, JSON.stringify(this.progress)); } catch (e) { } }

    async loadAssets() {
      const list = [['keyart', 'assets/keyart.jpg'], ['lumi', 'assets/lumi.png'], ['bandi', 'assets/bandi.png'], ['map', 'assets/worldmap.jpg'],
        ['world1', 'assets/world1.jpg'], ['world2', 'assets/world2.jpg'], ['world3', 'assets/world3.jpg'], ['world4', 'assets/world4.jpg'],
        ['rock_tex', 'assets/sprites/rock_tex.jpg']];
      for (const k of ['crystal_off', 'crystal_on', 'bat_sleep', 'bat_awake', 'chest_closed', 'chest_open', 'emitter', 'flashlight', 'rock', 'pillar', 'fish', 'star'])
        list.push([k, `assets/sprites/${k}.png`]);
      await Promise.all(list.map(([k, src]) => this.R.loadImage(k, src)));
    }

    // ---------- 화면 전환 ----------
    showScreen(name) {
      $$('.screen').forEach(s => s.classList.toggle('active', s.dataset.screen === name));
      this.screen = name;
      if (name === 'game') { requestAnimationFrame(() => this.R.resize()); }
    }

    bindUI() {
      // 타이틀
      $('#btn-start').addEventListener('click', () => {
        S.init(); S.click();
        if (!this.progress.quiz && !this.progress.teacher) { this.openModal('gate'); return; }   // 입장퀴즈 7/10 통과해야 입장
        S.startBgm(); this.renderMap(); this.showScreen('map');
      });
      $('#btn-gate-quiz').addEventListener('click', () => { location.href = 'quiz/index.html'; });
      $('#btn-gate-teacher').addEventListener('click', () => { this.closeModal(); this.askTeacher(); });
      $('#btn-lab').addEventListener('click', () => { S.init(); S.startBgm(); S.click(); this.startLevel(L.LAB); });
      $('#btn-howto').addEventListener('click', () => { S.init(); S.click(); this.openModal('howto'); });
      $('#btn-quiz').addEventListener('click', () => { location.href = 'quiz/index.html'; });
      // 맵
      $('#btn-map-back').addEventListener('click', () => { S.click(); this.showScreen('title'); this.renderTitle(); });
      $('#btn-concepts').addEventListener('click', () => { S.click(); this.openConcepts(); });
      // 게임 HUD
      $('#btn-to-map').addEventListener('click', () => { S.click(); this.leaveLevel(); });
      $('#btn-reset').addEventListener('click', () => { S.click(); this.startLevel(this.state.level.src); });
      $('#btn-hint').addEventListener('click', () => { S.click(); this.toast('💡 ' + this.state.level.hint, 5000); this.say('💡 ' + this.state.level.hint); });
      $('#btn-cert-print').addEventListener('click', () => { S.click(); window.print(); });
      $('#btn-study').addEventListener('click', (e) => { S.click(); this.R.studyMode = !this.R.studyMode; e.currentTarget.classList.toggle('on', this.R.studyMode); this.toast(this.R.studyMode ? '🔬 돋보기 모드(심화): 입사각·반사각·굴절각이 표시돼요' : '돋보기 모드 끔', 2500); });
      $('#btn-sound').addEventListener('click', (e) => { const on = S.toggle(); e.currentTarget.textContent = on ? '🔊' : '🔇'; });
      $('#btn-rot-l').addEventListener('click', () => this.rotateSelected(-15));
      $('#btn-rot-r').addEventListener('click', () => this.rotateSelected(15));
      $('#btn-rot-fine-l').addEventListener('click', () => this.rotateSelected(-1));
      $('#btn-rot-fine-r').addEventListener('click', () => this.rotateSelected(1));
      $('#btn-remove').addEventListener('click', () => this.removeSelected());
      $('#btn-fullscreen').addEventListener('click', () => { const el = document.documentElement; if (!document.fullscreenElement) el.requestFullscreen && el.requestFullscreen(); else document.exitFullscreen(); });
      // 모달
      $$('[data-close]').forEach(b => b.addEventListener('click', () => { S.click(); this.closeModal(); }));
      $('#btn-next').addEventListener('click', (e) => { S.click(); this.closeModal(); if (e.currentTarget.dataset.mode === 'cert') this.openCertificate(); else this.nextLevel(); });
      $('#btn-win-map').addEventListener('click', () => { S.click(); this.closeModal(); this.leaveLevel(); });
      $('#btn-win-retry').addEventListener('click', () => { S.click(); this.closeModal(); this.startLevel(this.state.level.src); });
      // 캔버스 입력
      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => this.onDown(e));
      window.addEventListener('pointermove', (e) => this.onMove(e));
      window.addEventListener('pointerup', (e) => this.onUp(e));
      window.addEventListener('keydown', (e) => this.onKey(e));
      // 인벤토리 드래그
      $('#inventory').addEventListener('pointerdown', (e) => this.onInventoryDown(e));
    }

    // ---------- 타이틀 ----------
    renderTitle() {
      const total = L.LEVELS.length; const done = Object.keys(this.progress.stars).filter(id => id !== 'lab').length;
      $('#title-progress').textContent = done ? `진행: ${done}/${total} 스테이지 클리어 · ⭐ ${Object.values(this.progress.stars).reduce((a, b) => a + b, 0)}` : '';
      const open = this.progress.quiz || this.progress.teacher;
      $('#btn-start').textContent = (open ? '' : '🔒 ') + (done ? '이어서 모험하기 ▶' : '모험 시작 ▶');
      $('#btn-quiz').textContent = this.progress.quiz ? '✅ 입장 퀴즈 통과' : '📝 입장 퀴즈';
      const allClear = L.LEVELS.every(l => this.progress.stars[l.id]);
      let cb = $('#btn-cert-title');
      if (allClear && !cb) {
        cb = document.createElement('button'); cb.id = 'btn-cert-title'; cb.className = 'btn'; cb.textContent = '🏅 수료증';
        cb.addEventListener('click', () => { S.init(); this.openCertificate(); });
        $('.title-buttons .row').appendChild(cb);
      }
    }

    // ---------- 월드맵 ----------
    renderMap() {
      const wrap = $('#worlds'); wrap.innerHTML = '';
      let totalStars = 0;
      for (const w of L.WORLDS) {
        const levels = L.LEVELS.filter(l => l.world === w.id);
        const card = document.createElement('div'); card.className = 'world-card'; card.style.setProperty('--wc', w.color);
        card.style.backgroundImage = `url(${w.bg})`;
        const stageHtml = levels.map((l, i) => {
          const stars = this.progress.stars[l.id] || 0; totalStars += stars;
          const unlocked = this.isUnlocked(l);
          return `<button class="stage ${unlocked ? '' : 'locked'} ${stars ? 'done' : ''}" data-id="${l.id}" ${unlocked ? '' : 'disabled'}>
            <span class="num">${l.id}</span><span class="name">${l.title}</span>
            <span class="stars">${stars ? '⭐'.repeat(stars) : (unlocked ? '' : '🔒')}</span></button>`;
        }).join('');
        card.innerHTML = `<div class="world-head"><span class="w-icon">${w.icon}</span><div><h3>WORLD ${w.id} · ${w.name}</h3><p>${w.sub}</p></div></div><div class="stages">${stageHtml}</div>`;
        wrap.appendChild(card);
      }
      $('#map-stars').textContent = `⭐ ${totalStars} / ${L.LEVELS.length * 3}`;
      $$('.stage', wrap).forEach(b => b.addEventListener('click', () => { S.click(); const lv = L.LEVELS.find(l => l.id === b.dataset.id); this.startLevel(lv); }));
    }
    isUnlocked(level) {
      const idx = L.LEVELS.indexOf(level); if (idx === 0) return true;
      if (this.progress.teacher) return true;
      return !!this.progress.stars[L.LEVELS[idx - 1].id];
    }

    // ---------- 레벨 시작 ----------
    startLevel(src) {
      const level = JSON.parse(JSON.stringify(src)); level.src = src;
      level.objects.forEach((o, i) => { o.id = o.id || ('o' + i); });
      level.bgKey = 'world' + (level.world === 5 ? 1 : level.world || 1);
      if (level.lab) level.bgKey = 'world2';
      // 인벤토리 수량
      level.inv = (level.inventory || []).map(i => ({ ...i, left: i.count }));
      this.state.level = level; this.state.selected = null; this.state.ghost = null; this.winLock = false; this.stableSince = 0;
      this.state.evalr = null; this.silent = true;
      this.showScreen('game');
      const w = L.WORLDS.find(w => w.id === level.world);
      $('#hud-title').textContent = level.lab ? '🧪 가상 실험실' : `${level.id} ${level.title}`;
      $('#hud-world').textContent = w ? `WORLD ${w.id} · ${w.name}` : '모의실험';
      $('#hud-goal').textContent = level.goal;
      document.body.classList.toggle('lab', !!level.lab);
      this.renderInventory();
      this.updateSelectionUI();
      this.retrace();
      this.silent = false;
      this.toast(level.lab ? '🧪 부품을 끌어다 놓고 자유롭게 실험해요' : `🎯 ${level.goal}`, 4500);
      const intro = level.lab ? '여기는 <b>가상 실험실</b>! 광원·거울·물·렌즈를 마음껏 놓아 보고 빛이 어떻게 나아가는지 관찰해 봐.'
        : (STAGE_TALK[level.id] || level.goal);
      this.say(intro);
    }
    say(html, cls = '') {
      const b = $('#guide-text'); if (!b) return;
      b.className = 'bubble' + (cls ? ' ' + cls : ''); b.innerHTML = html;
      b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    }
    leaveLevel() { this.renderMap(); this.showScreen(this.state.level && this.state.level.lab ? 'title' : 'map'); if (this.state.level && this.state.level.lab) this.renderTitle(); }
    nextLevel() {
      const idx = L.LEVELS.indexOf(this.state.level.src);
      if (idx >= 0 && idx < L.LEVELS.length - 1) this.startLevel(L.LEVELS[idx + 1]); else this.leaveLevel();
    }

    renderInventory() {
      const inv = $('#inventory'); inv.innerHTML = '';
      const level = this.state.level;
      if (!level.inv.length) { inv.innerHTML = `<div class="inv-empty">${level.sourceRotatable ? '🔦 광원의 노란 손잡이를 끌어 돌려 보세요' : '이 스테이지는 부품이 없어요'}</div>`; return; }
      for (const item of level.inv) {
        const info = PIECE_INFO[pieceKey(item)];
        const el = document.createElement('div'); el.className = 'inv-item' + (item.left <= 0 ? ' empty' : ''); el.dataset.key = pieceKey(item);
        el.innerHTML = `<span class="ic">${info.icon}</span><span class="nm">${info.name}</span><span class="ct">${item.count >= 99 ? '∞' : `${item.left}/${item.count}`}</span><span class="ds">${info.desc}</span>`;
        inv.appendChild(el);
      }
    }

    // ---------- 추적/판정 ----------
    retrace() {
      const level = this.state.level;
      const tr = E.trace(level.objects);
      const prevLit = this.state.evalr ? this.state.evalr.litCount : 0;
      const prevHaz = this.state.evalr ? this.state.evalr.hazardsHit : false;
      this.state.trace = tr; this.state.evalr = E.evaluate(level, tr);
      const ev = this.state.evalr;
      if (!this.silent) {
        if (ev.litCount > prevLit) {
          S.lit(); ev.targetState.filter(t => t.lit).forEach(t => this.R.burst(t.obj.x, t.obj.y, '#ffd36b', 14));
          if (!ev.win) this.say(CHEERS[Math.floor(Math.random() * CHEERS.length)], 'good');
        }
        if (ev.hazardsHit && !prevHaz) { S.bat(); this.toast('😱 박쥐가 깼어요! 빛이 박쥐에 닿지 않게 하세요', 2500); this.say('으악, 박쥐가 깼어! 빛이 <b>직진</b>하는 길을 거울로 바꿔서 박쥐를 피해 가자.', 'warn'); }
      }
      $('#hud-status').innerHTML = level.lab ? '' : this.statusHtml(ev);
      if (!level.lab) {
        if (ev.win && !this.winLock && !this.drag) { this.stableSince = this.stableSince || performance.now(); }
        else this.stableSince = 0;
      }
    }
    statusHtml(ev) {
      const parts = [];
      if (ev.targetState.length) parts.push(`💎 ${ev.targetState.filter(t => t.lit).length}/${ev.targetState.length}`);
      if (ev.zoneState.length) parts.push(`🎯 ${ev.zoneState.filter(z => z.ok).length}/${ev.zoneState.length}`);
      if (ev.hazardsHit) parts.push('<span class="warn">🦇 깨움!</span>');
      return parts.join(' · ');
    }
    checkWin() {
      if (this.winLock || !this.stableSince || this.state.level.lab) return;
      if (performance.now() - this.stableSince > 650 && this.state.evalr.win) { this.winLock = true; this.onWin(); }
    }
    onWin() {
      const level = this.state.level; S.win();
      const used = level.objects.filter(o => !o.fixed && o.type !== 'target' && o.type !== 'hazard' && o.type !== 'object' && o.type !== 'screen' && o.type !== 'source').length;
      const par = level.par || 0;
      const stars = used <= par ? 3 : (used <= par + 1 ? 2 : 1);
      const prev = this.progress.stars[level.id] || 0;
      this.progress.stars[level.id] = Math.max(prev, stars);
      if (level.concept && !this.progress.concepts.includes(level.concept)) this.progress.concepts.push(level.concept);
      this.saveProgress();
      for (let i = 0; i < 6; i++) setTimeout(() => this.R.burst(Math.random() * BOARD_W, Math.random() * BOARD_H * 0.6, ['#ffd36b', '#ff7bd5', '#7fd1ff', '#5ee6c1'][i % 4], 24), i * 120);
      const c = L.CONCEPTS[level.concept];
      $('#win-stars').innerHTML = [0, 1, 2].map(i => `<img src="assets/sprites/star.png" class="${i < stars ? 'on' : 'off'}" style="animation-delay:${0.15 + i * 0.18}s" alt="">`).join('');
      $('#win-title').textContent = `${level.id} ${level.title} 클리어!`;
      $('#win-sub').textContent = used <= par ? '최소 부품으로 해결했어요! 완벽!' : `부품 ${used}개 사용 (최소 ${par}개면 별 3개)`;
      $('#win-concept').innerHTML = c ? `<div class="concept-card"><div class="cc-head"><span class="cc-icon">${c.icon}</span><div><div class="cc-std">${c.std} · 개념 카드 획득!</div><h3>${c.title}</h3></div></div><p>${c.body}</p><p class="cc-tip">💬 ${c.tip}</p></div>` : '';
      const idx = L.LEVELS.indexOf(level.src);
      const allClear = L.LEVELS.every(l => this.progress.stars[l.id]);
      const nextBtn = $('#btn-next');
      if (idx < L.LEVELS.length - 1) { nextBtn.style.display = ''; nextBtn.textContent = '다음 스테이지 ▶'; nextBtn.dataset.mode = 'next'; }
      else if (allClear) { nextBtn.style.display = ''; nextBtn.textContent = '🏅 수료증 받기'; nextBtn.dataset.mode = 'cert'; }
      else { nextBtn.style.display = 'none'; }
      this.say(stars === 3 ? '완벽해! 최소 부품으로 해냈어! 🌟 개념 카드도 챙겨 가자.' : '클리어! 부품을 더 적게 쓰면 별 3개도 받을 수 있어.', 'good');
      setTimeout(() => this.openModal('win'), 700);
    }
    openCertificate() {
      const total = L.LEVELS.reduce((s, l) => s + (this.progress.stars[l.id] || 0), 0);
      $('#cert-stars').textContent = `⭐ ${total} / ${L.LEVELS.length * 3}`;
      const d = new Date(); $('#cert-date').textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
      try { $('#cert-name').value = localStorage.getItem('lightmaze.name') || ''; } catch (e) { }
      $('#cert-name').oninput = (e) => { try { localStorage.setItem('lightmaze.name', e.target.value); } catch (er) { } };
      S.win(); this.openModal('cert');
    }

    // ---------- 개념 도감 ----------
    openConcepts() {
      const wrap = $('#concept-list'); wrap.innerHTML = '';
      for (const [key, c] of Object.entries(L.CONCEPTS)) {
        const got = this.progress.concepts.includes(key) || this.progress.teacher;
        const el = document.createElement('div'); el.className = 'concept-card' + (got ? '' : ' locked');
        el.innerHTML = got ? `<div class="cc-head"><span class="cc-icon">${c.icon}</span><div><div class="cc-std">${c.std}</div><h3>${c.title}</h3></div></div><p>${c.body}</p><p class="cc-tip">💬 ${c.tip}</p>`
          : `<div class="cc-head"><span class="cc-icon">🔒</span><div><div class="cc-std">${c.std}</div><h3>???</h3></div></div><p>스테이지를 클리어하면 열려요.</p>`;
        wrap.appendChild(el);
      }
      this.openModal('concepts');
    }

    openModal(name) { $('#modal').classList.add('open'); $$('#modal .panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name)); }
    closeModal() { $('#modal').classList.remove('open'); }
    toast(msg, ms = 2500) { const t = $('#toast'); t.innerHTML = msg; t.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), ms); }

    // ---------- 입력 ----------
    hitTest(p) {
      const objs = this.state.level.objects;
      // 회전 손잡이 (선택 객체 또는 광원)
      const sel = this.state.selected;
      const handleOf = (o, R) => { const a = (o.angle || 0) * Math.PI / 180; return { x: o.x + Math.cos(a) * R, y: o.y + Math.sin(a) * R }; };
      if (sel && (sel.type === 'mirror' || sel.type === 'lens' || sel.type === 'source')) {
        const h = handleOf(sel, 50); if (Math.hypot(p.x - h.x, p.y - h.y) < 16) return { kind: 'rotate', obj: sel };
      }
      for (const o of objs) if (o.type === 'source' && this.state.level.sourceRotatable) { const h = handleOf(o, 44); if (Math.hypot(p.x - h.x, p.y - h.y) < 16) return { kind: 'rotate', obj: o }; }
      // 객체 본체 (뒤에서부터 = 위에 그려진 것 우선)
      for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i];
        if (o.type === 'wall' || o.type === 'screen' || o.type === 'hazard' || o.type === 'object') continue;
        if (o.type === 'water' || o.type === 'glass' || o.type === 'blocker') { const r = E.objRect(o); if (p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1) return { kind: 'move', obj: o }; continue; }
        if (Math.hypot(p.x - o.x, p.y - o.y) < 32) return { kind: 'move', obj: o };
      }
      return null;
    }
    onDown(e) {
      if (this.screen !== 'game') return;
      S.init();
      const p = this.R.toBoard(e.clientX, e.clientY);
      const hit = this.hitTest(p);
      if (!hit) { this.state.selected = null; this.updateSelectionUI(); return; }
      e.preventDefault();
      if (hit.kind === 'rotate') { this.drag = { kind: 'rotate', obj: hit.obj, startAngle: hit.obj.angle || 0 }; this.state.selected = hit.obj; this.updateSelectionUI(); return; }
      const o = hit.obj;
      const movable = !o.fixed || (o.type === 'source' && this.state.level.sourceMovable);
      this.state.selected = o; this.updateSelectionUI();
      if (movable) { this.drag = { kind: 'move', obj: o, ox: o.x, oy: o.y, dx: p.x - o.x, dy: p.y - o.y, moved: false }; S.pickup(); }
      else if (o.type === 'source' && this.state.level.sourceRotatable) { this.drag = { kind: 'rotate', obj: o, startAngle: o.angle }; }
    }
    onInventoryDown(e) {
      const item = e.target.closest('.inv-item'); if (!item || item.classList.contains('empty')) return;
      const inv = this.state.level.inv.find(i => pieceKey(i) === item.dataset.key); if (!inv || inv.left <= 0) return;
      e.preventDefault(); S.init(); S.pickup();
      const o = this.makePiece(inv);
      const p = this.R.toBoard(e.clientX, e.clientY); o.x = p.x; o.y = p.y;
      this.state.ghost = o; this.drag = { kind: 'new', obj: o, inv };
    }
    makePiece(inv) {
      const o = { type: inv.type, x: 0, y: 0, angle: 0, fixed: false };
      if (inv.type === 'lens') { o.kind = inv.kind; o.f = inv.f; o.len = 1.6; o.angle = 90; }
      if (inv.type === 'mirror') { o.len = 1; o.angle = 45; }
      if (inv.type === 'blocker' || inv.type === 'wall') { o.w = 1; o.h = 1; }
      if (inv.type === 'water' || inv.type === 'glass') { o.w = inv.w || 2; o.h = inv.h || 2; o.n = inv.type === 'water' ? 1.33 : 1.5; }
      if (inv.type === 'target') { o.r = 18; }
      if (inv.type === 'source') { o.color = '#7fd1ff'; o.angle = 0; }
      return o;
    }
    onMove(e) {
      if (!this.drag) return;
      const p = this.R.toBoard(e.clientX, e.clientY);
      const d = this.drag;
      if (d.kind === 'rotate') {
        const o = d.obj; let a = Math.atan2(p.y - o.y, p.x - o.x) * 180 / Math.PI;
        const step = (o.type === 'source') ? (e.shiftKey ? 5 : 1) : 15;
        a = Math.round(a / step) * step;
        if (a !== o.angle) { o.angle = a; if (step === 15) S.rotate(); this.retrace(); }
      } else {
        d.obj.x = p.x - (d.dx || 0); d.obj.y = p.y - (d.dy || 0); d.moved = true;
        if (d.kind === 'move') this.retrace();
      }
    }
    onUp(e) {
      if (!this.drag) return;
      const d = this.drag; this.drag = null;
      if (d.kind === 'rotate') { this.retrace(); return; }
      const o = d.obj;
      const snapped = this.snap(o, d.kind === 'new' ? null : o);
      if (d.kind === 'new') {
        this.state.ghost = null;
        if (snapped) { o.x = snapped.x; o.y = snapped.y; o.id = 'p' + Date.now(); this.state.level.objects.push(o); d.inv.left--; this.renderInventory(); this.state.selected = o; S.place(); }
        else { S.bad(); }
      } else {
        if (snapped && d.moved) { o.x = snapped.x; o.y = snapped.y; S.place(); }
        else if (d.moved) { o.x = d.ox; o.y = d.oy; S.bad(); }
      }
      this.updateSelectionUI(); this.retrace();
    }
    snap(o, self) {
      // 보드 밖이면 null (인벤토리로 되돌림)
      if (o.x < 0 || o.y < 0 || o.x > BOARD_W || o.y > BOARD_H) return null;
      const w = o.w || 1, h = o.h || 1;
      let cx = Math.round(o.x / CELL - 0.5 - (w - 1) / 2) + (w - 1) / 2, cy = Math.round(o.y / CELL - 0.5 - (h - 1) / 2) + (h - 1) / 2;
      cx = Math.max((w - 1) / 2, Math.min(16 - 1 - (w - 1) / 2, cx)); cy = Math.max((h - 1) / 2, Math.min(10 - 1 - (h - 1) / 2, cy));
      const pos = { x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL };
      // 겹침 검사
      const r0 = E.objRect({ ...o, x: pos.x, y: pos.y });
      for (const other of this.state.level.objects) {
        if (other === self || other === o) continue;
        const r1 = other.type === 'mirror' || other.type === 'lens' || other.type === 'target' || other.type === 'source' || other.type === 'hazard' || other.type === 'object'
          ? { x0: other.x - CELL / 2 + 1, y0: other.y - CELL / 2 + 1, x1: other.x + CELL / 2 - 1, y1: other.y + CELL / 2 - 1 } : E.objRect(other);
        if (r0.x0 < r1.x1 - 1 && r0.x1 > r1.x0 + 1 && r0.y0 < r1.y1 - 1 && r0.y1 > r1.y0 + 1) return null;
      }
      return pos;
    }
    rotateSelected(deg) {
      const o = this.state.selected; if (!o) return;
      if (!(o.type === 'mirror' || o.type === 'lens' || (o.type === 'source' && this.state.level.sourceRotatable))) return;
      o.angle = ((o.angle || 0) + deg) % 360; S.rotate(); this.retrace(); this.updateSelectionUI();
    }
    removeSelected() {
      const o = this.state.selected; if (!o || o.fixed) return;
      const level = this.state.level; const idx = level.objects.indexOf(o); if (idx < 0) return;
      level.objects.splice(idx, 1);
      const inv = level.inv.find(i => i.type === o.type && (o.type !== 'lens' || i.kind === o.kind)); if (inv) inv.left++;
      this.state.selected = null; this.renderInventory(); this.updateSelectionUI(); this.retrace(); S.pickup();
    }
    onKey(e) {
      if (this.screen !== 'game') return;
      const sel = this.state.selected;
      if (e.key === 'q' || e.key === 'Q') this.rotateSelected(-15);
      if (e.key === 'e' || e.key === 'E') this.rotateSelected(15);
      if (e.key === 'ArrowLeft') { this.rotateSelected(-1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { this.rotateSelected(1); e.preventDefault(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { this.removeSelected(); }
      if (e.key === 'Escape') { this.state.selected = null; this.updateSelectionUI(); }
      if (e.key === 'r' || e.key === 'R') { this.startLevel(this.state.level.src); }
    }
    updateSelectionUI() {
      const o = this.state.selected; const bar = $('#sel-bar');
      if (!o) { bar.classList.remove('show'); return; }
      const rotatable = o.type === 'mirror' || o.type === 'lens' || (o.type === 'source' && this.state.level.sourceRotatable);
      const info = PIECE_INFO[o.type === 'lens' ? `lens_${o.kind}` : o.type] || { name: o.type, icon: '•' };
      $('#sel-name').textContent = `${info.icon} ${info.name}` + (rotatable ? ` · ${Math.round((((o.angle || 0) % 360) + 360) % 360)}°` : '');
      $$('.rot', bar).forEach(b => b.style.display = rotatable ? '' : 'none');
      $$('.fine', bar).forEach(b => b.style.display = (o.type === 'source' && rotatable) ? '' : 'none');
      $('#btn-remove').style.display = o.fixed ? 'none' : '';
      bar.classList.add('show');
    }

    // ---------- 루프 ----------
    loop(t) {
      const dt = Math.min(0.05, (t - this.lastTime) / 1000 || 0); this.lastTime = t;
      if (this.screen === 'game' && this.state.level) {
        if (!this.R.scale) this.R.resize();
        this.R.draw(this.state, dt);
        this.checkWin();
        const sel = this.state.selected; if (sel && sel.type === 'source' && this.drag && this.drag.kind === 'rotate') $('#sel-name').textContent = `🔦 광원 · ${Math.round((((sel.angle || 0) % 360) + 360) % 360)}°`;
      }
      requestAnimationFrame((t2) => this.loop(t2));
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const game = new Game(); global.game = game;
    // 선생님 코드 / 퀴즈 통과 처리
    const q = new URLSearchParams(location.search);
    if (q.get('pass') === '1') { game.progress.quiz = true; game.saveProgress(); }
    if (q.get('teacher') === '1') { game.progress.teacher = true; game.saveProgress(); }
    // 선생님 코드: prompt() 대신 화면 안의 입력 창 (어느 브라우저·앱에서나 동작)
    game.askTeacher = () => {
      $('#teacher-msg').textContent = ''; $('#teacher-code').value = '';
      game.openModal('teacher'); setTimeout(() => $('#teacher-code').focus(), 50);
    };
    $('#teacher-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const code = $('#teacher-code').value.trim();
      if (code === '2022') { game.progress.teacher = true; game.saveProgress(); game.closeModal(); game.toast('🔓 선생님 모드: 모든 스테이지가 열렸어요', 3000); game.renderTitle(); }
      else { $('#teacher-msg').textContent = '코드가 달라요. 다시 확인해 주세요.'; $('#teacher-code').select(); }
    });
    $('#btn-teacher').addEventListener('click', () => game.askTeacher());
    if (q.get('pass') === '1' || q.get('teacher') === '1') game.renderTitle();
  });
})(window);
