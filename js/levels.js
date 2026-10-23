/* ============================================================
   빛의 미로 — 스테이지 데이터 (levels.js)
   2022 개정 과학 5-1-2 「빛의 성질」 [6과02-01] [6과02-02] [6과02-03]
   좌표: 셀 (0~15, 0~9), 셀 크기 60px. C(cx,cy) → 셀 중심 px
   ============================================================ */
(function (global) {
  'use strict';
  const CELL = 60;
  const C = (cx, cy) => ({ x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL });

  // 공용 객체 생성기
  const wall = (cx, cy, w = 1, h = 1) => ({ type: 'wall', ...C(cx + (w - 1) / 2, cy + (h - 1) / 2), w, h, fixed: true });
  const src = (cx, cy, angle, extra = {}) => ({ type: 'source', ...C(cx, cy), angle, fixed: true, color: '#ff3b5c', ...extra });
  const target = (cx, cy, extra = {}) => ({ type: 'target', ...C(cx, cy), r: 18, ...extra });
  const bat = (cx, cy) => ({ type: 'hazard', ...C(cx, cy), r: 22, label: '박쥐' });
  const water = (cx, cy, w, h) => ({ type: 'water', ...C(cx + (w - 1) / 2, cy + (h - 1) / 2), w, h, n: 1.33, fixed: true });
  const glass = (cx, cy, w, h) => ({ type: 'glass', ...C(cx + (w - 1) / 2, cy + (h - 1) / 2), w, h, n: 1.5, fixed: true });
  const mirror = (cx, cy, angle, fixed = false) => ({ type: 'mirror', ...C(cx, cy), angle, len: 1, fixed });
  const lens = (cx, cy, kind, f, angle = 90) => ({ type: 'lens', ...C(cx, cy), kind, f, angle, len: 1.6 });

  const WORLDS = [
    { id: 1, name: '직진의 동굴', sub: '빛은 어떻게 나아갈까?', color: '#ffb347', bg: 'assets/world1.jpg', icon: '🔦' },
    { id: 2, name: '거울의 숲', sub: '빛이 거울에 부딪치면?', color: '#7fd1ff', bg: 'assets/world2.jpg', icon: '🪞' },
    { id: 3, name: '굴절의 호수', sub: '공기와 물의 경계에서는?', color: '#5ee6c1', bg: 'assets/world3.jpg', icon: '💧' },
    { id: 4, name: '렌즈의 탑', sub: '볼록 렌즈와 오목 렌즈', color: '#c79bff', bg: 'assets/world4.jpg', icon: '🔍' },
    { id: 5, name: '빛의 미로', sub: '모든 성질을 한번에!', color: '#ff7bd5', bg: 'assets/world1.jpg', icon: '💎' },
  ];

  // 개념 카드 (지도서 내용 기반)
  const CONCEPTS = {
    'light-needed': {
      title: '물체를 보려면 빛이 있어야 해요',
      icon: '💡',
      body: '어둠상자 속 물체는 손전등을 켜야 보여요. 태양이나 전등처럼 스스로 빛을 내는 물체를 <b>광원</b>이라고 해요. 광원에서 나온 빛이 물체에 반사되어 우리 눈에 들어오면 물체가 보여요.',
      tip: '눈에서 빛이 나가서 물체가 보이는 게 아니에요! 손전등을 끄면 아무것도 안 보이죠?',
      std: '[6과02-01]',
    },
    'straight': {
      title: '빛의 직진',
      icon: '➡️',
      body: '빛은 <b>곧게 나아가요</b>. 이것을 빛의 <b>직진</b>이라고 해요. 레이저 지시기 빛이 곧게 뻗어 나가는 것을 보면 알 수 있어요.',
      tip: '생활 속 예: 나뭇잎 사이로 곧게 내려오는 햇빛, 손전등 빛, 자동차 전조등',
      std: '[6과02-02]',
    },
    'shadow': {
      title: '그림자는 왜 생길까요?',
      icon: '🌑',
      body: '빛이 직진하다가 <b>불투명한 물체</b>에 막히면 물체 뒤쪽에 빛이 닿지 못해 <b>그림자</b>가 생겨요. 그림자의 모양이 물체와 비슷한 까닭도 빛이 직진하기 때문이에요.',
      tip: '물체를 광원에 가까이 하면 그림자가 커지고, 멀리 하면 작아져요.',
      std: '[6과02-02]',
    },
    'reflect': {
      title: '빛의 반사',
      icon: '🪞',
      body: '빛이 물체(거울)에 부딪쳐 <b>나아가는 방향이 바뀌는 성질</b>을 빛의 <b>반사</b>라고 해요. 거울을 돌려 기울기를 바꾸면 빛이 나아가는 방향도 바뀌어요.',
      tip: '[심화] 거울 면에 수직인 선을 기준으로 들어온 각(입사각)과 나간 각(반사각)은 같아요. 중학교에서 더 자세히 배워요. (돋보기 모드로 확인!)',
      std: '[6과02-02]',
    },
    'periscope': {
      title: '거울 두 개면 잠망경!',
      icon: '🔭',
      body: '거울 두 개를 나란히 45°로 기울여 놓으면 빛이 두 번 반사되어 <b>벽 너머</b>를 볼 수 있어요. 잠수함의 <b>잠망경</b>이 바로 이 원리예요.',
      tip: '생활 속 거울: 자동차 뒷거울, 치과 반사경, 옷 가게 거울, 만화경, 잠망경',
      std: '[6과02-03]',
    },
    'refract': {
      title: '빛의 굴절',
      icon: '💧',
      body: '빛이 공기에서 물로 <b>비스듬히</b> 들어갈 때, 서로 다른 물질의 <b>경계에서 나아가는 방향이 꺾여요</b>. 이것을 빛의 <b>굴절</b>이라고 해요.',
      tip: '물속에 있는 물체가 실제보다 떠 보이거나 꺾여 보이는 것도 굴절 때문이에요.',
      std: '[6과02-02]',
    },
    'refract-normal': {
      title: '수직으로 들어가면 꺾이지 않아요',
      icon: '⬇️',
      body: '빛이 공기와 물의 경계에 <b>수직으로</b> 들어가면 꺾이지 않고 그대로 직진해요. <b>비스듬히</b> 들어갈 때만 방향이 꺾여요.',
      tip: '물에서 공기로 나올 때도 경계에서 방향이 꺾여요. 유리(렌즈)에서도 마찬가지!',
      std: '[6과02-02]',
    },
    'convex': {
      title: '볼록 렌즈는 빛을 모아요',
      icon: '🔍',
      body: '가운데가 두꺼운 <b>볼록 렌즈</b>를 통과한 빛은 굴절되어 <b>한 점으로 모여요</b>. 그래서 볼록 렌즈로 보면 물체가 실제보다 크게 보여요.',
      tip: '생활 속 볼록 렌즈: 돋보기, 현미경, 망원경, 사진기, 간이 프로젝터',
      std: '[6과02-03]',
    },
    'concave': {
      title: '오목 렌즈는 빛을 퍼뜨려요',
      icon: '👓',
      body: '가운데가 얇은 <b>오목 렌즈</b>를 통과한 빛은 굴절되어 <b>바깥으로 퍼져요</b>. 오목 렌즈로 보면 물체가 실제보다 작게, 더 넓은 범위가 보여요.',
      tip: '생활 속 오목 렌즈: 근시 안경, 문에 달린 외시경, 더 넓은 범위를 봐야 할 때',
      std: '[6과02-03]',
    },
    'uses': {
      title: '거울과 렌즈의 쓰임새',
      icon: '🏆',
      body: '<b>거울</b>은 빛의 <b>반사</b>를 이용해 내 모습이나 보이지 않는 곳을 볼 때 써요. <b>렌즈</b>는 빛의 <b>굴절</b>을 이용해 작은 것을 크게(볼록), 넓은 범위를(오목) 볼 때 써요.',
      tip: '빛의 성질(직진·반사·굴절)을 모두 이용해 미로를 탈출했어요! 거울이나 렌즈로 나만의 장치를 설계해 볼까요?',
      std: '[6과02-03]',
    },
  };

  const LEVELS = [
    // ───────────── World 1: 직진의 동굴 ─────────────
    {
      id: '1-1', world: 1, title: '어둠상자', concept: 'light-needed', par: 0,
      goal: '어두운 동굴 속 보물상자를 손전등으로 비춰 보세요. (손전등 손잡이를 돌려요)',
      hint: '빛이 닿지 않으면 아무것도 보이지 않아요. 손전등의 각도를 돌려 기둥 사이로 빛을 보내 보세요.',
      dark: true, sourceRotatable: true,
      objects: [
        src(2, 5, -38, { mode: 'flashlight', spread: 28, rays: 61 }),
        wall(7, 2, 1, 2), wall(7, 7, 1, 2),
        { type: 'object', ...C(12, 5), r: 26, need: 6, label: '보물상자' },
      ],
      inventory: [],
      solution: { sourceAngle: 0 },
    },
    {
      id: '1-2', world: 1, title: '곧게 나아가는 빛', concept: 'straight', par: 0,
      goal: '레이저 발사기를 돌려 크리스탈을 밝히세요. 빛은 곧게만 나아가요!',
      hint: '발사기와 크리스탈을 잇는 직선을 상상해 보세요. 기둥에 막히지 않는 각도를 찾아요.',
      sourceRotatable: true,
      objects: [
        src(1, 8, 10),
        wall(6, 3), wall(6, 7), wall(9, 2), wall(9, 6), wall(11, 1), wall(11, 5), wall(13, 4),
        target(14, 1),
      ],
      inventory: [],
      solution: { sourceAngle: -28.3 },
    },
    {
      id: '1-3', world: 1, title: '그림자 놀이', concept: 'shadow', par: 2,
      goal: '바위를 옮겨 스크린의 박쥐 둥지(검은 구역)를 그림자로 가리고, 가운데 등불 구역은 밝게 두세요.',
      hint: '그림자는 빛이 직진하기 때문에 물체 뒤에 생겨요. 바위를 손전등에 가까이 두면 그림자가 커져요.',
      objects: [
        src(1, 5, 0, { mode: 'flashlight', spread: 52, rays: 91 }),
        { type: 'screen', x: 855, y: 300, w: 0.5, h: 8, fixed: true,
          zones: [ { u0: 0.08, u1: 0.30, want: 'dark', label: '박쥐 둥지' }, { u0: 0.42, u1: 0.58, want: 'lit', label: '등불' }, { u0: 0.70, u1: 0.92, want: 'dark', label: '박쥐 둥지' } ] },
      ],
      inventory: [{ type: 'blocker', count: 2 }],
      solution: { place: 'auto-blocker' },
    },

    // ───────────── World 2: 거울의 숲 ─────────────
    {
      id: '2-1', world: 2, title: '첫 번째 거울', concept: 'reflect', par: 1,
      goal: '거울을 놓고 돌려서 빛을 꺾어 크리스탈을 밝히세요.',
      hint: '거울을 빛이 지나가는 길 위에 놓고, 회전 버튼(⟲ ⟳)으로 45° 기울여 보세요.',
      objects: [
        src(1, 8, 0),
        wall(4, 2, 1, 3), wall(9, 5, 2, 1), wall(12, 1, 1, 2),
        target(14, 1),
      ],
      inventory: [{ type: 'mirror', count: 1 }],
      solution: { place: [{ type: 'mirror', cx: 14, cy: 8, angle: -45 }] },
    },
    {
      id: '2-2', world: 2, title: '두 번 꺾기', concept: 'reflect', par: 2,
      goal: '거울 두 개로 빛을 두 번 반사시켜 크리스탈까지 보내세요.',
      hint: '빛이 들어온 각도와 나가는 각도는 같아요. 첫 거울로 아래로, 둘째 거울로 오른쪽으로!',
      objects: [
        src(1, 1, 0),
        wall(8, 0, 1, 4), wall(10, 4, 1, 3), wall(3, 5, 2, 1), wall(13, 2, 1, 3),
        target(14, 8),
      ],
      inventory: [{ type: 'mirror', count: 2 }],
      solution: { place: [{ type: 'mirror', cx: 6, cy: 1, angle: 45 }, { type: 'mirror', cx: 6, cy: 8, angle: 45 }] },
    },
    {
      id: '2-3', world: 2, title: '박쥐를 깨우지 마!', concept: 'reflect', par: 3,
      goal: '잠든 박쥐에게 빛이 닿으면 안 돼요. 크리스탈 두 개를 모두 밝히세요. (크리스탈은 빛을 통과시켜요)',
      hint: '박쥐 앞에서 빛을 위로 올려 보세요. 크리스탈을 통과한 빛은 계속 나아가요.',
      objects: [
        src(1, 5, 0),
        bat(8, 5),
        wall(10, 2), wall(12, 6), wall(3, 8), wall(9, 3),
        target(5, 1), target(14, 8),
      ],
      inventory: [{ type: 'mirror', count: 3 }],
      solution: { place: [{ type: 'mirror', cx: 5, cy: 5, angle: -45 }, { type: 'mirror', cx: 5, cy: 0, angle: 135 }, { type: 'mirror', cx: 14, cy: 0, angle: 45 }] },
    },
    {
      id: '2-4', world: 2, title: '잠망경 만들기', concept: 'periscope', par: 2,
      goal: '벽 너머의 크리스탈을 밝히세요. 거울 두 개를 나란히 기울이면 잠망경이 돼요!',
      hint: '벽의 틈으로 빛을 위로 올린 뒤, 위에서 다시 오른쪽으로 꺾어요. 두 거울은 서로 평행!',
      objects: [
        src(1, 8, 0),
        wall(0, 5, 12, 1), wall(13, 5, 3, 1), wall(14, 8), wall(3, 2, 1, 2),
        target(14, 2),
      ],
      inventory: [{ type: 'mirror', count: 2 }],
      solution: { place: [{ type: 'mirror', cx: 12, cy: 8, angle: -45 }, { type: 'mirror', cx: 12, cy: 2, angle: 135 }] },
    },

    // ───────────── World 3: 굴절의 호수 ─────────────
    {
      id: '3-1', world: 3, title: '물속으로', concept: 'refract', par: 0,
      goal: '발사기를 돌려 호수 속 크리스탈을 밝히세요. 물에 들어가면 빛이 꺾여요!',
      hint: '크리스탈을 똑바로 겨누면 빗나가요. 빛이 물에 들어가면서 꺾이는 걸 보고 각도를 조절해요.',
      sourceRotatable: true,
      objects: [
        src(2, 2, 50),
        water(8, 5, 6, 5),
        wall(6, 0, 1, 3), wall(12, 2),
        target(12, 8, { r: 22 }),
      ],
      inventory: [],
      solution: { sourceAngle: 'auto' },
    },
    {
      id: '3-2', world: 3, title: '수직으로 들어가면', concept: 'refract-normal', par: 1,
      goal: '거울로 빛을 꺾어 물을 지나 바닥의 크리스탈을 밝히세요.',
      hint: '물에 수직으로 들어간 빛은 꺾이지 않아요. 거울을 물 바로 위에 놓고 45°로!',
      objects: [
        src(1, 2, 0),
        water(6, 4, 4, 5),
        wall(11, 1, 1, 3), wall(3, 6, 1, 2),
        target(8, 9),
      ],
      inventory: [{ type: 'mirror', count: 1 }],
      solution: { place: [{ type: 'mirror', cx: 8, cy: 2, angle: 45 }] },
    },
    {
      id: '3-3', world: 3, title: '물 밖으로', concept: 'refract', par: 0,
      goal: '물속의 빛나는 물고기(광원)를 돌려 공중의 크리스탈을 밝히세요.',
      hint: '물 밖으로 나온 빛은 수면 쪽으로 더 눕듯이 꺾여요. 크리스탈을 똑바로 겨누지 말고 조금 더 가파르게(위쪽으로) 겨눠 보세요.',
      sourceRotatable: true,
      objects: [
        src(3, 8, -30, { color: '#5be39b', label: '빛물고기' }),
        water(0, 5, 8, 5),
        wall(10, 1, 1, 3), wall(5, 1, 1, 2), wall(12, 6, 1, 2),
        target(8, 3, { r: 22 }),
      ],
      inventory: [],
      solution: { sourceAngle: 'auto' },
    },
    {
      id: '3-4', world: 3, title: '유리 블록 미로', concept: 'refract', par: 2,
      goal: '유리 블록을 지난 빛이 어디로 가는지 잘 보고, 거울로 크리스탈까지 보내세요.',
      hint: '비스듬히 들어간 빛은 유리 안에서 꺾였다가 나올 때 다시 꺾여요. 나온 빛의 길 위에 거울을 놓아요.',
      objects: [
        src(3, 2, 15),
        glass(4, 0, 3, 5),
        wall(2, 0, 1, 2), wall(2, 3, 1, 2), wall(12, 4, 1, 2), wall(8, 7, 2, 1), wall(14, 6),
        target(11, 1),
      ],
      inventory: [{ type: 'mirror', count: 2 }],
      solution: { place: 'auto' },
    },

    // ───────────── World 4: 렌즈의 탑 ─────────────
    {
      id: '4-1', world: 4, title: '볼록 렌즈는 모아요', concept: 'convex', par: 1,
      goal: '세 줄기 빛을 한 점으로 모아 큰 크리스탈(3칸)을 가득 채우세요. 어떤 렌즈가 필요할까요?',
      hint: '가운데가 두꺼운 볼록 렌즈는 빛을 모아요. 렌즈와 크리스탈 사이 거리도 중요해요.',
      objects: [
        src(1, 5, 0, { beams: 3, gap: 40 }),
        wall(5, 1, 1, 2), wall(5, 8, 1, 2),
        target(12, 5, { need: 3, r: 20 }),
      ],
      inventory: [{ type: 'lens', kind: 'convex', f: 240, count: 1 }, { type: 'lens', kind: 'concave', f: 150, count: 1 }],
      solution: { place: [{ type: 'lens', kind: 'convex', cx: 8, cy: 5, angle: 90 }] },
    },
    {
      id: '4-2', world: 4, title: '오목 렌즈는 퍼뜨려요', concept: 'concave', par: 1,
      goal: '세 줄기 빛을 퍼뜨려 세 개의 크리스탈을 한꺼번에 밝히세요.',
      hint: '가운데가 얇은 오목 렌즈는 빛을 바깥으로 퍼뜨려요. 렌즈 위치에 따라 퍼지는 정도가 달라요.',
      objects: [
        src(1, 5, 0, { beams: 3, gap: 40 }),
        wall(4, 1, 1, 2), wall(4, 8, 1, 2),
        { type: 'target', x: 870, y: 178, r: 20 }, { type: 'target', x: 870, y: 330, r: 20 }, { type: 'target', x: 870, y: 482, r: 20 },
      ],
      inventory: [{ type: 'lens', kind: 'convex', f: 240, count: 1 }, { type: 'lens', kind: 'concave', f: 150, count: 1 }],
      solution: { place: [{ type: 'lens', kind: 'concave', cx: 7, cy: 5, angle: 90 }] },
    },
    {
      id: '4-3', world: 4, title: '좁은 틈을 지나서', concept: 'convex', par: 1,
      goal: '벽의 좁은 틈으로 세 줄기 빛을 모두 통과시켜 뒤의 크리스탈을 채우세요.',
      hint: '빛이 모이는 점(초점)이 틈과 딱 맞아야 해요. 볼록 렌즈의 위치를 조절해 보세요.',
      objects: [
        src(1, 3, 0, { beams: 3, gap: 40 }),
        wall(10, 0, 1, 3), wall(10, 4, 1, 6),
        target(11, 3, { need: 3, r: 20 }),
      ],
      inventory: [{ type: 'lens', kind: 'convex', f: 240, count: 1 }, { type: 'lens', kind: 'concave', f: 150, count: 1 }, { type: 'mirror', count: 1 }],
      solution: { place: [{ type: 'lens', kind: 'convex', cx: 6, cy: 3, angle: 90 }] },
    },

    // ───────────── World 5: 빛의 미로 (보스) ─────────────
    {
      id: '5-1', world: 5, title: '빛의 미로 탈출', concept: 'uses', par: 2,
      goal: '직진·반사·굴절을 모두 이용해 크리스탈 두 개를 밝히고 박쥐는 깨우지 마세요!',
      hint: '첫 거울로 위로 올려 물을 수직으로 통과시키고, 위에서 오른쪽으로 꺾어요.',
      objects: [
        src(1, 8, 0),
        bat(10, 8),
        water(5, 3, 3, 3),
        wall(9, 2, 1, 2), wall(3, 1, 1, 3), wall(12, 5, 1, 2), wall(8, 7),
        target(6, 2), target(14, 1),
      ],
      inventory: [{ type: 'mirror', count: 3 }, { type: 'lens', kind: 'convex', f: 240, count: 1 }],
      solution: { place: [{ type: 'mirror', cx: 6, cy: 8, angle: -45 }, { type: 'mirror', cx: 6, cy: 1, angle: 135 }] },
    },
  ];

  // 자유 실험실 (가상 모의실험)
  const LAB = {
    id: 'lab', world: 0, title: '가상 실험실', concept: null, par: 0, lab: true,
    goal: '광원·거울·물·렌즈를 자유롭게 놓고 빛이 어떻게 나아가는지 실험해 보세요.',
    hint: '돋보기 모드를 켜면 입사각·반사각·굴절각이 표시돼요.',
    sourceRotatable: true, sourceMovable: true,
    objects: [ src(1, 5, 0) ],
    inventory: [
      { type: 'mirror', count: 99 }, { type: 'wall', count: 99 }, { type: 'water', count: 99, w: 2, h: 2 }, { type: 'glass', count: 99, w: 2, h: 2 },
      { type: 'lens', kind: 'convex', f: 240, count: 99 }, { type: 'lens', kind: 'concave', f: 150, count: 99 }, { type: 'target', count: 99 }, { type: 'source', count: 99 },
    ],
  };

  global.LightLevels = { LEVELS, WORLDS, CONCEPTS, LAB, C };
})(window);
