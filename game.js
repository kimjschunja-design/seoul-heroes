/*
 * [절대 불변] 서울 히어로즈 핵심 물리 엔진 설계 원칙 (IMMUTABLE CORE RULE)
 * 어떤 수정·버그 수정에서도 이 원칙을 편의로 훼손하거나 결과 선결정 방식으로 되돌리지 않는다.
 *
 * 1. 결과 선결정 금지 · 실시간 물리 시간 대결 (T_fielder <= T_ball)
 *    - 인플레이 타구를 확률 주사위나 비거리 테이블로 먼저 확정하고 애니메이션만 맞추는 방식을 금지한다.
 *    - 타격 순간 타구 속도(최고 약 165km/h) · 발사각 · 방향(좌익선상~갭~정면~우익선상)으로
 *      착지 좌표와 공 도착 시간 T_ball 을 담장 110~115m 경기장 물리 공식으로 먼저 계산한다.
 *    - 담당 수비수의 반응(스타트 딜레이, 외야수는 거리·시야 보정으로 추가 지연) + 주력
 *      (90 = 100m/12초 ≈ 8.33m/s)으로 수비수 도착 시간 T_fielder 를 계산한다.
 *    - T_fielder <= T_ball 일 때만 포구(아웃)가 성립한다. 수비 스탯이 낮을 때만 도착 후 포구 실책(E).
 *      공보다 늦으면 뜬공 아웃이 될 수 없고, 그라운드에 떨어져 바운드 안타가 된다.
 *    - 뜬공 높이 z(r) = h0 + vy*t - 0.5*g*t^2 (t = T_ball * r / R). KBO 주전 평균 신장 182cm 기준
 *      서서 포구 2.15m, 점프 포구 2.65m. 그 위로 내야수 반경을 통과하면 내야수를 빼고 외야로 넘긴다.
 *    - 1루타/2루타/3루타와 주자 진루는 송구가 목표 베이스에 닿는 시간 vs 주자 도착 시간의 비교로만 판정한다.
 *    - 뜬공 높낮이 통과 판정은 [절대 불변 원칙 제4조].
 *
 * 2. 6대 타자 스탯 물리 연동
 *    - 순발(rct): 수비 스타트 단축, 도루 스타트 단축, 땅볼 1루 스타트 단축, 헛스윙 감소(프로 최고도 최소 헛스윙률 하한 유지).
 *    - 주력(spd): 90 기준 100m 12초(≈ 8.33m/s)로 수비 이동 시간과 주루 속도를 결정.
 *    - 발사각(launch): 기본 타구 각도. 높을수록 체공 증가·어퍼스윙 헛스윙 소폭 증가, 낮을수록 땅볼.
 *    - 정확(con): 낮을수록 70~80° 내야 뜬공·3~4° 느린 땅볼. 높을수록 정타 각도.
 *    - 파워(pow): 타구 속도(최고 약 165km/h) + 애매한 40~50°를 20~30°로, 3~4° 땅볼을 8~10°로 보정.
 *    - 수비(fld): 선도착 시 포구 성공(실책 방지)과 송구 정확도(악송구 방지).
 *
 * 3. 단일 물리 타임라인(playElapsed) 1:1 애니메이션 동기화 (IMMUTABLE)
 *    - 어떤 버그 수정·기능 추가에서도 화면 이동 속도(m/s)와 도착 시각(초)을
 *      고정 픽셀 이동이나 별도 연출 타이머로 분리하는 것을 절대 금지한다.
 *    - 타구·수비수·주자·송구는 타격 순간부터 흐르는 단일 물리 시계 playElapsed(초) 위에서
 *      판정 함수와 동일한 m/s·초 단위 딜레이로 좌표를 계산한다.
 *      화면의 베이스 도착과 아웃/세이프 판정 시각은 0.01초 오차도 없이 1:1로 일치해야 한다.
 *    - 타구는 playElapsed === T_ball 에 착지 좌표에 있다.
 *      수비수는 startDelay 까지 기다린 뒤 moveSpeed 로 달려 arriveTime 에 닿는다.
 *      주자는 땅볼 스타트 0.45-(rct-70)*0.0025초(능력치 70에서 0.45초)·기습번트 0.32초·낫아웃 0.25초·선행주자 리드 이후
 *      runMetersPerSec 로 움직여 batTime1B·leadTime·canBeatThrow 시각에 베이스에 선다.
 *      땅볼 1루는 그 정지 출발 평균 속도 그대로다. 홈에서 2루 이상으로 이어 뛸 때는 60ft(18.29m)에서
 *      최고속(spd 70 = 7.6m/s)에 오른 뒤, 1루를 통과한 구간은 베이스당 라운딩 2.0m를 그 속도로 달린다.
 *      도루는 리드 3.3m에서 순발 반응(rct 70 = 0.18초)과 정지 가속 손실 뒤에 그 최고속으로 뛴다.
 *      2아웃 전력 스타트, 0·1아웃 뜬공 하프웨이, 비포스 진루, 동적 리드(4.2~6.2m), 라운딩, 1루 오버런,
 *      추월 금지, 태그(+0.12초)·슬라이딩(−0.08초)도 이 시계의 m/s·초로만 계산한다.
 *      송구는 포구 후 0.32~0.42초 준비 뒤 armMetersPerSec 로 날아가
 *      throwTime / throwT / turnT 에 베이스에 닿는다.
 *      백핸드 역동작(+0.16초, 송구 -10%), 원바운드(비행 +10~14%), 투수 1루 커버 지연도 같은 시계에 더한다.
 *    - 접전을 본 뒤 0.3~0.4초 여운(좌표는 그대로 멈춘 채)을 두고 다음 상태로 넘긴다.
 *
 * [절대 불변 원칙 제4조] Z축 높낮이 물리 (KBO 평균 신장 182cm · 3D 포물선)
 *    - 타구 높이 z(t) = h0 + vy*t - 0.5*g*t^2 (h0 = 1m).
 *      반경 r 통과 시각 t = T_ball * r / R. 비거리와 별개의 포물선이며 결과 선결정이 아니다.
 *    - KBO 주전 평균 신장 182cm. 서서 포구 STAND_REACH_M = 2.15m, 점프 포구 JUMP_REACH_M = 2.65m.
 *    - 내야수 위치 반경을 공이 지날 때:
 *      z > 2.65m 이면 그 내야수는 닿지 못해 건너뛰고 외야로 넘긴다.
 *      2.15m < z <= 2.65m 이면 수비·순발 점프 포구. 도착 시각 <= 통과 시각일 때만 아웃.
 *      z <= 2.15m 이면 서서 포구. 도착 시각 <= 통과 시각일 때만 아웃.
 *    - 통과 시각보다 늦으면 뜬공 아웃이 될 수 없다. 시계는 playElapsed 하나다.
 *
 * [절대 불변 원칙 제5조] 전 베이스 실시간 물리 시간 대결 및 ±0.15초 접전
 *    - T_runner(base), T_defense(base)를 1루·2루·3루·홈에서 0.01초로 계산한다.
 *      Δt = T_defense - T_runner.
 *      Δt > +0.15 세이프 질주, Δt < -0.15 직전 베이스 정지.
 *      |Δt| <= 0.15 에서는 승부를 건다.
 *      0 <= Δt <= +0.15: fld가 높을수록 전환·태그 송구를 최대 0.12초 단축해 보살할 수 있다.
 *      -0.15 <= Δt < 0: rct 90+ 약 80%, rct 70 약 50%, rct 50 이하 약 20%로 정지한다.
 *      감지 실패는 질주하다 아웃이다. 포스는 정지할 수 없고 보너스만 같다.
 *    - 2루타·3루타·도루 성공률은 타구 각도 조건이나 숫자 목표로 보정하지 않는다.
 *    - 도루 스타트·투구·포구·송구는 이 판정과 같은 시계다.
 *
 * 6. 황금 밸런스(동 OVR 70): OPS 0.750 내외, 팀당 경기 득점 3.8~4.3. 투수 볼넷·삼진 공식은 유지한다.
 *    장타·도루·주루사 빈도는 제5조가 우선이며 숫자 목표로 되돌리지 않는다.
 */
const canvas = document.getElementById('fieldCanvas'), ctx = canvas.getContext('2d');
let SCALE = 3.9, HOME_X = 0, HOME_Y = 0;
const FENCE_DIST = 115;
let grassPattern = null, crowdCanvas = null;

let awayTurn = 0;
let throwSeq = [];
let throwPlan = [];
let glove = null;
let captionGate = null;
let captionHoldUntil = 0;
let playSpeed = 1;
let playElapsed = 0;
let playLingerUntil = 0;
let runnersAllIn = true;
const JUDGE_BASE_M = 27.43;
const PLAY_LINGER_MS = 360;
const STAND_REACH_M = 2.15;
const JUMP_REACH_M = 2.65;
const FENCE_CAROM_MIN = 108;
const CLIP_RADIUS_M = 0.4;
const LOW_BALL_Z = 0.3;
const OUTFIELD_GRASS_M = 48;
const DIRT_EDGE_M = 38;
const DIRT_DECEL = 6.8;
const GRASS_DECEL = 10.5;
const ROLL_REF = 8.4;
let playCaption = null;
let celebrate = null;
const AI_NAMES = ['김도윤','이시우','박하준','최민재','정우진','강태양','조하람','윤시후','장도현','한지호','오승민','서준혁','신태경','권도하','배성민','문지완','노시원','류하진','백승호','차민우','고은성','임지성','황준서','안재석','송민규'];
function makeArm(name, role, label, slotIndex, spd, ctrl, stuff, brk, stm, mnt) {
  return {
    name: name, role: role, label: label, slotIndex: slotIndex,
    spd: spd, ctrl: ctrl, stuff: stuff, brk: brk, stm: stm, mnt: mnt,
    stamina: 100, runs: 0, innRuns: 0, outs: 0,
    ovr: Math.round((spd + ctrl + stuff + brk + stm + mnt) / 6)
  };
}
function scaleStat(n, ovr) {
  if (!ovr) return n;
  return Math.max(32, Math.min(99, Math.round(n * (Number(ovr) / 74))));
}
function createTeam(prefix, ovr) {
  const presets = [
    { pos: '2B', type: '교타', rct: 78, spd: 82, ang: 8, con: 82, pow: 58, fld: 74 },
    { pos: 'SS', type: '교타', rct: 78, spd: 81, ang: 10, con: 78, pow: 62, fld: 81 },
    { pos: 'CF', type: '엘리트', rct: 80, spd: 83, ang: 14, con: 84, pow: 82, fld: 79 },
    { pos: '1B', type: '거포', rct: 65, spd: 57, ang: 20, con: 66, pow: 90, fld: 67 },
    { pos: 'LF', type: '거포', rct: 65, spd: 67, ang: 18, con: 68, pow: 85, fld: 68 },
    { pos: '3B', type: '중장', rct: 71, spd: 67, ang: 15, con: 72, pow: 78, fld: 79 },
    { pos: 'RF', type: '중장', rct: 70, spd: 72, ang: 13, con: 70, pow: 74, fld: 79 },
    { pos: 'C',  type: '수비', rct: 69, spd: 54, ang: 11, con: 65, pow: 68, fld: 84 },
    { pos: 'DH', type: '공갈', rct: 59, spd: 60, ang: 22, con: 58, pow: 88, fld: 60 }
  ];
  const batters = presets.map(function(p, i) {
    const angRate = Math.max(35, Math.min(80, Math.round(50 + (p.ang - 12) * 2.2)));
    const rct = scaleStat(p.rct, ovr), spd = scaleStat(p.spd, ovr), con = scaleStat(p.con, ovr);
    const pow = scaleStat(p.pow, ovr), fld = scaleStat(p.fld, ovr);
    return {
      name: AI_NAMES[(awayTurn * 5 + i) % AI_NAMES.length], pos: p.pos, type: p.type,
      rct: rct, spd: spd, ang: angRate, con: con, pow: pow, fld: fld,
      launch: p.ang,
      ovr: Math.round((rct + spd + angRate + con + pow + fld) / 6),
      ab: 0, h: 0, hr: 0, rbi: 0
    };
  });
  const staff = [
    makeArm(AI_NAMES[(awayTurn + 9) % AI_NAMES.length], 'SP', '1선발', -1, scaleStat(78, ovr), scaleStat(74, ovr), scaleStat(76, ovr), scaleStat(70, ovr), scaleStat(78, ovr), scaleStat(72, ovr)),
    makeArm(AI_NAMES[(awayTurn + 10) % AI_NAMES.length], 'SP', '2선발', -1, scaleStat(76, ovr), scaleStat(75, ovr), scaleStat(73, ovr), scaleStat(72, ovr), scaleStat(76, ovr), scaleStat(70, ovr)),
    makeArm(AI_NAMES[(awayTurn + 11) % AI_NAMES.length], 'SP', '3선발', -1, scaleStat(74, ovr), scaleStat(73, ovr), scaleStat(75, ovr), scaleStat(74, ovr), scaleStat(74, ovr), scaleStat(71, ovr)),
    makeArm(AI_NAMES[(awayTurn + 12) % AI_NAMES.length], 'SP', '4선발', -1, scaleStat(73, ovr), scaleStat(76, ovr), scaleStat(70, ovr), scaleStat(71, ovr), scaleStat(75, ovr), scaleStat(73, ovr)),
    makeArm(AI_NAMES[(awayTurn + 13) % AI_NAMES.length], 'SP', '5선발', -1, scaleStat(75, ovr), scaleStat(70, ovr), scaleStat(77, ovr), scaleStat(68, ovr), scaleStat(73, ovr), scaleStat(69, ovr))
  ];
  const bullpen = [
    makeArm(AI_NAMES[(awayTurn + 14) % AI_NAMES.length], 'RP', '승리조A', 0, scaleStat(80, ovr), scaleStat(72, ovr), scaleStat(78, ovr), scaleStat(70, ovr), scaleStat(64, ovr), scaleStat(74, ovr)),
    makeArm(AI_NAMES[(awayTurn + 15) % AI_NAMES.length], 'RP', '승리조B', 1, scaleStat(77, ovr), scaleStat(74, ovr), scaleStat(75, ovr), scaleStat(73, ovr), scaleStat(66, ovr), scaleStat(76, ovr)),
    makeArm(AI_NAMES[(awayTurn + 16) % AI_NAMES.length], 'RP', '추격조', 2, scaleStat(74, ovr), scaleStat(70, ovr), scaleStat(73, ovr), scaleStat(76, ovr), scaleStat(68, ovr), scaleStat(72, ovr)),
    makeArm(AI_NAMES[(awayTurn + 17) % AI_NAMES.length], 'CL', '마무리', 3, scaleStat(84, ovr), scaleStat(76, ovr), scaleStat(82, ovr), scaleStat(74, ovr), scaleStat(62, ovr), scaleStat(80, ovr))
  ];
  const n = awayTurn % 5;
  const src = staff[n];
  const pitcher = makeArm(src.name, src.role, src.label, -1, src.spd, src.ctrl, src.stuff, src.brk, src.stm, src.mnt);
  pitcher.outs = 0;
  return { name: prefix, short: String(prefix).slice(0, 1), color: '', batters: batters, staff: staff, bullpen: bullpen, penUsed: [], appeared: [], pitcher: pitcher, idx: 0, score: 0, hits: 0, errors: 0 };
}

let game = null, animId = null, ball = null, runnersAnim = [], throwBall = null;
let pitchFx = null;
let view = { zoom: 1, mx: 0, my: 0, target: 1, zoomAt: 0, zoomOut: -1 };
var TUNE = { gap: 0.04, up: 0.55, down: 1.56, range: 0.58 };
const baseCoords = [{x:0,y:0}, {x:19.4,y:19.4}, {x:0,y:38.8}, {x:-19.4,y:19.4}, {x:0,y:0}];
const fieldPosMap = {
  'P': {x:0, y:18.4, of:false}, 'C': {x:0, y:-1.5, of:false},
  '1B': {x:18, y:26, of:false}, '2B': {x:9.5, y:36, of:false}, 'SS': {x:-9.5, y:36, of:false}, '3B': {x:-18, y:26, of:false},
  'LF': {x:-43.2, y:67.3, of:true}, 'CF': {x:0, y:84.5, of:true}, 'RF': {x:43.2, y:67.3, of:true}
};
let activeFielders = [];

function initGame(mode) {
  if (animId) cancelAnimationFrame(animId);
  animId = null;
  const nextMode = mode || (game && game.mode) || 'league';
  const meta = (window.Club && Club.matchMeta) ? Club.matchMeta() : null;
  let home, away;
  if (meta && window.Club && Club.createMatchTeam) {
    const user = Club.createMatchTeam();
    user.name = meta.userName;
    user.short = meta.userShort || '히';
    user.color = meta.userColor || '#c0392b';
    const opp = createTeam(meta.oppName, meta.oppOvr);
    opp.short = meta.oppShort || String(meta.oppName || '원').slice(0, 1);
    opp.color = meta.oppColor || '#1a5276';
    if (meta.userSide === 'away' && nextMode !== 'mirror') { away = user; home = opp; }
    else { home = user; away = opp; }
  } else {
    home = (window.Club && Club.createMatchTeam) ? Club.createMatchTeam() : createTeam('홈');
    away = createTeam('원정');
    if (!home.name) home.name = '홈';
    if (!home.color) home.color = '#c0392b';
    away.color = away.color || '#1a5276';
  }
  let mirrored = false;
  if (nextMode === 'mirror') {
    stampKboAverage(home);
    stampKboAverage(away);
    mirrored = true;
  } else if (nextMode === 'friendly') {
    const userTeam = (meta && meta.userSide === 'away') ? away : home;
    const oppTeam = userTeam === home ? away : home;
    mirrorRoster(userTeam, oppTeam);
    mirrored = true;
  }
  awayTurn = (awayTurn + 1) % 5;
  game = { away: away, home: home, inning: 1, isTop: true, outs: 0, bases: [null, null, null], isOver: false, mode: nextMode, resultSent: false, walkoff: false, wind: rollWind(), infieldIn: false, banner: '', userSide: nextMode === 'mirror' ? 'home' : (meta ? meta.userSide : 'home'), _tag1: false, _coverP: false, _needBag: '', _chaser: '', _ballX: 0, _catch: null, _closeInning: false, mirrored: mirrored };
  ball = null; runnersAnim = []; throwBall = null; throwSeq = []; throwPlan = []; glove = null; captionGate = null; captionHoldUntil = 0; playCaption = null; celebrate = null; pitchFx = null;
  view = { zoom: 1, mx: 0, my: 0, target: 1, zoomAt: 0, zoomOut: -1 };
  const modal = document.getElementById('resultModal');
  if (modal) modal.hidden = true;
  setupDefenseFielders();
  updateUI('경기 시작! 전광판 바람 ' + game.wind.label + '. 1회초 원정팀 공격입니다.' + (nextMode === 'mirror' ? ' 동일 OVR 테스트: 양 팀 라인업과 투수를 메모리에서만 OVR 70으로 맞췄습니다.' : (mirrored ? ' 친선: 상대 라인업과 투수를 우리 팀과 같게 맞췄습니다.' : '')));
  drawField();
}

function stopMatch() {
  if (animId) cancelAnimationFrame(animId);
  animId = null;
}

function finishMatch() {
  if (!game || !game.isOver || game.resultSent) return;
  game.resultSent = true;
  if (window.Club && Club.handleMatchEnd) Club.handleMatchEnd(game);
}

function setupDefenseFielders() {
  const defTeam = game.isTop ? game.home : game.away;
  const pit = defTeam.pitcher;
  activeFielders = [];
  Object.keys(fieldPosMap).forEach(function(pos) {
    const pData = fieldPosMap[pos];
    const found = defTeam.batters.find(function(b) { return b.pos === pos; });
    let st = found || { name: pos, rct: 70, spd: 70, fld: 70 };
    if (pos === 'P' && pit) {
      st = {
        name: pit.name,
        rct: pit.mnt || 70,
        spd: Math.round(((pit.stm || 70) + (pit.mnt || 70)) / 2),
        fld: Math.round(((pit.ctrl || 70) + (pit.mnt || 70)) / 2)
      };
    }
    activeFielders.push({
      pos: pos, name: st.name || pos, x: pData.x, y: pData.y, homeX: pData.x, homeY: pData.y,
      goalX: pData.x, goalY: pData.y, isOF: pData.of, rct: st.rct, spd: st.spd, fld: st.fld, isTarget: false
    });
  });
}
const toCanvas = function(mx, my) { return { x: HOME_X + mx * SCALE, y: HOME_Y - my * SCALE }; };
function randNormal(mean, stdDev) {
  let u = 0, v = 0; while(!u) u = Math.random(); while(!v) v = Math.random();
  return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function setBroadcast(text) {
  const el = document.getElementById('broadcastText');
  if (!el || text == null) return;
  el.textContent = text;
  fitBroadcast(el);
}
function fitBroadcast(el) {
  if (!el || !el.style) return;
  const maxPx = 15;
  const minPx = 8;
  el.style.fontSize = maxPx + 'px';
  if (!(el.clientWidth > 40) || !(el.scrollWidth > el.clientWidth + 1)) return;
  let size = maxPx;
  while (size > minPx && el.scrollWidth > el.clientWidth + 1) {
    size = Math.round((size - 0.5) * 10) / 10;
    el.style.fontSize = size + 'px';
  }
}
function shownOuts() {
  if (game && game._holdOuts) return Math.max(0, game.outs - (game._outsHeld || 0));
  return game ? game.outs : 0;
}
function paintOuts() {
  const dots = document.querySelectorAll('#outDisplay i');
  const n = shownOuts();
  for (let i = 0; i < dots.length; i++) dots[i].className = i < n ? 'on' : '';
}
function updateUI(msg) {
  document.getElementById('awayScore').textContent = game.away.score;
  document.getElementById('homeScore').textContent = game.home.score;
  const awayName = document.getElementById('awayName');
  const homeName = document.getElementById('homeName');
  if (awayName) awayName.textContent = game.away.name || '원정';
  if (homeName) homeName.textContent = game.home.name || '홈';
  const awayBadge = document.getElementById('awayBadge');
  const homeBadge = document.getElementById('homeBadge');
  if (awayBadge) {
    awayBadge.textContent = game.away.short || '원';
    if (game.away.color) awayBadge.style.background = game.away.color;
  }
  if (homeBadge) {
    homeBadge.textContent = game.home.short || '홈';
    if (game.home.color) homeBadge.style.background = game.home.color;
  }
  document.getElementById('inningDisplay').textContent = game.isOver ? '종료' : String(game.inning);
  const arrow = document.getElementById('inningArrow');
  arrow.textContent = game.isOver ? '' : (game.isTop ? '▲' : '▼');
  arrow.className = 'arrow ' + (game.isTop ? 'top' : 'bot');
  paintOuts();
  if (msg) setBroadcast(msg);
  const windEl = document.getElementById('windChip');
  if (windEl && game.wind) windEl.textContent = game.wind.label;
  const mirrorBtn = document.getElementById('btnMirror');
  if (mirrorBtn) mirrorBtn.classList.toggle('on', !!(game.mirrored || game.mode === 'mirror' || game.mode === 'friendly'));
  const ban = document.getElementById('alertBanner');
  if (ban) {
    ban.hidden = !game.banner;
    ban.textContent = game.banner || '';
  }

  ['away', 'home'].forEach(function(side) {
    const t = game[side];
    const isAtk = (side === 'away' && game.isTop) || (side === 'home' && !game.isTop);
    const listEl = document.getElementById(side + 'LineupList');
    document.getElementById(side + 'Hits').textContent = 'H ' + t.hits + '  E ' + (t.errors || 0);
    listEl.innerHTML = '';
    t.batters.forEach(function(b, i) {
      const div = document.createElement('div');
      const hot = (b.heat || 0) >= 2 || (isAtk && t.idx === i && (game.bases[1] || game.bases[2]));
      div.className = 'batter-row' + (isAtk && t.idx === i && !game.isOver ? ' active' : '') + (hot ? ' hot' : '');
      const ovr = b.ovr || Math.round((b.rct + b.spd + b.ang + b.con + b.pow + b.fld) / 6);
      const handMark = batterHand(b) === 'L' ? '좌타' : '우타';
      div.innerHTML = '<span class="ord">' + (i + 1) + '</span><span class="nm">' + b.pos + ' <em>오버롤(OVR) ' + ovr + '</em></span><span class="stat">' + b.h + '/' + b.ab + '</span>';
      if (isAtk && t.idx === i && !game.isOver) {
        div.innerHTML += '<div class="bcard">오버롤(OVR) ' + ovr + ' · ' + handMark + '<br>순발력 ' + b.rct + ' · 주력 ' + b.spd + ' · 발사각 ' + b.ang + '<br>정확 ' + b.con + ' · 파워 ' + b.pow + ' · 수비 ' + b.fld + '</div>';
      }
      listEl.appendChild(div);
    });
    const pit = t.pitcher;
    const stam = Math.max(0, Math.round(pit.stamina));
    const povr = pit.ovr || Math.round((pit.spd + pit.ctrl + pit.stuff + pit.brk + pit.stm + pit.mnt) / 6);
    const thrown = pit.pitches || 0;
    document.getElementById(side + 'PitcherBox').innerHTML =
      '<div class="pit-kicker">' + (pit.label || '투수') + ' · 오버롤(OVR) ' + povr + '</div>' +
      '<div class="pit-name"><span>' + pit.name + (stam < 45 ? ' 💧' : '') + '</span><b>잔여 ' + stam + '%</b></div>' +
      '<div class="pit-stam"><span style="width:' + stam + '%"></span></div>' +
      '<div class="pit-stats">구속 ' + pit.spd + ' · 제구 ' + pit.ctrl + '<br>구위 ' + pit.stuff + ' · 변화 ' + pit.brk + '<br>체력 ' + pit.stm + ' · 멘탈 ' + pit.mnt + (thrown ? '<br>투구 ' + thrown : '') + '</div>';
  });
}

function fitCanvas() {
  const stage = document.getElementById('stage');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(2, Math.round(stage.clientWidth * dpr));
  const h = Math.max(2, Math.round(stage.clientHeight * dpr));
  if (canvas.width === w && canvas.height === h && grassPattern) return;
  canvas.width = w;
  canvas.height = h;
  HOME_X = w / 2;
  HOME_Y = h * 0.9;
  SCALE = (HOME_Y - h * 0.14) / FENCE_DIST;
  buildTextures();
}

function buildTextures() {
  const tile = document.createElement('canvas');
  tile.width = 64;
  tile.height = 64;
  const g = tile.getContext('2d');
  for (let y = 0; y < 64; y++) {
    g.fillStyle = (y % 16) < 8 ? '#3cb35c' : '#2f9a4c';
    g.fillRect(0, y, 64, 1);
  }
  for (let i = 0; i < 90; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.05)';
    g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
  }
  grassPattern = ctx.createPattern(tile, 'repeat');

  crowdCanvas = document.createElement('canvas');
  crowdCanvas.width = canvas.width;
  crowdCanvas.height = canvas.height;
  const c = crowdCanvas.getContext('2d');
  const bowl = (FENCE_DIST + 5) * SCALE;
  c.beginPath();
  c.moveTo(HOME_X, HOME_Y);
  c.arc(HOME_X, HOME_Y, bowl + canvas.height * 0.62, -Math.PI, 0);
  c.closePath();
  const stand = c.createLinearGradient(0, 0, 0, HOME_Y);
  stand.addColorStop(0, '#243044');
  stand.addColorStop(1, '#141c28');
  c.fillStyle = stand;
  c.fill();

  const colors = ['#e74c3c', '#f5d76e', '#5dade2', '#f4f6f7', '#af7ac5', '#1abc9c', '#e67e22', '#d5d8dc'];
  const rowStep = Math.max(5, SCALE * 0.72);
  const dot = Math.max(2.2, rowStep * 0.42);
  for (let r = bowl, row = 0; r < bowl + canvas.height * 0.5; r += rowStep, row++) {
    const count = 110;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI * 0.98 + ((i + (row % 2) * 0.5) / count) * Math.PI * 0.96;
      const x = HOME_X + Math.cos(a) * r;
      const y = HOME_Y + Math.sin(a) * r;
      c.globalAlpha = 0.72;
      c.fillStyle = colors[(i * 3 + row) % colors.length];
      c.fillRect(x, y, dot, dot * 0.72);
    }
  }
  c.globalAlpha = 1;
}

function meterPath(pts) {
  ctx.beginPath();
  pts.forEach(function(pt, i) {
    const p = toCanvas(pt[0], pt[1]);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
}

function drawBag(p) {
  const s = Math.max(7, 1.15 * SCALE);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-s / 2 + 1.5, -s / 2 + 2, s, s);
  ctx.fillStyle = '#f7f9fb';
  ctx.strokeStyle = '#d5dde3';
  ctx.lineWidth = 1;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeRect(-s / 2, -s / 2, s, s);
  ctx.restore();
}

function drawHomePlate(p) {
  const s = Math.max(6, 0.95 * SCALE);
  ctx.beginPath();
  ctx.moveTo(p.x - s, p.y - s * 0.15);
  ctx.lineTo(p.x - s, p.y - s);
  ctx.lineTo(p.x + s, p.y - s);
  ctx.lineTo(p.x + s, p.y - s * 0.15);
  ctx.lineTo(p.x, p.y + s * 0.95);
  ctx.closePath();
  ctx.fillStyle = '#f4f7f8';
  ctx.strokeStyle = '#d0d7de';
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();
}

function drawToken(p, fill, label) {
  const r = Math.max(5.5, 1.35 * SCALE);
  ctx.beginPath();
  ctx.arc(p.x + 1, p.y + r * 0.45, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, r * 0.18);
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  if (label) {
    ctx.fillStyle = '#fff';
    ctx.font = '700 ' + Math.max(9, r * 0.95) + 'px Malgun Gothic';
    ctx.textAlign = 'center';
    ctx.fillText(label, p.x, p.y - r - 2);
  }
}

function drawSweat(p) {
  const drip = (Date.now() / 160) % 2;
  ctx.fillStyle = '#b9e6ff';
  ctx.beginPath();
  ctx.arc(p.x + Math.max(6, SCALE * 1.1), p.y - 2 + drip * 3, Math.max(1.6, SCALE * 0.28), 0, Math.PI * 2);
  ctx.fill();
}
function drawFlame(p) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 140, 40, 0.95)';
  ctx.lineWidth = Math.max(2, SCALE * 0.28);
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(8, SCALE * 1.7), 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 220, 90, 0.8)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(5, SCALE * 1.15), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
function drawPitchFlight() {
  if (!pitchFx || !pitchFx.trail || pitchFx.trail.length < 1) return;
  if (pitchFx.holdUntil != null) {
    if (playElapsed > pitchFx.holdUntil) return;
  } else if (pitchFx.t > pitchFx.dur + 0.08) return;
  ctx.beginPath();
  pitchFx.trail.forEach(function (pt, i) {
    const p = toCanvas(pt[0], pt[1]);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = pitchFx.kind === 'fast' ? 'rgba(255,255,255,0.9)' : pitchFx.kind === 'drop' ? 'rgba(120,210,255,0.9)' : 'rgba(255,170,70,0.92)';
  ctx.lineWidth = Math.max(2, 0.28 * SCALE);
  ctx.stroke();
  const last = pitchFx.trail[pitchFx.trail.length - 1];
  const cp = toCanvas(last[0], last[1]);
  ctx.beginPath();
  ctx.arc(cp.x, cp.y, Math.max(3.2, 0.7 * SCALE), 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.font = '700 ' + Math.max(12, 2.4 * SCALE) + 'px Malgun Gothic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f4fbff';
  ctx.fillText(pitchFx.name, cp.x + 10, cp.y - 8);
}
function eventCaptionY() {
  const banner = document.getElementById('paBanner');
  const stage = document.getElementById('stage');
  const fontPx = Math.max(26, canvas.width * 0.034);
  let y = canvas.height * 0.36;
  if (banner && stage && !banner.hidden && banner.getBoundingClientRect && stage.getBoundingClientRect) {
    const br = banner.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    if (sr.height > 40 && br.bottom > br.top) {
      y = ((br.bottom - sr.top) / sr.height) * canvas.height + fontPx * 0.82 + 14;
    }
  }
  return Math.max(canvas.height * 0.30, Math.min(canvas.height * 0.44, y));
}
function drawField() {
  fitCanvas();
  const w = canvas.width, h = canvas.height, R = FENCE_DIST * SCALE;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  if (view.zoom > 1.02) {
    const fp = toCanvas(view.mx || 0, view.my || 0);
    ctx.translate(fp.x, fp.y);
    ctx.scale(view.zoom, view.zoom);
    ctx.translate(-fp.x, -fp.y);
  }
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1a2744');
  sky.addColorStop(0.55, '#243044');
  sky.addColorStop(1, '#121820');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  if (crowdCanvas) ctx.drawImage(crowdCanvas, 0, 0);

  ctx.beginPath();
  ctx.moveTo(HOME_X, HOME_Y);
  ctx.arc(HOME_X, HOME_Y, R, -Math.PI * 0.97, -Math.PI * 0.03);
  ctx.closePath();
  ctx.fillStyle = grassPattern || '#2f9a4c';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(HOME_X, HOME_Y, 18 * SCALE, 0, Math.PI);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(HOME_X, HOME_Y);
  ctx.arc(HOME_X, HOME_Y, R, -Math.PI * 0.97, -Math.PI * 0.03);
  ctx.closePath();
  ctx.clip();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.moveTo(HOME_X, HOME_Y);
  ctx.arc(HOME_X, HOME_Y, R, -Math.PI * 0.75, -Math.PI * 0.25, true);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8, 48, 22, 0.22)';
  ctx.fill('evenodd');
  ctx.restore();

  ctx.beginPath();
  ctx.arc(HOME_X, HOME_Y, R - 3.2 * SCALE, -Math.PI * 0.97, -Math.PI * 0.03);
  ctx.strokeStyle = '#d2b48a';
  ctx.lineWidth = 6.2 * SCALE;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(HOME_X, HOME_Y, R, -Math.PI * 0.97, -Math.PI * 0.03);
  ctx.strokeStyle = '#0e2418';
  ctx.lineWidth = Math.max(7, 2.1 * SCALE);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(HOME_X, HOME_Y, R + Math.max(3, 0.55 * SCALE), -Math.PI * 0.97, -Math.PI * 0.03);
  ctx.strokeStyle = '#f6d365';
  ctx.lineWidth = Math.max(2, 0.38 * SCALE);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(HOME_X, HOME_Y);
  ctx.arc(HOME_X, HOME_Y, R, -Math.PI * 0.75, -Math.PI * 0.25);
  ctx.closePath();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(HOME_X, HOME_Y);
  ctx.arc(HOME_X, HOME_Y, 29.5 * SCALE, -Math.PI * 0.8, -Math.PI * 0.2);
  ctx.closePath();
  const dirt = ctx.createRadialGradient(HOME_X, HOME_Y - 10 * SCALE, 8 * SCALE, HOME_X, HOME_Y, 32 * SCALE);
  dirt.addColorStop(0, '#e0b07a');
  dirt.addColorStop(1, '#c4844a');
  ctx.fillStyle = dirt;
  ctx.fill();
  ctx.restore();

  const b1 = toCanvas(19.4, 19.4), b2 = toCanvas(0, 38.8), b3 = toCanvas(-19.4, 19.4);
  ctx.beginPath();
  ctx.moveTo(HOME_X, HOME_Y);
  ctx.lineTo(b1.x, b1.y);
  ctx.lineTo(b2.x, b2.y);
  ctx.lineTo(b3.x, b3.y);
  ctx.closePath();
  ctx.fillStyle = grassPattern || '#2f9a4c';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(HOME_X, HOME_Y, 3.9 * SCALE, 0, Math.PI * 2);
  ctx.fillStyle = '#c4844a';
  ctx.fill();

  const mound = toCanvas(0, 18.4);
  const mg = ctx.createRadialGradient(mound.x - SCALE, mound.y - SCALE, SCALE * 0.2, mound.x, mound.y, 5.4 * SCALE);
  mg.addColorStop(0, '#efd0a4');
  mg.addColorStop(0.62, '#d09a62');
  mg.addColorStop(1, 'rgba(196,132,74,0)');
  ctx.beginPath();
  ctx.ellipse(mound.x, mound.y, 5.6 * SCALE, 3.5 * SCALE, 0, 0, Math.PI * 2);
  ctx.fillStyle = mg;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(mound.x, mound.y, 1.15 * SCALE, 0.55 * SCALE, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#f3f5f6';
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.82)';
  ctx.lineWidth = Math.max(1.4, 0.12 * SCALE);
  [[ [0.55, -0.55], [1.6, -0.55], [1.6, 1.2], [0.55, 1.2] ], [ [-1.6, -0.55], [-0.55, -0.55], [-0.55, 1.2], [-1.6, 1.2] ]].forEach(function(box) {
    meterPath(box);
    ctx.stroke();
  });

  const lf = toCanvas(-FENCE_DIST * Math.SQRT1_2, FENCE_DIST * Math.SQRT1_2);
  const rf = toCanvas(FENCE_DIST * Math.SQRT1_2, FENCE_DIST * Math.SQRT1_2);
  ctx.beginPath();
  ctx.moveTo(HOME_X, HOME_Y); ctx.lineTo(lf.x, lf.y);
  ctx.moveTo(HOME_X, HOME_Y); ctx.lineTo(rf.x, rf.y);
  ctx.strokeStyle = 'rgba(255,255,255,0.94)';
  ctx.lineWidth = Math.max(2, 0.26 * SCALE);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(HOME_X, HOME_Y);
  ctx.lineTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(b3.x, b3.y); ctx.closePath();
  ctx.strokeStyle = 'rgba(255,255,255,0.78)';
  ctx.lineWidth = Math.max(1.5, 0.16 * SCALE);
  ctx.stroke();

  [lf, rf].forEach(function(p) {
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(p.x - 1.5, p.y - 16, 3, 18);
  });

  drawHomePlate(toCanvas(0, 0));
  drawBag(b1); drawBag(b2); drawBag(b3);

  activeFielders.forEach(function(f) {
    const p = toCanvas(f.x, f.y);
    const defSide = game.isTop ? game.home : game.away;
    drawToken(p, f.isTarget ? '#ff4757' : (f.isOF ? '#1e90ff' : '#3742fa'), f.pos);
    if (f.pos === 'P' && defSide.pitcher && defSide.pitcher.stamina < 45) drawSweat(p);
  });

  if (game.aura) drawFlame(toCanvas(0, 0.4));
  if (runnersAnim.length > 0) {
    runnersAnim.forEach(function(r) {
      const p = toCanvas(r.x, r.y);
      if (game.aura && r.startIdx === 0) drawFlame(p);
      drawToken(p, '#ffa502');
    });
  } else {
    game.bases.forEach(function(bRunner, idx) {
      if (bRunner) {
        const p = toCanvas(baseCoords[idx + 1].x, baseCoords[idx + 1].y);
        if (game.aura && idx === 0) drawFlame(p);
        drawToken(p, '#ffa502');
      }
    });
  }

  drawPitchFlight();
  if (ball && ball.started) {
    if (ball.trail && ball.trail.length > 1 && ball.showTail) {
      ctx.beginPath();
      ball.trail.forEach(function (pt, i) {
        const p = toCanvas(pt[0], pt[1]);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = 'rgba(255, 214, 90, 0.8)';
      ctx.lineWidth = Math.max(2, 0.32 * SCALE);
      ctx.stroke();
    }
    if (ball.hide) { /* 송구 공이 따로 그려진다 */ }
    else {
    const cp = toCanvas(ball.curX, ball.curY);
    const br = Math.max(3.5, 0.85 * SCALE);
    const lift = Math.min(86, (ball.curH || 0) * SCALE * 0.4);
    ctx.beginPath(); ctx.arc(cp.x, cp.y + br * 0.35, br * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
    ctx.beginPath(); ctx.arc(cp.x, cp.y - lift, br, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 1.4; ctx.stroke();
    if (ball.showTail && ball.exitKmh) {
      ctx.font = '700 ' + Math.max(13, 3.2 * SCALE) + 'px Malgun Gothic';
      ctx.textAlign = 'left';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      const label = Math.round(ball.exitKmh) + 'km/h  ' + Math.round(ball.distance) + 'm';
      ctx.strokeText(label, cp.x + 12, cp.y - lift - 12);
      ctx.fillStyle = '#fff6d4';
      ctx.fillText(label, cp.x + 12, cp.y - lift - 12);
    }
    }
  }
  if (throwBall && throwBall.active) {
    const tbp = toCanvas(throwBall.x, throwBall.y);
    const lift = Math.min(78, (throwBall.h || 0) * SCALE * 0.42);
    ctx.beginPath(); ctx.arc(tbp.x, tbp.y - lift, Math.max(3.5, 0.8 * SCALE), 0, Math.PI * 2);
    ctx.fillStyle = throwBall.wild ? '#ff4d4d' : (throwBall.bounce ? '#ffd56a' : '#00e5ff'); ctx.fill();
  }
  ctx.restore();
  if (playCaption) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '800 ' + Math.max(26, canvas.width * 0.034) + 'px Malgun Gothic';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.62)';
    ctx.fillStyle = playCaption.bad ? '#ff5d5d' : '#ffe27a';
    const y = eventCaptionY();
    ctx.strokeText(playCaption.text, canvas.width / 2, y);
    ctx.fillText(playCaption.text, canvas.width / 2, y);
    ctx.restore();
  }
  if (celebrate) {
    celebrate.parts.forEach(function (p) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 4, 7);
    });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '800 ' + Math.max(32, canvas.width * 0.05) + 'px Malgun Gothic';
    ctx.fillStyle = '#fff4c4';
    ctx.strokeStyle = 'rgba(120,40,0,0.7)';
    ctx.lineWidth = 8;
    ctx.strokeText('WALK-OFF', canvas.width / 2, canvas.height * 0.34);
    ctx.fillText('WALK-OFF', canvas.width / 2, canvas.height * 0.34);
    ctx.restore();
  }
}
function statMetersPerSec(spd) {
  return Math.max(3.4, (Number(spd) || 70) / 90 * (100 / 12));
}
function runMetersPerSec(spd) { return statMetersPerSec(spd); }
const TOP_RUN_AT_70 = 7.6;
const ROUND_STEP_M = 2.0;
const ACCEL_WINDOW_M = 18.29;
function topRunMetersPerSec(spd) {
  const ref = statMetersPerSec(70);
  return statMetersPerSec(spd) * (TOP_RUN_AT_70 / ref);
}
function armMetersPerSec(fld) { return 18.5 + (Number(fld) || 70) * 0.108; }
function startDelay(f) {
  const rct = Number(f && f.rct) || 70;
  const base = (f && f.isOF ? 0.86 : 0.58) - rct * 0.0031;
  return Math.max(0.12, base);
}

function rollWind() {
  const table = [
    { name: '좌중간 뒷바람', carry: 1, cross: -1 },
    { name: '우중간 뒷바람', carry: 1, cross: 1 },
    { name: '좌중간 맞바람', carry: -1, cross: -0.55 },
    { name: '우중간 맞바람', carry: -1, cross: 0.55 },
    { name: '중앙 뒷바람', carry: 1, cross: 0 },
    { name: '중앙 맞바람', carry: -1, cross: 0 },
    { name: '좌횡풍', carry: 0.15, cross: -1 },
    { name: '우횡풍', carry: 0.15, cross: 1 }
  ];
  const w = table[Math.floor(Math.random() * table.length)];
  const ms = 1 + Math.floor(Math.random() * 5);
  return { name: w.name, carry: w.carry, cross: w.cross, ms: ms, label: w.name + ' ' + ms + 'm/s' };
}
function raiseBanner(text) {
  game.banner = text;
  playCaption = { text: text, bad: false };
}
function noteNoHitWatch() {
  const bat = game.isTop ? game.away : game.home;
  const side = game.isTop ? '원정' : '홈';
  if (bat.hits === 0 && game.inning >= 7 && !bat.noHitCall) {
    bat.noHitCall = true;
    raiseBanner(side + ' 타선 ' + game.inning + '회까지 무안타 행진');
  }
}
function noteNoHitterFinal() {
  if (game.inning < 9 || game.noHitFinal) return;
  game.noHitFinal = true;
  if (game.away.hits === 0 && game.away.score === 0) raiseBanner('노히트노런! 홈 투수진');
  else if (game.home.hits === 0 && game.home.score === 0) raiseBanner('노히트노런! 원정 투수진');
}
function touchHeat(batter, kind) {
  if (!batter.bag) batter.bag = [0, 0, 0, 0];
  if (kind === 4) {
    batter.heat = (batter.heat || 0) + 1;
    batter.chr = (batter.chr || 0) + 1;
    batter.bag[3]++;
    if (batter.chr >= 2) raiseBanner('연타석 홈런! ' + batter.name);
  } else if (kind > 0) {
    batter.heat = (batter.heat || 0) + 1;
    batter.chr = 0;
    batter.bag[kind - 1]++;
  } else {
    batter.heat = 0;
    batter.chr = 0;
  }
  if (batter.bag[0] && batter.bag[1] && batter.bag[2] && batter.bag[3] && !batter.cycled) {
    batter.cycled = true;
    raiseBanner('사이클링 히트! ' + batter.name);
  }
}
function bump(team, key, n) { team[key] = (team[key] || 0) + (n == null ? 1 : n); }
function batterOvrOf(b) {
  return b.ovr || Math.round((b.rct + b.spd + b.ang + b.con + b.pow + b.fld) / 6);
}
function gloveMiss(f, batter) {
  const diff = batterOvrOf(batter) - (f.fld || 70);
  const base = f.isOF ? 0.00875 : 0.035;
  return Math.max(0.003, Math.min(0.11, base * (1 + diff * 0.02)));
}
function throwMiss(f, batter, pit) {
  if (f && f.pos === 'P' && pit) {
    const skill = ((pit.ctrl || 70) + (pit.mnt || 70)) / 2;
    return Math.max(0.008, Math.min(0.15, 0.028 + (70 - skill) * 0.0042));
  }
  const diff = batterOvrOf(batter) - ((f && f.fld) || 70);
  return Math.max(0.006, Math.min(0.12, 0.028 * (1 + diff * 0.02)));
}
function tickCamera() {
  const t = playElapsed || 0;
  const active = view.target > 1 && t + 1e-9 >= (view.zoomAt || 0) && t <= (view.zoomOut == null ? -1 : view.zoomOut);
  const goal = active ? view.target : 1;
  view.zoom += (goal - view.zoom) * (active ? 0.075 : 0.03);
  if (view.zoom > 1.35) view.zoom = 1.35;
  if (!active && view.zoom < 1.012) view.zoom = 1;
  const rate = (active && view.zoom > 1.06) ? 0.72 : 1;
  return rate * (playSpeed || 1);
}
function closePlayZoom(margin) {
  const gap = Math.abs(Number(margin) || 0);
  if (!(gap <= 0.40)) return 0;
  return 1.25 + 0.10 * (1 - gap / 0.40);
}
function armClose(mx, my, tArrive, margin) {
  if (game && game._skip) return;
  const z = closePlayZoom(margin);
  if (!(z > 1)) return;
  const at = Math.max(0, (tArrive || 0) - 0.55);
  if (view.target > 1 && z + 0.015 < view.target) return;
  view.mx = mx;
  view.my = my;
  view.target = Math.min(1.35, z);
  view.zoomAt = at;
  view.zoomOut = (tArrive || 0) + 0.90;
}
function noteBaseRace(baseKey, tRun, tThrow) {
  if (!(tRun >= 0) || !(tThrow >= 0) || !isFinite(tRun) || !isFinite(tThrow)) return;
  const bag = bagPoint(baseKey || '1B');
  armClose(bag.x, bag.y, Math.min(tRun, tThrow), tRun - tThrow);
}
function pickPitchKind(pit) {
  const r = Math.random();
  const brk = pit.brk || 70;
  if (r < Math.max(0.28, 0.46 - Math.max(0, brk - 70) * 0.004)) return 'fast';
  if (r < 0.78) return 'break';
  return 'drop';
}
function pitchLabel(kind) {
  if (kind === 'break') return '변화구';
  if (kind === 'drop') return '낙차구';
  return '직구';
}
function beginPitch(pit) {
  const kind = (pit && pit._pitchKind) || pickPitchKind(pit);
  if (pit) pit._pitchKind = kind;
  pitchFx = { kind: kind, name: pitchLabel(kind), t: 0, dur: 0.36, trail: [] };
  return pitchFx.name;
}
function advanceWildRunners() {
  let runs = 0;
  const next = [null, null, null];
  const anim = [];
  if (game.bases[2]) {
    runs++;
    anim.push({ startIdx: 3, targetIdx: 4, speed: runMetersPerSec(game.bases[2].spd), delay: 0.12 });
  }
  if (game.bases[1]) {
    next[2] = game.bases[1];
    anim.push({ startIdx: 2, targetIdx: 3, speed: runMetersPerSec(game.bases[1].spd), delay: 0.1 });
  }
  if (game.bases[0]) {
    next[1] = game.bases[0];
    anim.push({ startIdx: 1, targetIdx: 2, speed: runMetersPerSec(game.bases[0].spd), delay: 0.08 });
  }
  game.bases = next;
  return { runs: runs, animList: anim };
}
function moveSpeed(f) {
  return statMetersPerSec(f && f.spd);
}
function arriveTime(f, x, y) {
  return startDelay(f) + Math.hypot((x || 0) - f.x, (y || 0) - f.y) / moveSpeed(f);
}
function batterGroundDelay(batter) {
  const rct = Number(batter && batter.rct);
  const r = isNaN(rct) ? 70 : rct;
  return Math.max(0.38, Math.min(0.52, 0.45 - (r - 70) * 0.0025));
}
function batterTime1B(batter) {
  return batterGroundDelay(batter) + JUDGE_BASE_M / runMetersPerSec(batter ? batter.spd : 70);
}
function backhandThrow(f, x, y, tBall) {
  if (!f || f.isOF || f.pos === 'P' || f.pos === 'C') return false;
  const margin = (tBall || 0) - arriveTime(f, x, y);
  if (margin < 0.06) return true;
  const drift = Math.hypot((x || 0) - (f.homeX || 0), (y || 0) - (f.homeY || 0));
  if (drift < 8) return false;
  const homeR = Math.hypot(f.homeX || 0, f.homeY || 0);
  const ballR = Math.hypot(x || 0, y || 0);
  return ballR >= homeR + 7 || (y || 0) >= 41;
}
function groundRelease(f, shot, basePrep) {
  const backhand = backhandThrow(f, shot.targetX, shot.targetY, shot.T_ball);
  return {
    backhand: backhand,
    pad: (basePrep == null ? 0.4 : basePrep) + (shot.fieldDelay || 0) + (backhand ? 0.16 : 0),
    armScale: backhand ? 0.9 : 1
  };
}
function throwFlight(f, x0, y0, x1, y1, armScale) {
  const scale = armScale > 0 ? armScale : 1;
  const arm = armMetersPerSec(f ? f.fld : 70) * scale;
  const dist = Math.hypot((x1 || 0) - (x0 || 0), (y1 || 0) - (y0 || 0));
  let dur = dist / Math.max(1, arm);
  let bounce = false;
  const limit = (f && f.isOF) ? 58 : 34;
  const fld = Number(f && f.fld) || 70;
  if (dist + 1e-6 >= limit && fld < 70) {
    const p = Math.min(0.5, (70 - fld) * 0.02);
    if (Math.random() < p) {
      bounce = true;
      dur *= 1.10 + Math.min(0.04, ((70 - fld) / 25) * 0.04);
    }
  }
  return { arm: arm, dist: dist, dur: Math.max(1e-4, dur), bounce: bounce };
}
function oneBounceMiss(recv) {
  if (!recv) return 0;
  const fld = Number(recv.fld) || 70;
  if (fld >= 70) return 0;
  return Math.min(0.06, (70 - fld) * 0.0028);
}
function defensePitcher() {
  if (!game) return null;
  const def = game.isTop ? game.home : game.away;
  return def ? def.pitcher : null;
}
function pitcherCoverLag(pit) {
  if (!pit) pit = defensePitcher();
  if (!pit) return 0;
  const mnt = Number(pit.mnt);
  const m = isNaN(mnt) ? 70 : mnt;
  const stam = Number(pit.stamina);
  const s = isNaN(stam) ? 100 : stam;
  if (m >= 68 || s >= 48) return 0;
  const mT = Math.max(0, Math.min(1, (68 - m) / 28));
  const sT = Math.max(0, Math.min(1, (48 - s) / 32));
  return 0.15 + 0.15 * ((mT + sT) / 2);
}
function pitcherCoverArrive() {
  const mound = fielderBy('P');
  if (!mound) return 0;
  const dist = Math.hypot(19.4 - (mound.homeX || 0), 19.4 - (mound.homeY || 0));
  return startDelay(mound) + pitcherCoverLag() + dist / moveSpeed(mound);
}
function catcherFrameBonus() {
  const c = fielderBy('C');
  if (!c) return 0;
  return Math.max(0, ((Number(c.fld) || 70) - 70) * 0.0004);
}
function groundsNearSecond(shot) {
  if (!shot) return false;
  const meet = Math.hypot(shot.targetX, shot.targetY - 38.8);
  if (meet <= 5) return true;
  // 땅볼 포구점은 홈 기준 33m에서 끊긴다. 2루(38.8m)로 굴러가는 공은
  // 경로가 베이스 5m 안을 지나고, 글러브가 그 직전 8m 안에서 맞으면 같은 피벗이다.
  const dirx = Math.sin(shot.sprayRad || 0);
  const diry = Math.cos(shot.sprayRad || 0);
  const along = 38.8 * diry;
  const miss = Math.abs(38.8 * dirx);
  const meetR = Math.hypot(shot.targetX || 0, shot.targetY || 0);
  return miss <= 5 && along >= 30 && along <= (shot.R || 0) + 0.8 && meet <= 8 && meetR <= along + 0.6;
}
function isMoundCallFly(shot) {
  if (!shot || shot.isGrounder) return false;
  const R = shot.flightR || shot.R || 0;
  if (!(R <= 24) || R < 2) return false;
  return (shot.launchAngle || 0) >= 36 || (shot.maxH || 0) >= 8;
}
function stampCoverLag(mound) {
  if (!mound) return;
  mound.react = startDelay(mound) + pitcherCoverLag();
}
function stampKboAverage(team) {
  if (!team) return;
  (team.batters || []).forEach(function (b) {
    b.rct = 70; b.spd = 70; b.con = 70; b.pow = 70; b.fld = 70;
    b.ang = 50; b.launch = 12; b.ovr = 70;
  });
  function arm70(a) {
    if (!a) return;
    a.spd = 70; a.ctrl = 70; a.stuff = 70; a.brk = 70; a.stm = 70; a.mnt = 70;
    a.ovr = 70;
  }
  arm70(team.pitcher);
  (team.staff || []).forEach(arm70);
  (team.bullpen || []).forEach(arm70);
}
function chaseBall(targetX, targetY, interceptR, opts) {
  let bestF = null, minFTime = 999;
  const onlyOF = !!(opts && opts.onlyOF);
  const skip = (opts && opts.skip) || null;
  activeFielders.forEach(function (f) {
    if (skip && skip[f.pos]) return;
    if (onlyOF && !f.isOF) return;
    if (!onlyOF && (f.pos === 'P' || f.pos === 'C') && interceptR > 22) return;
    const t = arriveTime(f, targetX, targetY);
    if (t < minFTime) { minFTime = t; bestF = f; }
  });
  return { bestF: bestF, minFTime: minFTime };
}
function callInfieldPop(shot) {
  const prefer = ['C', '1B', '3B'];
  let bestF = null, minFTime = 999;
  for (let i = 0; i < prefer.length; i++) {
    const f = fielderBy(prefer[i]);
    if (!f) continue;
    const t = arriveTime(f, shot.targetX, shot.targetY);
    if (t < minFTime) { minFTime = t; bestF = f; }
  }
  const tBall = shot.T_ball || 0;
  if (bestF && minFTime <= tBall + 1e-6) return { bestF: bestF, minFTime: minFTime, called: true };
  const again = chaseBall(shot.targetX, shot.targetY, shot.interceptR || shot.R || 0, { skip: { P: true } });
  if (again.bestF) return { bestF: again.bestF, minFTime: again.minFTime, called: false };
  if (bestF) return { bestF: bestF, minFTime: minFTime, called: true };
  return { bestF: null, minFTime: 999, called: false };
}
function pitcherQuickStat(pit) {
  if (pit && pit.rct != null && !isNaN(Number(pit.rct))) return Number(pit.rct);
  return pit ? (Number(pit.spd) || 70) : 70;
}
function quickMotionDelay(pit) {
  const r = pitcherQuickStat(pit);
  if (r >= 90) return 1.12;
  if (r <= 50) return 1.38;
  return 1.25 + (70 - r) * 0.0065;
}
function pitchFlightTime(pit) {
  const spd = pit ? (Number(pit.spd) || 70) : 70;
  return Math.max(0.38, Math.min(0.48, 0.42 - (spd - 70) * 0.0015));
}
function catcherPopTime(c) {
  const f = c ? (Number(c.fld) || 70) : 70;
  if (f >= 90) return 1.85;
  if (f <= 50) return 2.18;
  if (f >= 70) return 1.98 + (70 - f) * 0.0065;
  return 2.18 + (f - 50) * ((1.98 - 2.18) / 20);
}
const STEAL_TRANSFER = 0.36;
const STEAL_LEAD_M = 3.3;
const STEAL_ACCEL_LOSS = 0.25;
// 옆을 보고 선 리드에서 2루 쪽으로 첫 발을 빼는 시간. 직선 가속 손실 0.25초와 더한다.
const STEAL_CROSS_STEP = 0.08;
function stealReact(rct) {
  const raw = Number(rct);
  const r = isNaN(raw) ? 70 : raw;
  return 0.26 - (r - 50) * 0.004;
}
function stealBreakLead(runner, pit) {
  const spd = runner ? (Number(runner.spd) || 70) : 70;
  const rct = runner ? (Number(runner.rct) || 70) : 70;
  const brk = pit ? (Number(pit.brk) || 70) : 70;
  const mnt = pit ? (Number(pit.mnt) || 70) : 70;
  let lead = STEAL_LEAD_M + (spd - 70) * 0.016 + (rct - 70) * 0.01 - ((brk + mnt) / 2 - 70) * 0.012;
  if (runner && runner._leadCut) lead -= runner._leadCut;
  if (lead < 2.2) lead = 2.2;
  if (lead > 4.8) lead = 4.8;
  return lead;
}
function stealTimeline(pit, c, runner) {
  const quick = quickMotionDelay(pit);
  const flight = pitchFlightTime(pit);
  const pop = catcherPopTime(c);
  const receive = quick + flight;
  const release = receive + STEAL_TRANSFER;
  const arrive = receive + pop;
  const lead = stealBreakLead(runner, pit);
  const speed = topRunMetersPerSec(runner ? runner.spd : 70);
  const react = stealReact(runner ? runner.rct : 70);
  const delay = react + STEAL_ACCEL_LOSS + STEAL_CROSS_STEP;
  const runT = delay + (JUDGE_BASE_M - lead) / Math.max(0.1, speed);
  return {
    quick: quick, flight: flight, pop: pop, receive: receive, release: release, arrive: arrive,
    lead: lead, speed: speed, react: react, accel: STEAL_ACCEL_LOSS, cross: STEAL_CROSS_STEP,
    delay: delay, runT: runT, throwDur: Math.max(0.2, pop - STEAL_TRANSFER)
  };
}
function armStealPitch(pit, quick, flight) {
  const kind = (pit && pit._pitchKind) || pickPitchKind(pit);
  if (pit) pit._pitchKind = kind;
  pitchFx = {
    kind: kind, name: pitchLabel(kind), t: 0, dur: quick + flight, releaseAt: quick,
    holdUntil: quick + flight + STEAL_TRANSFER, trail: []
  };
}
function flightZ(vy, gEff, h0, t) {
  if (gEff == null || vy == null) return null;
  return Math.max(0, (h0 == null ? 1 : h0) + vy * t - 0.5 * gEff * t * t);
}
function heightAtRadius(shot, r) {
  if (!shot || shot.isGrounder || !(shot.flightR > 0.5) || !(shot.flightT > 0)) return 0;
  if (!(r > 0) || r >= shot.flightR - 0.35) return 0;
  const z = flightZ(shot.vy, shot.gEff, shot.h0, shot.flightT * (r / shot.flightR));
  return z == null ? 0 : z;
}
function jumpCatchRate(f, z) {
  const skill = ((Number(f.fld) || 70) + (Number(f.rct) || 70)) / 2;
  const lift = (z - STAND_REACH_M) / (JUMP_REACH_M - STAND_REACH_M);
  return Math.max(0.08, Math.min(0.9, 0.62 + (skill - 70) * 0.011 - lift * 0.42));
}
function judgeInfieldHeight(shot) {
  const none = { snag: null, jumpFail: null, over: null, skip: {} };
  if (!shot || shot.isGrounder || !(shot.flightR > 1)) return none;
  const order = [];
  activeFielders.forEach(function (f) {
    if (f.isOF) return;
    const r = Math.hypot(f.x, f.y);
    if (!(r > 0.4) || r >= shot.flightR - 0.35) return;
    order.push({ f: f, r: r });
  });
  order.sort(function (a, b) { return a.r - b.r; });
  const skip = {};
  let jumpFail = null, over = null;
  for (let i = 0; i < order.length; i++) {
    const f = order[i].f;
    const r = order[i].r;
    if (isMoundCallFly(shot) && f.pos === 'P') {
      skip[f.pos] = true;
      continue;
    }
    const z = heightAtRadius(shot, r);
    const passT = shot.flightT * (r / shot.flightR);
    const ix = r * Math.sin(shot.sprayRad);
    const iy = r * Math.cos(shot.sprayRad);
    if (z > JUMP_REACH_M) {
      skip[f.pos] = true;
      if (!over) over = { f: f, z: z };
      continue;
    }
    const arrive = arriveTime(f, ix, iy);
    if (arrive > passT + 1e-6) continue;
    if (z > STAND_REACH_M) {
      if (Math.random() < jumpCatchRate(f, z)) {
        return { snag: { f: f, passT: passT, arrive: arrive, x: ix, y: iy, z: z, jump: true }, jumpFail: null, over: over, skip: skip };
      }
      jumpFail = { f: f, z: z };
      skip[f.pos] = true;
      continue;
    }
    return { snag: { f: f, passT: passT, arrive: arrive, x: ix, y: iy, z: z, jump: false }, jumpFail: null, over: over, skip: skip };
  }
  return { snag: null, jumpFail: jumpFail, over: over, skip: skip };
}
function bagPoint(key) {
  if (key === '1B') return baseCoords[1];
  if (key === '3B') return baseCoords[3];
  if (key === 'HOME') return baseCoords[0];
  return baseCoords[2];
}
function cutoffLateral(fld) {
  const skill = Number(fld);
  const f = isNaN(skill) ? 70 : skill;
  if (f >= 90) return 0;
  if (f <= 50) return 3.5;
  if (f >= 70) return 1.8 * (90 - f) / 20;
  return 1.8 + (3.5 - 1.8) * (70 - f) / 20;
}
function cutoffSpot(ballX, ballY, base, fld) {
  const bx = base ? base.x : 0;
  const by = base ? base.y : 38.8;
  const dx = (ballX || 0) - bx;
  const dy = (ballY || 0) - by;
  const dist = Math.hypot(dx, dy) || 1;
  const depth = Math.hypot(ballX || 0, ballY || 0);
  let reach;
  const onRelayLine = depth >= 75 || dist > 65;
  if (onRelayLine) {
    const span = Math.max(depth, dist);
    const t = Math.max(0, Math.min(1, (span - 75) / 40));
    reach = 15 + 10 * t;
    if (reach > dist - 8) reach = Math.max(8, dist - 8);
  } else {
    const ahead = 12 + 3 * Math.max(0, Math.min(1, (dist - 60) / 40));
    reach = Math.min(ahead, Math.max(8, dist - 6));
  }
  const ux = dx / dist;
  const uy = dy / dist;
  let px = bx + ux * reach;
  let py = by + uy * reach;
  if (onRelayLine && Math.hypot(px, py) < OUTFIELD_GRASS_M && dist > OUTFIELD_GRASS_M) {
    let lo = reach;
    let hi = Math.min(25, Math.max(reach, dist - 6));
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      const rr = Math.hypot(bx + ux * mid, by + uy * mid);
      if (rr < OUTFIELD_GRASS_M) lo = mid;
      else hi = mid;
    }
    reach = Math.min(25, Math.max(reach, hi));
    px = bx + ux * reach;
    py = by + uy * reach;
  }
  const lat = cutoffLateral(fld);
  const side = (ballX || 0) >= 0 ? 1 : -1;
  return { x: px - uy * lat * side, y: py + ux * lat * side };
}
function relayPair(x, chaser) {
  let cut = (x || 0) < 0 ? 'SS' : '2B';
  let bag = cut === 'SS' ? '2B' : 'SS';
  if (cut === chaser) { const swap = cut; cut = bag; bag = swap; }
  return { cut: cut, bag: bag };
}
function relayExchange(fld) {
  const raw = Number(fld);
  const f = isNaN(raw) ? 70 : raw;
  const t = 0.55 - (f - 70) * 0.0065;
  if (t < 0.36) return 0.36;
  if (t > 0.85) return 0.85;
  return t;
}
function planRelay(who, x, y, release, baseKey) {
  const pair = relayPair(x, who ? who.pos : '');
  const cut = fielderBy(pair.cut) || who;
  const spot = cutoffSpot(x, y, bagPoint(baseKey || '2B'), cut ? cut.fld : 70);
  const arm1 = armMetersPerSec(who ? who.fld : 70);
  const flight1 = Math.max(0.08, Math.hypot(spot.x - x, spot.y - y) / arm1);
  const cutRun = cut ? arriveTime(cut, spot.x, spot.y) : release + flight1;
  const exchange = relayExchange(cut ? cut.fld : 70);
  const rel2 = Math.max(release + flight1, cutRun) + exchange;
  return { cut: cut, cutId: pair.cut, bagId: pair.bag, spot: spot, arm1: arm1, flight1: flight1, exchange: exchange, rel2: rel2 };
}
function directThrowTime(who, x, y, release, base) {
  const arm = armMetersPerSec(who ? who.fld : 70);
  return release + Math.hypot(base.x - x, base.y - y) / Math.max(1, arm);
}
function relayTotalTime(relay, base) {
  const arm = armMetersPerSec(relay && relay.cut ? relay.cut.fld : 70);
  return relay.rel2 + Math.hypot(base.x - relay.spot.x, base.y - relay.spot.y) / Math.max(1, arm);
}
function relayOrDirect(who, x, y, release, baseKey) {
  const base = bagPoint(baseKey || '2B');
  const dist = Math.hypot(base.x - x, base.y - y);
  const direct = {
    relay: null, baseKey: baseKey || '2B', x: x, y: y, rel: release,
    fld: who ? who.fld : 70, t: directThrowTime(who, x, y, release, base)
  };
  if (!who || !who.isOF) return direct;
  if (dist <= 65) return direct;
  if ((Number(who.fld) || 70) >= 90) return direct;
  const relay = planRelay(who, x, y, release, baseKey || '2B');
  const cutT = relayTotalTime(relay, base);
  return {
    relay: relay, baseKey: baseKey || '2B', x: relay.spot.x, y: relay.spot.y,
    rel: relay.rel2, fld: relay.cut ? relay.cut.fld : direct.fld, t: cutT
  };
}
function judgeCutoffHome(relay, runner, read) {
  const cut = relay && relay.cut;
  const arm = armMetersPerSec(cut ? cut.fld : 70);
  const spot = relay.spot;
  const homeD = Math.hypot(spot.x, spot.y);
  const throwHomeT = relay.rel2 + homeD / arm;
  const plan = baserunPlan(runner, 2, 4, read || {});
  const runT = arriveMeters(plan, 2 * JUDGE_BASE_M);
  const slack = tagSlack(runner);
  return { throwHomeT: throwHomeT, runT: runT, canOut: throwHomeT + slack <= runT + 1e-9, arm: arm };
}
function cushionRead(fld) {
  const skill = Number(fld) || 70;
  return Math.max(0.06, 0.28 - (skill - 70) * 0.0065);
}
function fenceRecover(fld) {
  const raw = Number(fld);
  const f = isNaN(raw) ? 70 : raw;
  const t = 1.4 - (f - 50) * 0.005;
  if (t < 1.05) return 1.05;
  if (t > 1.55) return 1.55;
  return t;
}
function planFenceCarom(shot, hint) {
  if (!shot || shot.isGrounder) return null;
  if (!(shot.R >= FENCE_CAROM_MIN && shot.R < FENCE_DIST)) return null;
  const dirx = Math.sin(shot.sprayRad), diry = Math.cos(shot.sprayRad);
  const T = shot.flightT || shot.T_ball;
  const gap = Math.max(0.15, FENCE_DIST - shot.R);
  const vHoriz = (shot.flightR || shot.R) / Math.max(0.35, T);
  const vB = Math.max(6, Math.min(14, vHoriz * 0.38));
  const tWall = T + gap / vB;
  const wallX = FENCE_DIST * dirx;
  const wallY = FENCE_DIST * diry;
  const near = chaseBall(wallX, wallY, FENCE_DIST, { onlyOF: true });
  const f = (near && near.bestF) || hint;
  const reboundV = Math.max(4.2, Math.min(9.5, vB * 0.62));
  const read = cushionRead(f ? f.fld : 70);
  const maxBack = Math.min(16, 7 + reboundV * 0.7);
  let chosen = null;
  for (let i = 0; i <= 12; i++) {
    const s = (maxBack * i) / 12;
    const x = wallX - dirx * s;
    const y = wallY - diry * s;
    const tB = tWall + s / reboundV;
    const tF = f ? arriveTime(f, x, y) : tB;
    if (tF <= tB + 1e-4) {
      chosen = { x: x, y: y, tBall: tB, tField: tF };
      break;
    }
  }
  if (!chosen) {
    const s = maxBack;
    const x = wallX - dirx * s;
    const y = wallY - diry * s;
    const tB = tWall + s / reboundV;
    const tF = f ? arriveTime(f, x, y) : tB;
    chosen = { x: x, y: y, tBall: tB, tField: tF };
  }
  chosen.f = f;
  chosen.wallX = wallX;
  chosen.wallY = wallY;
  chosen.tWall = tWall;
  chosen.read = read;
  chosen.recover = fenceRecover(f ? f.fld : 70);
  chosen.meet = Math.max(chosen.tBall, chosen.tField);
  return chosen;
}
function groundBallZ(shot, r) {
  const R = Math.max(0.5, shot.R || 0.5);
  const maxH = shot.maxH != null ? shot.maxH : 0.35;
  const peak = Math.min(0.35, maxH);
  return Math.max(0, peak * (1 - Math.max(0, r) / R));
}
function applyBaseKick(shot) {
  if (!shot || !shot.isGrounder || shot.kick) return shot;
  const dirx = Math.sin(shot.sprayRad), diry = Math.cos(shot.sprayRad);
  const obstacles = [
    { x: 19.4, y: 19.4, name: '1루 베이스' },
    { x: -19.4, y: 19.4, name: '3루 베이스' },
    { x: 0, y: 18.4, name: '투수판' }
  ];
  let hit = null;
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    const along = o.x * dirx + o.y * diry;
    if (along < 1 || along > shot.R - 0.3) continue;
    const dist = Math.hypot(o.x - dirx * along, o.y - diry * along);
    const z = groundBallZ(shot, along);
    if (dist <= CLIP_RADIUS_M && z <= LOW_BALL_Z && (!hit || along < hit.along)) {
      hit = { o: o, along: along, dist: dist, z: z };
    }
  }
  if (!hit) return shot;
  const chance = 0.2 + (1 - hit.dist / CLIP_RADIUS_M) * 0.34;
  if (Math.random() >= chance) return shot;
  const cx = dirx * hit.along;
  const cy = diry * hit.along;
  const side = (hit.o.x - cx) * diry - (hit.o.y - cy) * dirx;
  const sign = Math.abs(side) < 0.02 ? (Math.random() < 0.5 ? -1 : 1) : (side > 0 ? -1 : 1);
  const deflect = (9 + Math.random() * 14) * Math.PI / 180 * sign;
  const slow = 0.58 + Math.random() * 0.16;
  const newRad = shot.sprayRad + deflect;
  const remain0 = Math.max(0.4, shot.R - hit.along);
  const remain = Math.max(1.6, remain0 * slow);
  let fx = cx + Math.sin(newRad) * remain;
  let fy = cy + Math.cos(newRad) * remain;
  if (fy < 0.4) fy = 0.4;
  const far = Math.hypot(fx, fy);
  if (far > FENCE_DIST - 2) {
    const s = (FENCE_DIST - 2) / far;
    fx *= s;
    fy *= s;
  }
  const fullT = shot.T_roll || shot.T_ball;
  const tHit = fullT * (hit.along / Math.max(0.5, shot.R));
  const tRest = Math.max(0.16, (fullT - tHit) / slow);
  const tEnd = tHit + tRest;
  const kickZ = 0.75 + Math.random() * 0.9;
  let meetX = fx, meetY = fy, meetT = tEnd;
  for (let i = 1; i <= 10; i++) {
    const u = i / 10;
    const x = cx + (fx - cx) * u;
    const y = cy + (fy - cy) * u;
    const tB = tHit + tRest * u;
    let bt = 999;
    activeFielders.forEach(function (f) {
      if (f.pos === 'C') return;
      const t = arriveTime(f, x, y);
      if (t < bt) bt = t;
    });
    if (bt <= tB + 1e-4) { meetX = x; meetY = y; meetT = tB; break; }
  }
  shot.kick = {
    name: hit.o.name, x: cx, y: cy, tHit: tHit, z: kickZ, z0: Math.min(LOW_BALL_Z, hit.z),
    fx: meetX, fy: meetY, tEnd: meetT
  };
  shot.targetX = meetX;
  shot.targetY = meetY;
  shot.interceptR = Math.min(Math.hypot(meetX, meetY), 33);
  shot.T_ball = meetT;
  shot.T_roll = meetT;
  return shot;
}
function catcherBlockRate(c) {
  if (!c) return 0;
  const skill = (Number(c.fld) || 70) * 0.78 + (Number(c.rct) || 70) * 0.22;
  return Math.max(0.05, Math.min(0.48, 0.1 + (skill - 70) * 0.011));
}
function backupPast(tx, ty, extra) {
  const r = Math.hypot(tx, ty) || 1;
  let x = tx + (tx / r) * extra;
  let y = ty + (ty / r) * extra;
  const br = Math.hypot(x, y);
  const cap = FENCE_DIST - 1.2;
  if (br > cap) { x *= cap / br; y *= cap / br; }
  return { x: x, y: y };
}
function clampInfield(x, y) {
  const r = Math.hypot(x, y);
  const cap = FENCE_DIST - 1.2;
  if (r > cap) { const s = cap / r; return { x: x * s, y: y * s }; }
  return { x: x, y: y };
}
function applyOrganicBackups(chaserPos, tx, ty, mode) {
  const r = Math.hypot(tx || 0, ty || 0);
  const ofBall = r >= OUTFIELD_GRASS_M && (mode === 'hit' || mode === 'relay2' || mode === 'fly');
  if (ofBall && chaserPos) {
    let buddyPos = null;
    if (chaserPos === 'RF' || chaserPos === 'LF') buddyPos = 'CF';
    else if (chaserPos === 'CF') buddyPos = (tx || 0) >= 0 ? 'RF' : 'LF';
    const buddy = buddyPos ? fielderBy(buddyPos) : null;
    if (buddy && !buddy.isTarget) {
      const deep = backupPast(tx, ty, 12);
      const pull = buddyPos === 'CF' ? 0.14 : 0.22;
      const spot = clampInfield(deep.x * (1 - pull) + buddy.homeX * pull, deep.y * (1 - pull * 0.35) + buddy.homeY * pull * 0.35);
      buddy.goalX = spot.x;
      buddy.goalY = spot.y;
    }
    ['LF', 'CF', 'RF'].forEach(function (pos) {
      if (pos === chaserPos || pos === buddyPos) return;
      const f = fielderBy(pos);
      if (!f || f.isTarget) return;
      const spot = clampInfield(f.homeX * 0.62 + (tx || 0) * 0.16, Math.min(FENCE_DIST - 6, f.homeY * 0.74 + (ty || 0) * 0.12));
      f.goalX = spot.x;
      f.goalY = spot.y;
    });
  }
  let wild1 = null;
  let fair1 = null;
  let homeSpec = null;
  for (let i = 0; i < throwPlan.length; i++) {
    const s = throwPlan[i];
    if (s.to === '1B') {
      if (s.wild) wild1 = s;
      else if (!fair1) fair1 = s;
    }
    if (s.to === 'HOME') homeSpec = s;
  }
  if ((fair1 || wild1) && chaserPos !== 'RF') {
    const rf = fielderBy('RF');
    if (rf && !rf.isTarget) {
      if (wild1) { rf.goalX = wild1.x1; rf.goalY = wild1.y1; }
      else { rf.goalX = 33; rf.goalY = 6.5; }
    }
  }
  const mound = fielderBy('P');
  if ((homeSpec || (game && game._backstop)) && mound && !mound.isTarget && chaserPos !== 'P') {
    if (homeSpec && homeSpec.wild) {
      mound.goalX = homeSpec.x1;
      mound.goalY = Math.min(-2, homeSpec.y1);
    } else {
      mound.goalX = 0.8;
      mound.goalY = -12;
    }
  }
}
function rollClock(v, a, dist) {
  if (!(v > 0) || !(a > 0)) return 0;
  if (dist <= 1e-4) return 0;
  const maxS = (v * v) / (2 * a);
  if (dist >= maxS - 1e-3) return v / a;
  return (v - Math.sqrt(Math.max(0, v * v - 2 * a * dist))) / a;
}
function rollMeters(v, a, t) {
  if (!(v > 0) || !(a > 0) || !(t > 0)) return 0;
  const tt = Math.min(t, v / a);
  return v * tt - 0.5 * a * tt * tt;
}
function grassRollPace(shot) {
  const R = shot.flightR || shot.R || 0;
  const T = Math.max(0.35, shot.flightT || shot.T_ball || 0.35);
  const vHoriz = R / T;
  const launch = shot.launchAngle || 20;
  const exit = shot.exitSpeedKmh || 0;
  const onGrass = R > DIRT_EDGE_M;
  let retain = launch > 28 ? 0.32 : 0.44;
  let decel = onGrass ? 10.2 : 6.6;
  if (shot.spin === 'back') retain *= 1.04;
  else if (shot.spin === 'top') retain *= 0.9;
  else if (shot.spin === 'dead') { retain = 0.1; decel = onGrass ? 16 : 12; }
  if (exit >= 145 && launch <= 18 && shot.spin !== 'dead') {
    retain = Math.max(retain, 0.6);
    decel = 6.4;
  } else if (R >= 98 && shot.spin !== 'dead') {
    retain = Math.max(retain, 0.42);
    decel = Math.min(decel, 4.2);
  } else if (exit < 128 && R < 86) decel += 1.6;
  let vB = Math.max(shot.spin === 'dead' ? 1.0 : 3.4, vHoriz * retain);
  if (vB > 18.5) vB = 18.5;
  return { vB: vB, decel: decel };
}
function planHop(shot, f) {
  const T = shot.flightT || shot.T_ball;
  const Lx = shot.targetX, Ly = shot.targetY;
  const dirx = Math.sin(shot.sprayRad), diry = Math.cos(shot.sprayRad);
  const pace = grassRollPace(shot);
  const vB = pace.vB, decel = pace.decel;
  const landR = Math.hypot(Lx, Ly) || (shot.flightR || shot.R || 0);
  const fenceGap = Math.max(0, FENCE_DIST - landR);
  const maxRoll = (vB * vB) / (2 * decel);
  const travel = fenceGap > 0.4 ? Math.min(maxRoll, fenceGap) : maxRoll;
  const hard = shot.spin !== 'dead' && ((shot.exitSpeedKmh || 0) >= 145 || landR >= 96);
  const canFence = hard && fenceGap > 1.2 && landR >= 68 && maxRoll >= fenceGap - 0.4;
  const fielders = [];
  activeFielders.forEach(function (of) { if (of && of.isOF) fielders.push(of); });
  if (f && fielders.indexOf(f) < 0) fielders.push(f);
  let meet = null;
  const steps = 18;
  for (let i = 1; i <= steps && !meet; i++) {
    const s = travel * (i / steps);
    const tB = T + rollClock(vB, decel, s);
    const x = Lx + dirx * s;
    const y = Ly + diry * s;
    for (let k = 0; k < fielders.length; k++) {
      const of = fielders[k];
      const tF = arriveTime(of, x, y);
      if (tF <= tB + 1e-4) {
        meet = { x: x, y: y, tBall: tB, tField: tF, meet: tB, hopDist: s, f: of };
        break;
      }
    }
  }
  if (!meet && canFence) {
    const tWall = T + rollClock(vB, decel, fenceGap);
    const vHit = Math.max(0, vB - decel * (tWall - T));
    const wallX = FENCE_DIST * dirx;
    const wallY = FENCE_DIST * diry;
    const reboundV = Math.max(3.6, Math.min(9.2, vHit * 0.5));
    const near = chaseBall(wallX, wallY, FENCE_DIST, { onlyOF: true });
    const rf = (near && near.bestF) || f;
    const read = cushionRead(rf ? rf.fld : 70);
    const recover = fenceRecover(rf ? rf.fld : 70);
    const maxBack = Math.min(14, 5 + reboundV * 0.65);
    let chosen = null;
    for (let i = 0; i <= 12; i++) {
      const s = maxBack * i / 12;
      const x = wallX - dirx * s;
      const y = wallY - diry * s;
      const tB = tWall + s / reboundV;
      const tF = rf ? arriveTime(rf, x, y) : tB;
      if (tF <= tB + 1e-4) { chosen = { x: x, y: y, tBall: tB, tField: tF }; break; }
    }
    if (!chosen) {
      const s = maxBack;
      const x = wallX - dirx * s;
      const y = wallY - diry * s;
      chosen = { x: x, y: y, tBall: tWall + s / reboundV, tField: rf ? arriveTime(rf, x, y) : tWall };
    }
    return {
      x: chosen.x, y: chosen.y, tBall: chosen.tBall, tField: chosen.tField,
      meet: Math.max(chosen.tBall, chosen.tField),
      hopDist: fenceGap, rollV: vB, rollA: decel, hitFence: true, f: rf,
      wallX: wallX, wallY: wallY, tWall: tWall, read: read, recover: recover
    };
  }
  if (!meet) {
    const s = travel;
    const x = Lx + dirx * s;
    const y = Ly + diry * s;
    const tB = T + rollClock(vB, decel, s);
    const tF = f ? arriveTime(f, x, y) : tB;
    meet = { x: x, y: y, tBall: tB, tField: tF, meet: Math.max(tB, tF), hopDist: s, f: f };
  }
  meet.rollV = vB;
  meet.rollA = decel;
  meet.hitFence = false;
  return meet;
}
function bestOutfieldMeet(shot) {
  const x0 = shot.targetX, y0 = shot.targetY;
  const x1 = shot.R * Math.sin(shot.sprayRad);
  const y1 = shot.R * Math.cos(shot.sprayRad);
  const t0 = shot.T_ball;
  const t1 = Math.max(t0 + 0.04, shot.T_roll || t0);
  let best = null;
  activeFielders.forEach(function (f) {
    if (!f.isOF) return;
    let chosen = null;
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      const x = x0 + (x1 - x0) * u;
      const y = y0 + (y1 - y0) * u;
      const tB = t0 + (t1 - t0) * u;
      const tF = arriveTime(f, x, y);
      if (tF <= tB + 1e-4) { chosen = { f: f, x: x, y: y, ballAt: tB, meet: tB, tField: tF }; break; }
    }
    if (!chosen) {
      const tF = arriveTime(f, x1, y1);
      chosen = { f: f, x: x1, y: y1, ballAt: t1, meet: Math.max(t1, tF), tField: tF };
    }
    if (!best || chosen.meet < best.meet - 1e-6 || (Math.abs(chosen.meet - best.meet) < 1e-6 && chosen.tField < best.tField)) best = chosen;
  });
  return best;
}
function copyStat(src, dst, keys) {
  if (!src || !dst) return;
  keys.forEach(function (k) {
    if (src[k] != null) dst[k] = src[k];
  });
}
function mirrorRoster(src, dst) {
  if (!src || !dst) return;
  const batKeys = ['pos', 'type', 'rct', 'spd', 'ang', 'con', 'pow', 'fld', 'launch', 'ovr'];
  const armKeys = ['spd', 'ctrl', 'stuff', 'brk', 'stm', 'mnt', 'ovr'];
  const n = Math.min((src.batters || []).length, (dst.batters || []).length);
  for (let i = 0; i < n; i++) copyStat(src.batters[i], dst.batters[i], batKeys);
  copyStat(src.pitcher, dst.pitcher, armKeys);
  (src.staff || []).forEach(function (arm, i) {
    if (dst.staff && dst.staff[i]) copyStat(arm, dst.staff[i], armKeys);
  });
  (src.bullpen || []).forEach(function (arm, i) {
    if (dst.bullpen && dst.bullpen[i]) copyStat(arm, dst.bullpen[i], armKeys);
  });
}
function batterHand(batter) {
  if (!batter) return 'R';
  if (batter.hand === 'L' || batter.hand === 'R') return batter.hand;
  const key = String(batter.cardId != null ? batter.cardId : (batter.id != null ? batter.id : ((batter.name || 'bat') + '|' + (batter.pos || ''))));
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 33 + key.charCodeAt(i)) % 9973;
  batter.hand = h % 10 < 3 ? 'L' : 'R';
  return batter.hand;
}
function pullSign(hand) { return hand === 'L' ? 1 : -1; }
function clampUnit(n) { return Math.max(-1, Math.min(1, n)); }
function rollDistance(gs, dirtC, grassC) {
  const v2 = gs * gs;
  if (v2 / dirtC <= DIRT_EDGE_M) return v2 / dirtC;
  return DIRT_EDGE_M + Math.max(0, v2 - dirtC * DIRT_EDGE_M) / grassC;
}
function tunedRollTime(gs, dist, dirtC, grassC) {
  const pace = Math.max(0.5, gs) * 0.46;
  if (dist <= DIRT_EDGE_M) return dist / pace * (dirtC / ROLL_REF);
  const tDirt = DIRT_EDGE_M / pace * (dirtC / ROLL_REF);
  const vEdge = Math.sqrt(Math.max(0.25, gs * gs - dirtC * DIRT_EDGE_M));
  return tDirt + Math.max(0, dist - DIRT_EDGE_M) / (vEdge * 0.46) * (grassC / ROLL_REF);
}
function spinKind(launchAngle, slowRoll) {
  if (launchAngle >= 45 || slowRoll) return 'dead';
  if (launchAngle >= 15 && launchAngle <= 32) return 'back';
  if (launchAngle >= 0 && launchAngle < 10) return 'top';
  return 'flat';
}
function contactPlane(batter, effCtrl, effStuff) {
  const pa = batter._pa || null;
  const con = pa && pa.con != null ? pa.con : batter.con;
  const rct = pa && pa.rct != null ? pa.rct : batter.rct;
  const effSpd = pa && pa.effSpd != null ? pa.effSpd : 70;
  const press = (effStuff - con) * 0.52 + (effCtrl - con) * 0.28;
  const xOffset = clampUnit(randNormal(press / 46, 0.22));
  let yOffset = clampUnit(randNormal((effSpd - rct) * 0.42 / 40, 0.2));
  const kick = pa && pa.seqKick ? pa.seqKick : 0;
  if (kick > 0) yOffset = clampUnit(yOffset + (Math.random() < 0.5 ? -kick : kick));
  return { xOffset: xOffset, yOffset: yOffset };
}
function applyPullShift(batter) {
  if (!batter || batter.pow < 82 || !activeFielders.length) return 0;
  const pull = pullSign(batterHand(batter));
  const step = 2 + Math.random() * 0.5;
  activeFielders.forEach(function (f) {
    if (f.pos === 'C' || f.pos === 'P') return;
    const dx = pull * (f.isOF ? step : step * 0.85);
    f.x += dx;
    f.homeX += dx;
    f.goalX += dx;
  });
  return step;
}
function pickWeighted(rows) {
  let sum = 0;
  for (let i = 0; i < rows.length; i++) sum += rows[i].w;
  let r = Math.random() * sum;
  for (let i = 0; i < rows.length; i++) {
    r -= rows[i].w;
    if (r <= 0) return rows[i];
  }
  return rows[rows.length - 1];
}
function virtualCount(outcome) {
  let row;
  if (outcome === 'bb') row = pickWeighted([{ b: 3, s: 0, w: 22 }, { b: 3, s: 1, w: 40 }, { b: 3, s: 2, w: 38 }]);
  else if (outcome === 'k') row = pickWeighted([{ b: 0, s: 2, w: 18 }, { b: 1, s: 2, w: 34 }, { b: 2, s: 2, w: 30 }, { b: 3, s: 2, w: 18 }]);
  else row = pickWeighted([
    { b: 0, s: 0, w: 8 }, { b: 1, s: 0, w: 7 }, { b: 2, s: 0, w: 6 }, { b: 3, s: 1, w: 5 },
    { b: 0, s: 1, w: 8 }, { b: 1, s: 1, w: 10 }, { b: 2, s: 1, w: 8 }, { b: 3, s: 2, w: 6 },
    { b: 0, s: 2, w: 7 }, { b: 1, s: 2, w: 8 }, { b: 2, s: 2, w: 7 }
  ]);
  return {
    balls: row.b, strikes: row.s,
    hitter: (row.b === 2 && row.s === 0) || (row.b === 3 && row.s === 1),
    pitcher: row.s === 2 && row.b <= 1,
    full: row.b === 3 && row.s === 2
  };
}
function chargeCount(pit, count, outcome) {
  if (!pit || !count) return '';
  let pitches = count.balls + count.strikes + 1;
  let extra = 0;
  if (count.full) {
    pitches += 1;
    extra = outcome === 'bb' ? 0.55 : 0.32;
  }
  let cut = '';
  if (outcome === 'bip' && count.pitcher && Math.random() < 0.62) {
    const n = Math.random() < 0.38 ? 2 : 1;
    pitches += n;
    extra += n * 0.18;
    cut = '2스트라이크 이후 파울 ' + n + '개 커트';
  }
  pit.pitches = (pit.pitches || 0) + pitches;
  if (extra) pit.stamina = Math.max(8, pit.stamina - extra);
  return cut;
}
function countLead(count, cut, outcome) {
  if (!count) return '';
  let s = '카운트 ' + count.balls + '-' + count.strikes;
  if (count.full) s += ' 풀카운트';
  else if (outcome === 'bip' && count.hitter) s += ' 타자 유리';
  else if (outcome === 'bip' && count.pitcher) s += ' 투수 유리';
  else if (outcome === 'k' && count.pitcher) s += ' 투수 유리';
  if (cut) s += ' · ' + cut;
  return '[' + s + '] ';
}
function noteFamiliarity(batter, pit) {
  if (!batter || !pit) return { bonus: 0, look: 1 };
  if (!pit.seen) pit.seen = {};
  const key = String(batter.cardId != null ? batter.cardId : (batter.id != null ? batter.id : ((batter.name || 'b') + '|' + (batter.pos || ''))));
  const prev = pit.seen[key] || 0;
  pit.seen[key] = prev + 1;
  if (prev <= 0) return { bonus: 0, look: 1 };
  const raw = prev === 1 ? 1 : Math.min(2.5, 1.55 + (prev - 2) * 0.45);
  const mnt = pit.mnt == null ? 70 : pit.mnt;
  const bonus = Math.max(0, raw - Math.max(0, (mnt - 70) * 0.085));
  return { bonus: bonus, look: prev + 1 };
}
function sequenceEdge(pit, effSpd, effCtrl) {
  const kind = pickPitchKind(pit);
  const family = kind === 'fast' ? 'fast' : 'off';
  const changed = !!(pit.lastFamily && pit.lastFamily !== family);
  pit.lastFamily = family;
  pit._pitchKind = kind;
  if (!changed) return { kAdd: 0, kick: 0, show: false };
  const gear = Math.max(0, Math.min(1, (
    Math.max(0, effSpd - 68) * 0.45 +
    Math.max(0, effCtrl - 68) * 0.35 +
    Math.max(0, (pit.brk || 70) - 68) * 0.4
  ) / 28));
  return { kAdd: 0.003 + gear * 0.011, kick: 0.05 + gear * 0.18, show: gear >= 0.45 };
}
function launchBattedBall(batter, pit, effCtrl, effStuff, forceFair) {
  const pa = batter._pa || null;
  const con = pa && pa.con != null ? pa.con : batter.con;
  const pow = pa && pa.pow != null ? pa.pow : batter.pow;
  const launch0 = batter.launch != null ? batter.launch : 12;
  const conGap = Math.max(0, effStuff - con);
  const spread = Math.max(9, 21.1 + conGap * 0.16 + Math.max(0, 70 - con) * 0.32);
  let launchAngle = randNormal(launch0 - (pit.brk - 70) * 0.12, spread);
  let slowRoll = false;
  const mishitP = conGap * 0.0015 + Math.max(0, 66 - con) * 0.0066;
  if (mishitP > 0 && Math.random() < mishitP) {
    if (Math.random() < 0.5) launchAngle = 70 + Math.random() * 10;
    else { launchAngle = Math.random() * 4; slowRoll = true; }
  }
  const bns = Math.max(0, (pow - effStuff) / 40);
  if (bns > 0) {
    if (launchAngle >= 40 && launchAngle <= 52) launchAngle += (26 - launchAngle) * Math.min(1, bns);
    else if (launchAngle >= 3 && launchAngle <= 5) { launchAngle += (9 - launchAngle) * Math.min(1, bns); slowRoll = false; }
  }
  launchAngle = Math.max(-15, Math.min(80, launchAngle));
  const plane = contactPlane(batter, effCtrl, effStuff);
  let contact = '';
  if (plane.xOffset <= -0.48) {
    contact = 'eaten';
    launchAngle = 19 + Math.random() * 13;
    slowRoll = false;
  } else if (plane.xOffset >= 0.48) {
    contact = 'pushed';
  } else if (Math.abs(plane.xOffset) <= 0.14) {
    contact = 'barrel';
    if (launchAngle > 38 && launchAngle < 52) launchAngle += (27 - launchAngle) * 0.28;
  }
  if (pa && pa.countPitcher && launchAngle > 22 && launchAngle < 40) launchAngle -= 2.2;
  const angleEff = (launchAngle >= 10 && launchAngle <= 22) ? 1.0 : (launchAngle > 22 && launchAngle <= 35) ? 0.95 : (launchAngle >= 0 && launchAngle < 10) ? 0.88 : (launchAngle > 35 && launchAngle <= 50) ? 0.82 : 0.70;
  const level = (pow + effStuff) / 2;
  const delta = level - 70;
  const skew = delta >= 0 ? delta * TUNE.up : delta * TUNE.down;
  let exitSpeedKmh = Math.max(58, Math.min(165, (146.6 + (pow - effStuff) * TUNE.gap + skew + (Math.random() * 10 - 5)) * angleEff));
  if (contact === 'eaten') exitSpeedKmh = Math.max(70, exitSpeedKmh * (0.62 + (plane.xOffset + 1) * 0.1));
  else if (contact === 'pushed') exitSpeedKmh *= 0.88;
  else if (contact === 'barrel') exitSpeedKmh = Math.min(165, exitSpeedKmh + 1.2);
  if (pa && pa.countHitter) exitSpeedKmh = Math.min(165, exitSpeedKmh + 1.8);
  if (pa && pa.countPitcher) exitSpeedKmh *= 0.992;
  const hand = batterHand(batter);
  const pull = pullSign(hand);
  let sprayAngle = forceFair ? (Math.random() * 90 - 45) : (Math.random() * 102 - 51);
  let timing = plane.yOffset;
  if (batter.con >= 78 && batter.pow < 78) timing *= 0.45;
  sprayAngle += (-timing) * 15 * pull;
  if (contact === 'pushed') sprayAngle += -pull * (10 + plane.xOffset * 8);
  if (batter.pow >= 78) {
    const lean = batter.con >= 78 ? 3.5 : 6.5 + Math.max(0, batter.pow - 78) * 0.35;
    sprayAngle += pull * lean;
  }
  if (batter.pow >= 78 && sprayAngle * pull > 6) exitSpeedKmh = Math.min(165, exitSpeedKmh + 3);
  if (launchAngle >= 10 && game.wind && !forceFair) sprayAngle += game.wind.cross * game.wind.ms * 0.55;
  if (forceFair) sprayAngle = Math.max(-44, Math.min(44, sprayAngle));
  const v0 = exitSpeedKmh / 3.6, rad = launchAngle * Math.PI / 180, vx = v0 * Math.cos(rad), vy = v0 * Math.sin(rad);
  const spin = spinKind(launchAngle, slowRoll);
  let R = 0, T_ball = 0, T_roll = 0, maxH = 0, g_eff = null, isGrounder = launchAngle < 10;
  if (isGrounder) {
    let retain = slowRoll ? 0.52 : 0.82;
    let dirtC = DIRT_DECEL;
    let grassC = GRASS_DECEL;
    if (spin === 'top' && exitSpeedKmh >= 138) {
      retain = 0.86;
      dirtC *= 0.9;
    }
    if (slowRoll) { dirtC = 9.4; grassC = 12; }
    const gs = Math.max(6, vx * retain);
    R = Math.min(85, rollDistance(gs, dirtC, grassC));
    const cap = Math.min(R, 33);
    T_ball = cap < 33 ? cap / (gs * 0.5) : 33 / gs;
    if (spin === 'top' && exitSpeedKmh >= 148) T_ball *= 0.96;
    T_roll = tunedRollTime(gs, R, dirtC, grassC);
    if (T_roll < T_ball) T_roll = T_ball;
    maxH = slowRoll ? 0.25 : (spin === 'top' ? 0.42 : 0.5);
  } else {
    g_eff = 9.2;
    let k_drag = 0.82;
    if (launchAngle > 20 && launchAngle <= 35) { g_eff = 8.1; k_drag = 0.67; }
    else if (launchAngle > 35) { g_eff = 8.8; k_drag = 0.58 * Math.cos(Math.max(0, launchAngle - 40) * Math.PI / 180); }
    T_ball = (vy + Math.sqrt(vy * vy + 2 * g_eff)) / g_eff;
    R = vx * T_ball * k_drag;
    maxH = 1.0 + (vy * vy) / (2 * g_eff);
    if (game.wind) R *= 1 + game.wind.carry * game.wind.ms * 0.0045;
  }
  R = Math.max(0.5, R);
  const sprayRad = sprayAngle * Math.PI / 180;
  const interceptR = isGrounder ? Math.min(R, 33) : R;
  let detail = '';
  if (contact === 'eaten') detail = '배트 손잡이에 맞혀 띄웠습니다. ';
  else if (contact === 'pushed') detail = '배트 끝에 걸려 밀렸습니다. ';
  else if (spin === 'top' && exitSpeedKmh >= 138) detail = '탑스핀이 걸려 내야를 뚫습니다. ';
  else if (spin === 'dead' && launchAngle >= 45) detail = '회전 없이 떨어져 거의 굴러가지 않습니다. ';
  return {
    launchAngle: launchAngle, slowRoll: slowRoll, exitSpeedKmh: exitSpeedKmh, R: R, T_ball: T_ball, T_roll: T_roll || T_ball, maxH: maxH,
    isGrounder: isGrounder, sprayAngle: sprayAngle, sprayRad: sprayRad, interceptR: interceptR,
    targetX: interceptR * Math.sin(sprayRad), targetY: interceptR * Math.cos(sprayRad),
    h0: 1, vy: isGrounder ? 0 : vy, gEff: g_eff, flightR: R, flightT: T_ball,
    foul: !forceFair && Math.abs(sprayAngle) > 45,
    spin: spin, xOffset: plane.xOffset, yOffset: plane.yOffset, contact: contact, detail: detail, hand: hand
  };
}
function makeBall(shot, showTail, fumble) {
  const landX = shot.animLandX != null ? shot.animLandX : shot.targetX;
  const landY = shot.animLandY != null ? shot.animLandY : shot.targetY;
  const viewT = shot.animT != null ? shot.animT : shot.T_ball;
  const rollX = shot.targetX, rollY = shot.targetY;
  const rolls = !!((shot.hops || shot.isGrounder) && (shot.T_roll || 0) > viewT + 0.01 && Math.hypot(rollX - landX, rollY - landY) > 0.4);
  return {
    curX: 0, curY: 0, curH: 0, targetX: shot.targetX, targetY: shot.targetY,
    landX: landX, landY: landY, rollX: rollX, rollY: rollY, rolls: rolls,
    finalX: shot.R * Math.sin(shot.sprayRad), finalY: shot.R * Math.cos(shot.sprayRad),
    maxH: shot.maxH, isGrounder: shot.isGrounder, elapsed: 0,
    T_ball: viewT, T_roll: shot.T_roll || viewT, totalTime: viewT,
    h0: shot.h0, vy: shot.vy, gEff: shot.gEff, hops: !!shot.hops, hopH: shot.hopH || 0.85,
    rollV: shot.rollV || 0, rollA: shot.rollA || 0,
    showTail: showTail, exitKmh: shot.exitSpeedKmh, distance: shot.R, fumble: !!fumble,
    bounceBack: shot.bounceBack || null, kick: shot.kick || null,
    trail: [], windup: 0, started: false, fieldAt: null, holder: null
  };
}
function wallRob(f, shot) {
  if (!f || !f.isOF || !shot || shot.isGrounder) return false;
  if (shot.R < FENCE_DIST || shot.R > FENCE_DIST + 3.2) return false;
  if ((f.fld + f.spd) / 2 < 78) return false;
  const scale = FENCE_DIST / shot.R;
  const fenceT = shot.T_ball * scale;
  return arriveTime(f, shot.targetX * scale, shot.targetY * scale) <= fenceT - 0.06;
}
function advanceRunners(basesToMove, batterObj, isWalk, removeSecond) {
  let runs = 0;
  const nextBases = [null, null, null];
  const animList = [{ startIdx: 0, targetIdx: Math.min(4, basesToMove), speed: runMetersPerSec(batterObj.spd) }];

  if (isWalk) {
    if (game.bases[0] && game.bases[1] && game.bases[2]) {
      runs++; animList.push({ startIdx: 3, targetIdx: 4, speed: runMetersPerSec(game.bases[2].spd) });
    }
    if (game.bases[0] && game.bases[1]) {
      nextBases[2] = game.bases[1]; animList.push({ startIdx: 2, targetIdx: 3, speed: runMetersPerSec(game.bases[1].spd) });
    } else if (game.bases[2]) nextBases[2] = game.bases[2];
    if (game.bases[0]) {
      nextBases[1] = game.bases[0]; animList.push({ startIdx: 1, targetIdx: 2, speed: runMetersPerSec(game.bases[0].spd) });
    }
    nextBases[0] = batterObj;
  } else {
    for (let i = 2; i >= 0; i--) {
      const r = game.bases[i];
      if (!r) continue;
      if (removeSecond && i === 1) {
        animList.push({ startIdx: 2, targetIdx: 4, speed: runMetersPerSec(r.spd) });
        continue;
      }
      let dest = i + 1 + basesToMove;
      if (dest >= 4) { runs++; animList.push({ startIdx: i + 1, targetIdx: 4, speed: runMetersPerSec(r.spd) }); }
      else { nextBases[dest - 1] = r; animList.push({ startIdx: i + 1, targetIdx: dest, speed: runMetersPerSec(r.spd) }); }
    }
    if (basesToMove >= 4) runs++;
    else nextBases[basesToMove - 1] = batterObj;
  }
  game.bases = nextBases;
  return { runs: runs, animList: animList };
}
function throwOutAtHome(fielder, ballX, ballY, tBall) {
  const runner = game.bases[1];
  if (!runner || !fielder) return false;
  const release = (tBall || 0) + 0.32;
  const flight = throwFlight(fielder, ballX, ballY, 0, 0);
  const plan = baserunPlan(runner, 2, 4, { pit: defensePitcher(), dropAt: tBall, fly: true });
  const tRun = arriveMeters(plan, 2 * JUDGE_BASE_M);
  const j = judgeContest(tRun, release + flight.dur + tagSlack(runner), runner, fielder.fld, { force: false });
  return !!(j.go && j.out);
}

function checkInningChange() {
  if (game.outs >= 3) {
    noteNoHitWatch();
    game.outs = 0; game.bases = [null, null, null];
    if (game.away.pitcher) game.away.pitcher.innRuns = 0;
    if (game.home.pitcher) game.home.pitcher.innRuns = 0;
    if (game.isTop) {
      if (game.inning >= 9 && game.home.score > game.away.score) {
        game.isOver = true;
        noteNoHitterFinal();
        return '🏆 경기 종료! 홈팀 승리!';
      }
      game.isTop = false;
    } else {
      if (game.inning >= 9 && game.home.score !== game.away.score) {
        game.isOver = true;
        noteNoHitterFinal();
        return game.home.score > game.away.score ? '🏆 경기 종료! 홈팀 승리!' : '🏆 경기 종료! 원정팀 승리!';
      }
      game.inning++; game.isTop = true;
    }
    setupDefenseFielders();
    return '🔄 공수 교대! ' + game.inning + '회' + (game.isTop ? '초' : '말');
  }
  if (!game.isTop && game.inning >= 9 && game.home.score > game.away.score) {
    game.isOver = true;
    game.walkoff = true;
    noteNoHitterFinal();
    spawnCelebrate();
    playCaption = { text: '끝내기 승리!', bad: false };
    return '🎉 9회말 끝내기 승리! 홈팀 우승!';
  }
  return '';
}
function spawnCelebrate() {
  celebrate = { parts: [] };
  const w = canvas.width || 800;
  const h = canvas.height || 600;
  for (let i = 0; i < 48; i++) {
    celebrate.parts.push({
      x: w * (0.2 + Math.random() * 0.6),
      y: h * 0.42,
      vx: (Math.random() - 0.5) * 140,
      vy: -90 - Math.random() * 160,
      color: ['#ffd56a', '#ff5a5a', '#7dffa8', '#8fd0ff', '#fff'][i % 5]
    });
  }
}
function fielderBy(pos) {
  for (let i = 0; i < activeFielders.length; i++) if (activeFielders[i].pos === pos) return activeFielders[i];
  return null;
}
const BAG = { '1B': { x: 19.4, y: 19.4 }, '2B': { x: 0, y: 38.8 }, '3B': { x: -19.4, y: 19.4 }, HOME: { x: 0, y: 0 } };
function coverKeyForSecond(chaser, x) {
  let pos = (x || 0) >= 0 ? 'SS' : '2B';
  if (pos === chaser) pos = pos === 'SS' ? '2B' : 'SS';
  return pos;
}
function receiverFor(to, fromPos) {
  if (to === '1B') {
    if (fromPos === '1B' || (game && game._chaser === '1B')) return 'P';
    return '1B';
  }
  if (to === '2B') return coverKeyForSecond(fromPos, game && game._ballX);
  if (to === '3B') return '3B';
  if (to === 'HOME') return 'C';
  return null;
}
function bagTouchPending(clock) {
  if (!game || !game._needBag) return false;
  if (clock != null && clock < 0.12) return true;
  const f = fielderBy(game._needBag);
  if (!f) return false;
  return Math.hypot(f.x - 19.4, f.y - 19.4) > 0.7;
}
function queueThrow(spec) {
  const to = spec.to || null;
  let x1 = spec.x1, y1 = spec.y1;
  const wild = !!spec.wild;
  let arc = null;
  if (wild && to === '1B') {
    x1 = 46;
    y1 = 1.4;
    arc = { cx: 33, cy: 8 };
  } else if (to && BAG[to] && !wild) { x1 = BAG[to].x; y1 = BAG[to].y; }
  const toPos = spec.toPos || (to ? receiverFor(to, spec.from) : null);
  const dist1 = Math.hypot((spec.x0 || 0) - 19.4, (spec.y0 || 0) - 19.4);
  const carry = !!spec.carry || (spec.from === '1B' && to === '1B' && !wild && dist1 <= 6.5);
  if (carry && spec.from === '1B' && to === '1B' && !wild) {
    const fb = fielderBy('1B');
    const runDur = spec.carry && spec.dur > 0 ? spec.dur : Math.max(1e-4, dist1 / Math.max(0.1, moveSpeed(fb || { spd: 70 })));
    if (game) { game._tag1 = true; game._coverP = false; game._needBag = '1B'; }
    throwPlan.push({
      carry: true, to: '1B', from: '1B', toPos: '1B', x0: spec.x0, y0: spec.y0, x1: 19.4, y1: 19.4,
      needsCatch: spec.needsCatch !== false, release: spec.release, dur: runDur, arm: spec.arm, bounce: false
    });
    return;
  }
  if (game && to === '1B' && !wild) {
    if (spec.from === '1B' || spec.toPos === 'P') { game._coverP = true; game._tag1 = false; game._needBag = 'P'; }
    else game._needBag = '1B';
  }
  throwPlan.push({
    to: to, from: spec.from || null, toPos: toPos, x0: spec.x0, y0: spec.y0, x1: x1, y1: y1,
    bag: (to && BAG[to] && !wild) ? BAG[to] : null,
    wild: wild, cx: arc ? arc.cx : null, cy: arc ? arc.cy : null,
    needsCatch: spec.needsCatch !== false, carry: false,
    release: spec.release, dur: spec.dur, arm: spec.arm, bounce: !!spec.bounce
  });
}
function armCaption(text, mode) {
  captionGate = { text: text, bad: false, mode: mode, shown: false };
  playCaption = null;
}
function singleSide(x) {
  if (x < -12) return '좌전';
  if (x > 12) return '우전';
  return '중전';
}
function throwInAir(clock) {
  if (!throwSeq.length) return false;
  const last = throwSeq[throwSeq.length - 1];
  return clock < last.t0 + last.dur;
}
function maybeCaption(clock) {
  if (!captionGate || captionGate.shown) return;
  if (captionGate.mode === 'safe1' || captionGate.mode === 'after') {
    if (throwPlan.length || throwInAir(clock)) return;
  }
  if (captionGate.mode === 'safe1') {
    let safe = false;
    for (let i = 0; i < runnersAnim.length; i++) {
      const r = runnersAnim[i];
      if (r.startIdx === 0 && r.curIdx >= 1) safe = true;
    }
    if (!safe) return;
  }
  playCaption = { text: captionGate.text, bad: false };
  captionGate.shown = true;
  captionHoldUntil = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 820;
}
function catchHeld() {
  if (!glove || !glove.caught) return !glove;
  if (glove.holdUntilMs && (typeof performance !== 'undefined' ? performance.now() : Date.now()) < glove.holdUntilMs) return false;
  return true;
}
function visualsDone(clock) {
  if (clock > 16) return true;
  if (throwPlan.length || throwInAir(clock)) return false;
  if (glove && !glove.caught) return false;
  if (!catchHeld()) return false;
  if (bagTouchPending(clock)) return false;
  if (captionGate && !captionGate.shown) return false;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (captionHoldUntil && now < captionHoldUntil) return false;
  return true;
}
function markCatch(f, clock) {
  f.x = glove.x; f.y = glove.y;
  glove.caught = true;
  glove.at = clock;
  if (glove.air) glove.holdUntilMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 500;
  if (throwPlan[0] && throwPlan[0].carry) { f.goalX = throwPlan[0].x1; f.goalY = throwPlan[0].y1; }
}
function pumpDefense(clock) {
  presentPlay(clock);
}
function setGoals(chaserPos, tx, ty, mode) {
  if (game) {
    game._chaser = chaserPos || '';
    game._ballX = tx || 0;
    if (chaserPos) game._catch = { pos: chaserPos, x: tx, y: ty, air: mode === 'fly' };
  }
  activeFielders.forEach(function (f) {
    if (f.react == null) f.react = startDelay(f);
    f.isTarget = f.pos === chaserPos;
    f.goalX = f.homeX;
    f.goalY = f.homeY;
  });
  const chaser = chaserPos ? fielderBy(chaserPos) : null;
  if (chaser) { chaser.goalX = tx; chaser.goalY = ty; }
  const fb = fielderBy('1B'), sb = fielderBy('2B'), ss = fielderBy('SS'), tb = fielderBy('3B'), mound = fielderBy('P');
  const tag1 = game && game._tag1;
  const coverP = game && game._coverP;
  if (mode === 'ground' || mode === 'dp' || mode === 'home') {
    if (mound && !mound.isTarget && (coverP || chaserPos === '1B')) {
      stampCoverLag(mound);
      mound.goalX = 19.4;
      mound.goalY = 19.4;
      if (coverP) mound.isTarget = true;
    } else if (fb && !fb.isTarget && !tag1) {
      fb.goalX = 19.4; fb.goalY = 19.4;
    }
    if (mode === 'dp') {
      if (game && game._selfPivot) {
        const other = game._selfPivot === '2B' ? ss : sb;
        if (other && !other.isTarget) { other.goalX = game._selfPivot === '2B' ? -4 : 6; other.goalY = 34; }
      } else {
        const pivot = chaserPos === '2B' || chaserPos === '1B' ? ss : sb;
        if (pivot && !pivot.isTarget) { pivot.goalX = 0; pivot.goalY = 38.8; }
      }
    } else if (mode !== 'home') {
      if (sb && !sb.isTarget) { sb.goalX = 3; sb.goalY = 34; }
      if (ss && !ss.isTarget) { ss.goalX = -6; ss.goalY = 32; }
    }
    if (tb && !tb.isTarget) { tb.goalX = -19.4; tb.goalY = 19.4; }
    if (game && game._sac3 && tb && tb.isTarget) {
      const cover3 = (ss && !ss.isTarget) ? ss : ((mound && !mound.isTarget) ? mound : null);
      if (cover3) { cover3.goalX = -19.4; cover3.goalY = 19.4; }
    }
    if (mound && !mound.isTarget && !tag1 && Math.abs(mound.goalX - mound.homeX) < 0.01) { mound.goalX = 8; mound.goalY = 16; }
    ['LF', 'CF', 'RF'].forEach(function (pos) {
      const f = fielderBy(pos);
      if (!f || f.isTarget) return;
      f.goalX = f.homeX * 0.78;
      f.goalY = f.homeY * 0.82;
    });
  } else if (mode === 'relay2' || ((mode === 'fly' || mode === 'hit') && game && game._relay)) {
    const relay = game && game._relay;
    if (relay && relay.spot) {
      const cutF = fielderBy(relay.cutId);
      const bagKey = relay.baseKey || '2B';
      const bag = bagPoint(bagKey);
      const bagPos = bagKey === 'HOME' ? 'C' : (bagKey === '3B' ? '3B' : relay.bagId);
      const bagF = fielderBy(bagPos);
      if (cutF && !cutF.isTarget) { cutF.goalX = relay.spot.x; cutF.goalY = relay.spot.y; }
      if (bagF && !bagF.isTarget) { bagF.goalX = bag.x; bagF.goalY = bag.y; }
    } else if (mode === 'relay2') {
      const who = coverKeyForSecond(chaserPos, tx);
      const cover = fielderBy(who);
      if (cover && !cover.isTarget) { cover.goalX = 0; cover.goalY = 38.8; }
    }
    if (fb && !fb.isTarget) { fb.goalX = 16; fb.goalY = 22; }
  } else if (mode === 'fly' || mode === 'hit') {
    if (fb && !fb.isTarget) { fb.goalX = 16; fb.goalY = 24; }
    if (tb && !tb.isTarget) { tb.goalX = -16; tb.goalY = 22; }
    ['LF', 'CF', 'RF'].forEach(function (pos) {
      const f = fielderBy(pos);
      if (!f || f.isTarget) return;
      f.goalX = f.homeX * 0.72;
      f.goalY = f.homeY * 0.76;
    });
  } else if (mode === 'steal') {
    const cover = sb || ss;
    if (cover) { cover.isTarget = true; cover.goalX = 0; cover.goalY = 38.8; }
    if (ss && cover && ss !== cover) { ss.goalX = -4; ss.goalY = 34; }
  } else if (mode === 'pick') {
    if (fb) { fb.isTarget = true; fb.goalX = 19.4; fb.goalY = 19.4; }
  }
  applyOrganicBackups(chaserPos, tx, ty, mode);
  advanceDeepCutoff(tx, ty, mode);
  stampLegs();
}
function markDeepBall(shot) {
  if (!game) return;
  if (!shot || shot.isGrounder) { game._deepBall = false; return; }
  const land = Math.hypot(shot.targetX || 0, shot.targetY || 0);
  game._deepBall = (shot.R || 0) >= 75 || land >= 75;
}
function advanceDeepCutoff(tx, ty, mode) {
  const depth = Math.hypot(tx || 0, ty || 0);
  const deep = depth >= 75 || !!(game && game._deepBall);
  if (!deep) return;
  if ((mode === 'ground' || mode === 'dp' || mode === 'home' || mode === 'pick' || mode === 'steal' || mode === 'block') && depth < 75) return;
  const relay = game && game._relay;
  const baseKey = (relay && relay.baseKey) || '2B';
  const pair = relayPair(tx, (game && game._chaser) || '');
  const cutId = (relay && relay.cutId) || pair.cut;
  const bagId = (relay && relay.bagId) || pair.bag;
  const cut = fielderBy(cutId);
  const base = bagPoint(baseKey);
  const spot = (relay && relay.spot) || (cut ? cutoffSpot(tx, ty, base, cut.fld) : null);
  if (cut && !cut.isTarget && spot) {
    cut.goalX = spot.x;
    cut.goalY = spot.y;
  }
  const bagPos = baseKey === 'HOME' ? 'C' : (baseKey === '3B' ? '3B' : bagId);
  const bagF = fielderBy(bagPos);
  if (bagF && !bagF.isTarget && bagF !== cut) {
    bagF.goalX = base.x;
    bagF.goalY = base.y;
  }
}
function legKey(x, y) {
  return (Math.round((x || 0) * 100) / 100) + ',' + (Math.round((y || 0) * 100) / 100);
}
function placeFielder(f, t) {
  if (!f || f.departAt == null) return;
  if (f.relayLeg && t + 1e-9 >= f.relayLeg.at) {
    const leg = f.relayLeg;
    f.relayLeg = null;
    placeFielder(f, leg.at);
    retargetFielder(f, leg.x, leg.y, leg.at);
  }
  if (t <= f.departAt) { f.x = f.ox; f.y = f.oy; return; }
  const dx = f.goalX - f.ox, dy = f.goalY - f.oy;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) { f.x = f.goalX; f.y = f.goalY; return; }
  const u = Math.min(1, (f.mps * (t - f.departAt)) / dist);
  f.x = f.ox + dx * u;
  f.y = f.oy + dy * u;
}
function placeFielders(t) {
  activeFielders.forEach(function (f) { placeFielder(f, t); });
}
function retargetFielder(f, gx, gy, t) {
  if (!f) return;
  const key = legKey(gx, gy);
  if (f.legKey === key) return;
  placeFielder(f, t);
  const wait = Math.max(0, (f.departAt || 0) - t);
  f.ox = f.x;
  f.oy = f.y;
  f.goalX = gx;
  f.goalY = gy;
  f.departAt = t + wait;
  f.mps = moveSpeed(f);
  f.legKey = key;
}
function stampLegs() {
  activeFielders.forEach(function (f) {
    if (f.react == null) f.react = startDelay(f);
    f.ox = f.x;
    f.oy = f.y;
    f.departAt = f.react;
    f.mps = moveSpeed(f);
    f.legKey = legKey(f.goalX, f.goalY);
  });
}
function moveFielders() {
  placeFielders(playElapsed);
}
function placeBall(t) {
  if (!ball) return;
  ball.elapsed = t;
  const tb = ball.T_ball > 0 ? ball.T_ball : 0.01;
  const landX = ball.landX, landY = ball.landY;
  let x = 0, y = 0, h = 0;
  if (ball.kick) {
    const k = ball.kick;
    if (t > 0 && t < k.tHit) {
      const u = t / Math.max(1e-4, k.tHit);
      x = k.x * u;
      y = k.y * u;
      h = Math.max(0, (k.z0 || 0.2) * (1 - u));
    } else if (t < k.tEnd) {
      const u = Math.max(0, Math.min(1, (t - k.tHit) / Math.max(1e-4, k.tEnd - k.tHit)));
      x = k.x + (k.fx - k.x) * u;
      y = k.y + (k.fy - k.y) * u;
      h = Math.sin(u * Math.PI) * k.z;
    } else {
      x = k.fx;
      y = k.fy;
      h = 0;
    }
  } else if (ball.bounceBack && t >= tb && t < ball.bounceBack.tWall) {
    const bb = ball.bounceBack;
    const span = Math.hypot(bb.wallX - landX, bb.wallY - landY);
    let u;
    if (ball.rollV > 0 && ball.rollA > 0) u = Math.max(0, Math.min(1, rollMeters(ball.rollV, ball.rollA, t - tb) / Math.max(0.05, span)));
    else u = (t - tb) / Math.max(1e-4, bb.tWall - tb);
    x = landX + (bb.wallX - landX) * u;
    y = landY + (bb.wallY - landY) * u;
    const hopT = 0.42;
    const dt = t - tb;
    h = dt < hopT ? Math.sin((dt / hopT) * Math.PI) * 0.62 : 0;
  } else if (ball.bounceBack && t >= ball.bounceBack.tWall && t < ball.bounceBack.tBack) {
    const bb = ball.bounceBack;
    const u = (t - bb.tWall) / Math.max(1e-4, bb.tBack - bb.tWall);
    x = bb.wallX + (bb.x - bb.wallX) * u;
    y = bb.wallY + (bb.y - bb.wallY) * u;
    h = Math.sin(Math.min(1, Math.max(0, u)) * Math.PI) * 1.35;
  } else if (ball.bounceBack && t >= ball.bounceBack.tBack) {
    x = ball.bounceBack.x;
    y = ball.bounceBack.y;
    h = 0;
  } else if (t > 0 && t < tb) {
    const p = t / tb;
    x = landX * p;
    y = landY * p;
    const z = ball.isGrounder ? null : flightZ(ball.vy, ball.gEff, ball.h0, t);
    h = ball.isGrounder ? Math.max(0, (1 - p) * 0.35) : (z == null ? Math.sin(p * Math.PI) * ball.maxH : z);
  } else if (t >= tb && ball.rolls && ball.T_roll > tb) {
    let u;
    if (ball.rollV > 0 && ball.rollA > 0) {
      const span = Math.hypot(ball.rollX - landX, ball.rollY - landY);
      u = Math.max(0, Math.min(1, rollMeters(ball.rollV, ball.rollA, t - tb) / Math.max(0.05, span)));
    } else u = Math.min(1, (t - tb) / (ball.T_roll - tb));
    x = landX + (ball.rollX - landX) * u;
    y = landY + (ball.rollY - landY) * u;
    if (ball.hops && ball.rollV > 0) {
      const hopT = Math.min(0.5, Math.max(0.22, (ball.T_roll - tb) * 0.28));
      const dt = t - tb;
      h = dt < hopT ? Math.sin((dt / hopT) * Math.PI) * (ball.hopH || 0.55) : 0;
    } else h = ball.hops ? Math.sin(Math.min(1, u) * Math.PI) * (ball.hopH || 0.85) : 0;
  } else if (t >= tb) {
    x = landX;
    y = landY;
    h = 0;
  }
  ball.curX = x;
  ball.curY = y;
  ball.curH = h;
  if (ball.showTail && t > 0 && t <= tb + 1e-6) {
    ball.trail.push([x, y]);
    if (ball.trail.length > 16) ball.trail.shift();
  }
}
const HALFWAY_M = JUDGE_BASE_M / 3;
const OVERRUN_M = 2.5;
const PASS_GAP_M = 3.5;
const ROUND_BULGE = 2.4;
const OVERRUN_LOOK = 0.32;
const TAG_ACT = 0.12;
const SLIDE_ACT = 0.08;

function dynamicLead(runner, pit) {
  const spd = runner ? (Number(runner.spd) || 70) : 70;
  const rct = runner ? (Number(runner.rct) || 70) : 70;
  const brk = pit ? (Number(pit.brk) || 70) : 70;
  const mnt = pit ? (Number(pit.mnt) || 70) : 70;
  let lead = 5.2 + (spd - 70) * 0.028 + (rct - 70) * 0.016 - ((brk + mnt) / 2 - 70) * 0.024;
  if (runner && runner._leadCut) lead -= runner._leadCut;
  if (lead < 4.2) lead = 4.2;
  if (lead > 6.2) lead = 6.2;
  return lead;
}
function gapReadDelay(runner) {
  const rct = Number(runner && runner.rct);
  const r = isNaN(rct) ? 70 : rct;
  if (r >= 90) return 0.1 - Math.min(10, r - 90) * 0.005;
  if (r <= 50) return 0.5;
  if (r <= 70) return 0.5 + (r - 50) * ((0.225 - 0.5) / 20);
  return 0.225 + (r - 70) * ((0.1 - 0.225) / 20);
}
function tagSlack(runner) {
  const rct = runner ? (Number(runner.rct) || 70) : 70;
  const spd = runner ? (Number(runner.spd) || 70) : 70;
  const hot = Math.max(0, Math.min(1, (Math.min(rct, spd) - 70) / 16));
  return TAG_ACT - hot * SLIDE_ACT;
}

// [절대 불변 원칙 제5조] 전 베이스 Δt 접전. 이 창·보너스·정지 확률은 지우거나 우회하지 않는다.
const CONTEST_EDGE = 0.15;
const FLD_ASSIST_MAX = 0.12;
const BASE_KEY = ['HOME', '1B', '2B', '3B', 'HOME'];

function clockTick(sec) {
  if (typeof sec !== 'number' || !isFinite(sec)) return sec;
  return Math.round(sec * 100) / 100;
}
function rctHoldRate(rct) {
  const raw = Number(rct);
  const r = isNaN(raw) ? 70 : raw;
  if (r <= 50) return 0.20;
  if (r >= 90) return 0.80;
  if (r <= 70) return 0.20 + (r - 50) * (0.30 / 20);
  return 0.50 + (r - 70) * (0.30 / 20);
}
function fldAssistCut(fld) {
  const raw = Number(fld);
  const f = isNaN(raw) ? 70 : raw;
  const cut = (f - 50) * (FLD_ASSIST_MAX / 40);
  if (cut <= 0) return 0;
  if (cut >= FLD_ASSIST_MAX) return FLD_ASSIST_MAX;
  return clockTick(cut);
}
function judgeContest(tRun, tDef, runner, fld, opts) {
  opts = opts || {};
  const tr = clockTick(tRun);
  const td = clockTick(tDef);
  const dt = clockTick(td - tr);
  const row = {
    dt: dt, tRun: tr, tDef: td, tLive: td, cut: 0,
    go: false, out: false, hold: false, assist: false, kind: 'hold', force: !!opts.force
  };
  if (!isFinite(tr) || !isFinite(td)) {
    row.hold = !opts.force;
    row.go = !!opts.force;
    row.out = !!opts.force;
    row.kind = opts.force ? 'out' : 'hold';
    return row;
  }
  if (dt > CONTEST_EDGE) {
    row.go = true;
    row.kind = 'safe';
    return row;
  }
  if (dt < -CONTEST_EDGE) {
    if (opts.force) {
      row.go = true;
      row.out = true;
      row.kind = 'out';
      return row;
    }
    row.hold = true;
    row.kind = 'hold';
    return row;
  }
  if (dt >= 0) {
    const cut = fldAssistCut(fld);
    const floor = opts.floor;
    let live = clockTick(td - cut);
    if (floor != null && isFinite(floor) && live < floor) live = clockTick(floor);
    const applied = clockTick(Math.max(0, td - live));
    row.cut = applied;
    row.tLive = live;
    row.go = true;
    row.out = live < tr;
    row.assist = row.out && applied > 0;
    row.kind = row.out ? (row.assist ? 'assist' : 'out') : 'safe';
    return row;
  }
  if (opts.force) {
    row.go = true;
    row.out = true;
    row.kind = 'out';
    return row;
  }
  const hold = Math.random() < rctHoldRate(runner && runner.rct);
  row.go = !hold;
  row.out = !hold;
  row.hold = hold;
  row.kind = hold ? 'read' : 'cs';
  return row;
}
function noteAdvanceOut(kind) {
  if (!game) return;
  const atk = game.isTop ? game.away : game.home;
  bump(atk, 'to', 1);
  if (kind === 'assist') bump(atk, 'assist', 1);
}
function noteSteal(safe, kind) {
  if (!game) return;
  const atk = game.isTop ? game.away : game.home;
  if (safe) bump(atk, 'sb', 1);
  else {
    bump(atk, 'cs', 1);
    bump(atk, 'to', 1);
    if (kind === 'assist') bump(atk, 'assist', 1);
  }
}
let pendingHomeDrop = null;
function resetHomeDrop() { pendingHomeDrop = null; }
function defenseRoute(who, x, y, release, base, fldFallback) {
  const key = BASE_KEY[Math.max(0, Math.min(4, base))];
  const fld = fldFallback == null ? (who ? who.fld : 70) : fldFallback;
  const route = who
    ? relayOrDirect(who, x, y, release, key)
    : {
      relay: null, baseKey: key, x: x, y: y, rel: release, fld: fld,
      t: throwArriveAt(base >= 4 ? 4 : base, x, y, release, fld, null)
    };
  if (base >= 4 && who && who.isOF && !route.relay) {
    if (!pendingHomeDrop || pendingHomeDrop.who !== who) {
      const flight = throwFlight(who, x, y, 0, 0);
      const drop = !!(flight.bounce && Math.random() < oneBounceMiss(fielderBy('C')));
      pendingHomeDrop = { who: who, flight: flight, drop: drop, charged: false };
    }
    route.rel = release;
    route.t = release + (pendingHomeDrop.drop ? 99 : pendingHomeDrop.flight.dur);
    route.dur = pendingHomeDrop.flight.dur;
    route.bounce = pendingHomeDrop.flight.bounce && !pendingHomeDrop.drop;
    route.drop = pendingHomeDrop.drop;
    route.arm = pendingHomeDrop.flight.arm;
    if (pendingHomeDrop.drop && !pendingHomeDrop.charged && game) {
      chargeError(game.isTop ? game.home : game.away);
      pendingHomeDrop.charged = true;
    }
  }
  return route;
}
function planTo(runner, from, dest, read, isOut) {
  const to = Math.max(from, dest);
  const plan = baserunPlan(runner, from, to, read);
  if (to - from >= 2) plan.roundM = ROUND_BULGE;
  if (!isOut && from === 0 && to === 1) plan.overrunM = OVERRUN_M;
  return plan;
}
function chainRunner(runner, from, minDest, maxDest, read, who, x, y, release, fldFallback, front) {
  let dest = from;
  let outBase = 0;
  let stop = null;
  let close2 = false;
  const cap = maxDest == null ? 4 : maxDest;
  const floor = minDest == null ? from : minDest;
  for (let base = from + 1; base <= cap; base++) {
    const plan = baserunPlan(runner, from, base, read);
    const meters = (base - from) * JUDGE_BASE_M;
    const tRun = front ? arriveBlocked(plan, meters, front) : arriveMeters(plan, meters);
    const route = defenseRoute(who, x, y, release, base, fldFallback);
    const forced = base <= floor;
    const tDef = route.t + (forced ? 0 : tagSlack(runner));
    const j = judgeContest(tRun, tDef, runner, route.fld, { force: forced });
    j.base = base;
    j.route = route;
    if (base === 2 && Math.abs(j.dt) <= CONTEST_EDGE + 1e-9 && j.go) close2 = true;
    stop = j;
    if (!j.go) break;
    dest = base;
    if (j.out) {
      outBase = base;
      break;
    }
  }
  const landed = outBase || dest;
  return {
    runner: runner, from: from, dest: outBase ? 0 : dest, outBase: outBase,
    stop: stop, close2: close2, plan: planTo(runner, from, landed, read, !!outBase),
    tEvent: stop ? stop.tRun : 0
  };
}
function queueContestThrow(who, spec) {
  if (!spec || !spec.route || !who) return;
  const route = spec.route;
  const cut = spec.judge && spec.judge.cut ? spec.judge.cut : 0;
  const key = route.baseKey || '2B';
  if (route.relay) {
    const relay = route.relay;
    queueThrow({
      from: who.pos, toPos: relay.cutId, x0: spec.x, y0: spec.y, x1: relay.spot.x, y1: relay.spot.y,
      release: spec.release, dur: relay.flight1, arm: relay.arm1
    });
    queueThrow({
      from: relay.cutId, to: key, toPos: key === 'HOME' ? 'C' : (key === '3B' ? '3B' : relay.bagId),
      x0: relay.spot.x, y0: relay.spot.y, release: route.rel - cut,
      arm: armMetersPerSec(relay.cut ? relay.cut.fld : route.fld)
    });
    if (game) game._relay = { cutId: relay.cutId, bagId: relay.bagId, spot: relay.spot, baseKey: key };
    return;
  }
  const bag = bagPoint(key);
  const dropped = !!route.drop;
  queueThrow({
    from: who.pos, to: key, x0: spec.x, y0: spec.y, x1: dropped ? 8 : bag.x, y1: dropped ? -4 : bag.y,
    release: route.rel - (dropped ? 0 : cut), dur: route.dur || Math.max(1e-4, route.t - route.rel),
    arm: route.arm || armMetersPerSec(route.fld), wild: dropped, bounce: !!route.bounce
  });
}
function baserunPlan(runner, from, to, read) {
  read = read || {};
  const pit = read.pit || defensePitcher();
  const plan = {
    startIdx: from,
    targetIdx: to,
    who: runner,
    speed: runMetersPerSec(runner ? runner.spd : 70),
    delay: from === 0 ? (read.batterDelay || 0) : 0,
    leadM: from > 0 ? dynamicLead(runner, pit) : 0
  };
  const two = !!read.twoOut;
  const flyHold = !!read.fly && !two && (from === 1 || from === 2);
  const groundHold = !!read.hold2 && !two && from === 2;
  const gapGo = !!read.uncatchable && !two && from > 0 && from === read.leadFrom;
  if (gapGo) {
    plan.delay = (plan.delay || 0) + gapReadDelay(runner);
  } else if ((flyHold || groundHold) && read.dropAt > 0.05) {
    plan.holdM = HALFWAY_M;
    plan.goAt = read.dropAt;
  }
  if (to - from >= 2) {
    plan.roundM = ROUND_BULGE;
    plan.topSpeed = topRunMetersPerSec(runner ? runner.spd : 70);
  }
  return plan;
}
function multiCruise(plan) {
  if (!plan || plan.retreat || !(plan.topSpeed > 0)) return false;
  if ((plan.targetIdx - plan.startIdx) < 2) return false;
  if (plan.holdM != null && plan.goAt != null) return false;
  return true;
}
function cruisePathSpeed(top) {
  const v1 = top > 1e-4 ? top : 1e-4;
  return v1 * JUDGE_BASE_M / (JUDGE_BASE_M + ROUND_STEP_M);
}
function timeAlong(plan, meters) {
  const v0 = plan.speed > 1e-4 ? plan.speed : 1e-4;
  const v1 = plan.topSpeed > 1e-4 ? plan.topSpeed : v0;
  const delay = plan.delay || 0;
  const lead = Math.max(0, plan.leadM || 0);
  const bag = JUDGE_BASE_M;
  const fromBox = plan.startIdx === 0 && lead < 0.4;
  const vEff = cruisePathSpeed(v1);
  if (fromBox) {
    const accelEnd = Math.min(bag, ACCEL_WINDOW_M);
    if (meters <= accelEnd) return delay + meters / v0;
    const tAccel = delay + accelEnd / v0;
    if (meters <= bag) return tAccel + (meters - accelEnd) / v1;
    const tBag = tAccel + (bag - accelEnd) / v1;
    return tBag + (meters - bag) / vEff;
  }
  if (meters <= bag) return delay + Math.max(0, meters - lead) / v0;
  const tBag = delay + Math.max(0, bag - lead) / v0;
  return tBag + (meters - bag) / vEff;
}
function metersAlong(plan, t) {
  const v0 = plan.speed > 1e-4 ? plan.speed : 1e-4;
  const v1 = plan.topSpeed > 1e-4 ? plan.topSpeed : v0;
  const delay = plan.delay || 0;
  const lead = Math.max(0, plan.leadM || 0);
  if (t <= delay) return lead;
  const bag = JUDGE_BASE_M;
  const fromBox = plan.startIdx === 0 && lead < 0.4;
  const vEff = cruisePathSpeed(v1);
  if (fromBox) {
    const accelEnd = Math.min(bag, ACCEL_WINDOW_M);
    const tAccel = delay + accelEnd / v0;
    if (t <= tAccel) return v0 * (t - delay);
    const tBag = tAccel + (bag - accelEnd) / v1;
    if (t <= tBag) return accelEnd + v1 * (t - tAccel);
    return bag + vEff * (t - tBag);
  }
  const tBag = delay + Math.max(0, bag - lead) / v0;
  if (t <= tBag) return lead + v0 * (t - delay);
  return bag + vEff * (t - tBag);
}
function travelCap(plan) {
  if (!plan) return 0;
  if (plan.retreat) return plan.holdM != null ? plan.holdM : (plan.leadM || 0);
  return Math.max(0, (plan.targetIdx - plan.startIdx) * JUDGE_BASE_M);
}
function arriveMeters(plan, meters) {
  if (!plan) return Infinity;
  if (plan.retreat) return Infinity;
  if (meters > travelCap(plan) + 1e-4) return Infinity;
  const spd = plan.speed > 1e-4 ? plan.speed : 1e-4;
  const delay = plan.delay || 0;
  const lead = plan.leadM || 0;
  if (meters <= lead) return 0;
  const hold = plan.holdM;
  const goAt = plan.goAt;
  if (hold != null && goAt != null && hold >= lead - 1e-6) {
    const tHold = delay + (hold - lead) / spd;
    if (meters <= hold) return delay + (meters - lead) / spd;
    if (goAt <= tHold) return delay + (meters - lead) / spd;
    return goAt + (meters - hold) / spd;
  }
  const t = multiCruise(plan) ? timeAlong(plan, meters) : delay + (meters - lead) / spd;
  if (plan.freezeAt != null && t > plan.freezeAt + 1e-6) return Infinity;
  return t;
}
function arriveBlocked(plan, meters, front) {
  const free = arriveMeters(plan, meters);
  if (!front || front.retreat) return free;
  const absNeed = plan.startIdx * JUDGE_BASE_M + meters;
  const spd = plan.speed > 1e-4 ? plan.speed : 1e-4;
  if (front.targetIdx >= 4) {
    const homeM = (4 - front.startIdx) * JUDGE_BASE_M;
    const tHome = arriveMeters(front, homeM);
    if (!isFinite(tHome)) return free;
    const openAbs = 4 * JUDGE_BASE_M - PASS_GAP_M;
    if (absNeed <= openAbs) {
      const needFront = absNeed + PASS_GAP_M - front.startIdx * JUDGE_BASE_M;
      const tClear = arriveMeters(front, needFront);
      return Math.max(free, isFinite(tClear) ? tClear : free);
    }
    return Math.max(free, tHome + (absNeed - openAbs) / spd);
  }
  const needFront = absNeed + PASS_GAP_M - front.startIdx * JUDGE_BASE_M;
  if (needFront <= (front.leadM || 0)) return free;
  const tClear = arriveMeters(front, needFront);
  if (!isFinite(tClear)) return Infinity;
  return Math.max(free, tClear);
}
function forwardMeters(r, t) {
  const spd = r.speed > 1e-4 ? r.speed : 1e-4;
  const delay = r.delay || 0;
  const lead = r.leadM || 0;
  const hold = r.holdM;
  const goAt = r.goAt;
  const hasHold = hold != null && goAt != null && hold >= lead - 1e-6;
  if (!hasHold) {
    if (r.retreat) {
      if (t <= delay) return lead;
      return Math.max(0, lead - spd * (t - delay));
    }
    if (multiCruise(r)) return metersAlong(r, t);
    return t <= delay ? lead : lead + spd * (t - delay);
  }
  const tHold = delay + Math.max(0, hold - lead) / spd;
  if (r.retreat) {
    if (t <= delay) return lead;
    if (goAt <= tHold) {
      if (t < goAt) return lead + spd * (t - delay);
      const at = goAt <= delay ? lead : lead + spd * (goAt - delay);
      return Math.max(0, at - spd * (t - goAt));
    }
    if (t < tHold) return lead + spd * (t - delay);
    if (t < goAt) return hold;
    return Math.max(0, hold - spd * (t - goAt));
  }
  if (goAt <= tHold) return t <= delay ? lead : lead + spd * (t - delay);
  if (t <= delay) return lead;
  if (t < tHold) return lead + spd * (t - delay);
  if (t < goAt) return hold;
  return hold + spd * (t - goAt);
}
function runnerDisplayMeters(r, t) {
  let tt = t;
  if (r.freezeAt != null && tt > r.freezeAt) tt = r.freezeAt;
  const dist = forwardMeters(r, tt);
  if (r.retreat) return Math.max(0, dist);
  const cap = Math.max(0, (r.targetIdx - r.startIdx) * JUDGE_BASE_M);
  if (!(r.overrunM > 0)) return Math.max(0, Math.min(cap, dist));
  if (dist <= cap) return Math.max(0, dist);
  const spd = r.speed > 1e-4 ? r.speed : 1e-4;
  const tBag = arriveMeters(r, cap);
  if (!isFinite(tBag) || tt <= tBag) return cap;
  const out = r.overrunM;
  const tFar = tBag + out / spd;
  const tBack = tFar + OVERRUN_LOOK;
  if (tt <= tFar) return cap + Math.min(out, spd * (tt - tBag));
  if (tt <= tBack) return cap + out;
  return Math.max(cap, cap + out - spd * (tt - tBack));
}
function retreatDone(r) {
  const spd = r.speed > 1e-4 ? r.speed : 1e-4;
  const delay = r.delay || 0;
  const lead = r.leadM || 0;
  const hold = r.holdM != null ? r.holdM : lead;
  const goAt = r.goAt != null ? r.goAt : delay;
  const tHold = delay + Math.max(0, hold - lead) / spd;
  let at;
  if (goAt <= tHold) at = goAt <= delay ? lead : lead + spd * (goAt - delay);
  else at = hold;
  return goAt + at / spd;
}
function overrunDone(r) {
  const bagM = Math.max(0, (r.targetIdx - r.startIdx) * JUDGE_BASE_M);
  const tBag = arriveMeters(r, bagM);
  if (!isFinite(tBag)) return 0;
  return tBag + OVERRUN_LOOK + 2 * (r.overrunM || 0) / (r.speed > 1e-4 ? r.speed : 1e-4);
}
function runnerSettledOwn(r, t, meters) {
  const need = Math.max(0, (r.targetIdx - r.startIdx) * JUDGE_BASE_M);
  if (r.freezeAt != null) return t + 1e-4 >= r.freezeAt;
  if (r.retreat) return t + 1e-4 >= retreatDone(r);
  if (r.overrunM > 0) return meters + 0.15 >= need && t + 1e-4 >= overrunDone(r);
  return meters + 0.2 >= need;
}
function rightNormal(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dy / len, y: -dx / len };
}
function pointAlong(startIdx, meters, roundM, targetIdx) {
  const a0 = Math.max(0, Math.min(4, startIdx));
  const dest = Math.max(a0, Math.min(4, targetIdx == null ? a0 : targetIdx));
  if (dest === a0) {
    const a = baseCoords[a0];
    const b = baseCoords[Math.min(4, a0 + 1)];
    const u = Math.max(0, meters) / JUDGE_BASE_M;
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, idx: a0 };
  }
  let remain = Math.max(0, meters);
  let idx = a0;
  while (idx < dest) {
    const a = baseCoords[idx];
    const b = baseCoords[idx + 1];
    const last = idx + 1 === dest;
    if (remain < JUDGE_BASE_M - 1e-4 || last) {
      const along = remain;
      const u = along / JUDGE_BASE_M;
      let x = a.x + (b.x - a.x) * u;
      let y = a.y + (b.y - a.y) * u;
      if (last && along > JUDGE_BASE_M) {
        const extra = along - JUDGE_BASE_M;
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        x = b.x + (dx / len) * extra;
        y = b.y + (dy / len) * extra;
      }
      if (roundM > 0 && dest - a0 >= 2) {
        const n = rightNormal(a.x, a.y, b.x, b.y);
        let bulge = 0;
        const w = 8;
        if (!last) {
          const toBag = JUDGE_BASE_M - Math.min(remain, JUDGE_BASE_M);
          if (toBag < w) bulge = Math.max(bulge, roundM * Math.sin(Math.PI * toBag / w));
        }
        if (idx > a0) {
          const fromBag = Math.min(remain, JUDGE_BASE_M);
          if (fromBag < w) bulge = Math.max(bulge, roundM * Math.sin(Math.PI * fromBag / w));
        }
        x += n.x * bulge;
        y += n.y * bulge;
      }
      const arrived = along >= JUDGE_BASE_M - 0.05;
      return { x: x, y: y, idx: arrived ? idx + 1 : idx };
    }
    remain -= JUDGE_BASE_M;
    idx++;
  }
  return { x: baseCoords[dest].x, y: baseCoords[dest].y, idx: dest };
}
function throwArriveAt(toBase, x, y, release, fld, durOverride) {
  if (durOverride != null) return release + durOverride;
  const bag = baseCoords[Math.max(0, Math.min(4, toBase))];
  return release + Math.hypot(bag.x - x, bag.y - y) / armMetersPerSec(fld);
}
function wantExtra() {
  return true;
}
function catcherRead(c) {
  const fld = c ? (Number(c.fld) || 70) : 70;
  const mnt = c && c.mnt != null ? Number(c.mnt) : (c ? (Number(c.rct) || 70) : 70);
  return (fld + mnt) / 2;
}
function occupyFlyRead(catchT, outsNow, skipFrom) {
  const pit = defensePitcher();
  const anim = [];
  let runs = 0;
  const two = outsNow >= 2;
  for (let i = 2; i >= 0; i--) {
    const r = game.bases[i];
    if (!r) continue;
    const from = i + 1;
    if (skipFrom && skipFrom[from]) continue;
    const speed = runMetersPerSec(r.spd);
    const lead = dynamicLead(r, pit);
    if (two) {
      const homeM = (4 - from) * JUDGE_BASE_M - lead;
      const homeT = homeM / speed;
      if (homeT <= catchT + 1e-9) {
        runs++;
        game.bases[i] = null;
        anim.push({
          startIdx: from, targetIdx: 4, speed: speed, delay: 0, leadM: lead, who: r,
          roundM: (4 - from) >= 2 ? ROUND_BULGE : 0
        });
      } else {
        anim.push({
          startIdx: from, targetIdx: Math.min(4, from + 1), speed: speed, delay: 0, leadM: lead, who: r, freezeAt: catchT
        });
      }
    } else if (from === 3) {
      anim.push({
        startIdx: 3, targetIdx: 3, speed: speed, delay: 0, leadM: Math.min(lead, 3.6), who: r,
        holdM: Math.min(6, HALFWAY_M), goAt: catchT, retreat: true
      });
    } else {
      anim.push({
        startIdx: from, targetIdx: from, speed: speed, delay: 0, leadM: lead, who: r,
        holdM: HALFWAY_M, goAt: catchT, retreat: true
      });
    }
  }
  return { anim: anim, runs: runs };
}
function twoOutSprint(freezeAt) {
  if (!game || game.outs < 2) return [];
  const pit = defensePitcher();
  const anim = [];
  for (let i = 2; i >= 0; i--) {
    const r = game.bases[i];
    if (!r) continue;
    const from = i + 1;
    anim.push({
      startIdx: from, targetIdx: Math.min(4, from + 1), speed: runMetersPerSec(r.spd),
      delay: 0, leadM: dynamicLead(r, pit), who: r, freezeAt: freezeAt
    });
  }
  return anim;
}
function placeRunners(t) {
  const rows = runnersAnim.map(function (r) { return { r: r, free: runnerDisplayMeters(r, t) }; });
  rows.sort(function (a, b) { return b.r.startIdx - a.r.startIdx; });
  let block = null;
  rows.forEach(function (p) {
    const freeAbs = p.r.startIdx * JUDGE_BASE_M + p.free;
    let capAbs = Infinity;
    if (block) {
      if (block.tHome != null && t >= block.tHome) capAbs = block.openAbs + p.r.speed * (t - block.tHome);
      else capAbs = block.liveAbs;
    }
    if (freeAbs > capAbs) {
      p.m = Math.max(0, capAbs - p.r.startIdx * JUDGE_BASE_M);
      p.held = true;
    } else {
      p.m = p.free;
      p.held = false;
    }
    p.r._m = p.m;
    const homeM = (4 - p.r.startIdx) * JUDGE_BASE_M;
    const scored = p.r.targetIdx >= 4 && !p.r.retreat && p.free + 0.15 >= homeM;
    if (scored) {
      const tHome = arriveMeters(p.r, homeM);
      block = { tHome: isFinite(tHome) ? tHome : t, openAbs: 4 * JUDGE_BASE_M - PASS_GAP_M, liveAbs: 4 * JUDGE_BASE_M - PASS_GAP_M, spd: p.r.speed };
    } else {
      block = { tHome: null, liveAbs: p.r.startIdx * JUDGE_BASE_M + p.m - PASS_GAP_M, spd: p.r.speed };
    }
  });
  let frontDone = true;
  rows.forEach(function (p) {
    const own = runnerSettledOwn(p.r, t, p.m);
    p.r._done = own || (p.held && frontDone) || t > 14;
    frontDone = p.r._done && frontDone;
  });
  let allDone = true;
  runnersAnim.forEach(function (r) {
    const pt = pointAlong(r.startIdx, r._m || 0, r.roundM || 0, r.targetIdx);
    r.x = pt.x;
    r.y = pt.y;
    r.curIdx = pt.idx;
    if (!r._done) allDone = false;
  });
  runnersAllIn = allDone || runnersAnim.length === 0;
  return runnersAllIn;
}
function clockRunners(batterDelay, leadM) {
  const pit = defensePitcher();
  runnersAnim.forEach(function (r) {
    if (r.startIdx === 0) {
      if (batterDelay != null) r.delay = batterDelay;
      r.leadM = 0;
    } else if (r.leadM == null) {
      if (leadM === 'dyn') r.leadM = dynamicLead(r.who, pit);
      else if (leadM) r.leadM = leadM;
      if (r.delay == null) r.delay = 0;
    } else if (r.delay == null) r.delay = 0;
  });
}
function throwPoint(th, p) {
  const x0 = th.x0, y0 = th.y0, x1 = th.x1, y1 = th.y1;
  if (th.wild && th.cx != null) {
    const u = 1 - p;
    return {
      x: u * u * x0 + 2 * u * p * th.cx + p * p * x1,
      y: u * u * y0 + 2 * u * p * th.cy + p * p * y1,
      h: 0
    };
  }
  if (th.bounce) {
    const airT = 0.72;
    const airD = 0.88;
    if (p < airT) {
      const u = p / airT;
      return {
        x: x0 + (x1 - x0) * airD * u,
        y: y0 + (y1 - y0) * airD * u,
        h: Math.sin(u * Math.PI) * Math.min(3.4, Math.hypot(x1 - x0, y1 - y0) * 0.045)
      };
    }
    const u = (p - airT) / Math.max(1e-4, 1 - airT);
    const along = airD + (1 - airD) * u;
    return {
      x: x0 + (x1 - x0) * along,
      y: y0 + (y1 - y0) * along,
      h: Math.sin(u * Math.PI) * 0.62
    };
  }
  return { x: x0 + (x1 - x0) * p, y: y0 + (y1 - y0) * p, h: 0 };
}
function syncThrow(elapsed) {
  throwBall = null;
  let parked = null;
  for (let i = 0; i < throwSeq.length; i++) {
    const th = throwSeq[i];
    if (elapsed + 1e-9 >= th.t0 && elapsed <= th.t0 + th.dur + 1e-9) {
      const span = th.dur > 1e-6 ? th.dur : 1e-6;
      const p = Math.max(0, Math.min(1, (elapsed - th.t0) / span));
      const pt = th.carry ? null : throwPoint(th, p);
      let bx = pt ? pt.x : th.x0, by = pt ? pt.y : th.y0, bh = pt ? pt.h : 0.35;
      if (th.carry) {
        const holder = th.from ? fielderBy(th.from) : null;
        if (holder) { bx = holder.x; by = holder.y; bh = 0.35; }
      }
      if (!throwBall) throwBall = { active: true, wild: !!th.wild, bounce: !!th.bounce, carry: !!th.carry, x: bx, y: by, h: bh };
      parked = null;
    } else if (elapsed > th.t0 + th.dur) parked = th;
  }
  if (!throwBall && parked) throwBall = { active: true, wild: !!parked.wild, bounce: !!parked.bounce, x: parked.x1, y: parked.y1, h: 0 };
}
function throwsFinished(t) {
  for (let i = 0; i < throwSeq.length; i++) {
    if (t + 1e-6 < throwSeq[i].t0 + throwSeq[i].dur) return false;
  }
  return true;
}
function coverBags() {
  throwPlan.forEach(function (spec) {
    if (!spec.bag || !spec.toPos) return;
    const recv = fielderBy(spec.toPos);
    if (!recv || recv.isTarget) return;
    retargetFielder(recv, spec.bag.x, spec.bag.y, 0);
  });
}
function commitThrows() {
  const seq = [];
  throwPlan.forEach(function (spec) {
    const x0 = spec.x0, y0 = spec.y0, x1 = spec.x1, y1 = spec.y1;
    const fromF = spec.from ? fielderBy(spec.from) : null;
    const arm = spec.arm || armMetersPerSec(fromF ? fromF.fld : 74);
    let dur = spec.dur;
    if (!(dur > 0)) dur = Math.max(1e-4, Math.hypot(x1 - x0, y1 - y0) / arm);
    let release = spec.release;
    if (release == null) release = ball && ball.T_ball != null ? ball.T_ball + 0.4 : 0.36;
    seq.push({
      t0: release, dur: dur, x0: x0, y0: y0, x1: x1, y1: y1,
      cx: spec.cx, cy: spec.cy, wild: !!spec.wild, bounce: !!spec.bounce && !spec.wild,
      carry: !!spec.carry, from: spec.from || null
    });
  });
  throwSeq = seq;
  throwPlan = [];
}
function bindFielding() {
  if (!ball) return;
  const throwing = throwSeq.length > 0;
  const flyCatch = glove && glove.air && !ball.fumble;
  if (ball.fumble && !throwing) { ball.fieldAt = null; return; }
  if (!flyCatch && !throwing) { ball.fieldAt = null; return; }
  const holderPos = (glove && glove.pos) || (game && game._catch && game._catch.pos);
  const f = holderPos ? fielderBy(holderPos) : null;
  if (!f) { ball.fieldAt = null; return; }
  const destX = ball.rolls ? ball.rollX : ball.landX;
  const destY = ball.rolls ? ball.rollY : ball.landY;
  const ox = f.ox != null ? f.ox : f.x;
  const oy = f.oy != null ? f.oy : f.y;
  const depart = f.departAt != null ? f.departAt : startDelay(f);
  const mps = f.mps || moveSpeed(f);
  const arrive = depart + Math.hypot(destX - ox, destY - oy) / mps;
  const tBall = ball.rolls ? Math.max(ball.T_ball, ball.T_roll) : ball.T_ball;
  ball.holder = f.pos;
  if (flyCatch && !ball.rolls) ball.fieldAt = arrive <= ball.T_ball + 0.03 ? ball.T_ball : Math.max(ball.T_ball, arrive);
  else ball.fieldAt = Math.max(tBall, arrive);
}
function holdBall(t) {
  if (!ball || ball.fieldAt == null || t + 1e-6 < ball.fieldAt) return;
  if (throwSeq.length && t + 1e-6 >= throwSeq[0].t0) return;
  const f = ball.holder ? fielderBy(ball.holder) : null;
  if (!f) return;
  ball.curX = f.x;
  ball.curY = f.y;
  ball.curH = 0.3;
  if (ball.fumble) {
    ball.curX += Math.sin(t * 28) * 0.35;
    ball.curY += Math.cos(t * 24) * 0.2;
  }
}
function presentPlay(t) {
  placeFielders(t);
  if (ball) {
    ball.started = true;
    placeBall(t);
    ball.hide = false;
  }
  placeRunners(t);
  syncThrow(t);
  if (ball && throwSeq.length && t + 1e-6 >= throwSeq[0].t0) ball.hide = true;
  holdBall(t);
  maybeCaption(t);
  syncBroadcast(t);
}
function decisionClock() {
  let at = 0;
  let threw = false;
  for (let i = 0; i < throwSeq.length; i++) {
    threw = true;
    at = Math.max(at, throwSeq[i].t0 + throwSeq[i].dur);
  }
  if (!threw && ball) at = ball.fieldAt != null ? ball.fieldAt : (ball.T_ball || 0);
  if (!(at > 0) && pitchFx) at = pitchFx.dur || 0.36;
  return Math.max(0, at);
}
function syncBroadcast(t) {
  if (!game || !game._deferResult || game._revealed) return;
  if (t + 1e-4 >= (game._revealAt == null ? 0 : game._revealAt)) {
    game._revealed = true;
    game._holdOuts = false;
    if (game._heldCaption) playCaption = game._heldCaption;
    setBroadcast(game._finalBanner || '');
    paintOuts();
    return;
  }
  let line = '타격!';
  if (throwSeq.length && t + 1e-6 >= throwSeq[0].t0) line = '송구 중...';
  else if (ball && ball.fieldAt != null && t + 1e-6 >= ball.fieldAt && !(throwSeq.length && throwSeq[0].t0 > t)) line = '포구 후 처리 중...';
  else if (ball && t + 1e-6 >= (ball.T_ball || 0)) line = '타구 낙하!';
  else if (!ball && pitchFx) line = (pitchFx.name || '투구') + ' · 투구 중...';
  const el = document.getElementById('broadcastText');
  if (el && el.textContent !== line) setBroadcast(line);
}
function upcomingMark(t) {
  let n = Infinity;
  function note(at) { if (at > t + 1e-5) n = Math.min(n, at); }
  if (ball) {
    note(ball.T_ball);
    if (ball.rolls) note(ball.T_roll);
    if (ball.fieldAt != null) note(ball.fieldAt);
    if (ball.bounceBack) { note(ball.bounceBack.tWall); note(ball.bounceBack.tBack); }
    if (ball.kick) { note(ball.kick.tHit); note(ball.kick.tEnd); }
  }
  throwSeq.forEach(function (th) { note(th.t0); note(th.t0 + th.dur); });
  runnersAnim.forEach(function (r) {
    const delay = r.delay || 0;
    note(delay);
    if (r.goAt != null) note(r.goAt);
    if (r.freezeAt != null) note(r.freezeAt);
    if (r.retreat) {
      note(retreatDone(r));
      return;
    }
    const bases = Math.max(0, r.targetIdx - r.startIdx);
    for (let k = 1; k <= bases; k++) note(arriveMeters(r, k * JUDGE_BASE_M));
    if (r.overrunM > 0) note(overrunDone(r));
  });
  activeFielders.forEach(function (f) {
    if (f.relayLeg && f.relayLeg.at != null) note(f.relayLeg.at);
    if (f.departAt == null || !(f.mps > 0)) return;
    note(f.departAt);
    const dist = Math.hypot((f.goalX || 0) - (f.ox || 0), (f.goalY || 0) - (f.oy || 0));
    if (dist > 0.001) note(f.departAt + dist / f.mps);
  });
  return n;
}
function physicsSettled(t) {
  if (ball) {
    const thrown = throwSeq.length && t + 1e-6 >= throwSeq[0].t0;
    if (t + 1e-6 < ball.T_ball && !thrown) return false;
  }
  if (!throwsFinished(t)) return false;
  if (runnersAnim.length && !runnersAllIn) return false;
  return true;
}
function beginPlayback() {
  coverBags();
  commitThrows();
  bindFielding();
  primeRunners();
  playElapsed = 0;
  playLingerUntil = 0;
  if (game && game._deferResult) game._revealAt = decisionClock();
}
function grantOuts(n) {
  game.outs += n;
  game._outsThisPlay = (game._outsThisPlay || 0) + n;
  const def = game.isTop ? game.home : game.away;
  if (def && def.pitcher) def.pitcher.outs = (def.pitcher.outs || 0) + n;
}
function addRuns(atk, def, n, rbi) {
  if (!n) return;
  atk.score += n;
  if (rbi !== false && game.rbiBatter) game.rbiBatter.rbi = (game.rbiBatter.rbi || 0) + n;
  if (def.pitcher) {
    def.pitcher.runs = (def.pitcher.runs || 0) + n;
    def.pitcher.innRuns = (def.pitcher.innRuns || 0) + n;
  }
}
function chargeError(def) { def.errors = (def.errors || 0) + 1; }
function pickReliever(team, lead) {
  const order = (game.inning >= 8 && lead >= 0 && lead <= 3) ? [3, 0, 1, 2]
    : (lead > 0 && game.inning >= 6) ? [0, 1, 3, 2] : [2, 1, 0, 3];
  if (!team.bullpen || !team.penUsed) return -1;
  for (let i = 0; i < order.length; i++) {
    const idx = order[i];
    if (team.penUsed.indexOf(idx) < 0 && team.bullpen[idx]) return idx;
  }
  return -1;
}
function maybeRelieve(defTeam, atkTeam) {
  const pit = defTeam.pitcher;
  if (!defTeam.bullpen || !pit) return '';
  const lead = defTeam.score - atkTeam.score;
  const starter = pit.slotIndex == null || pit.slotIndex < 0;
  const tired = starter && pit.stamina <= 25;
  const gassed = !starter && pit.stamina <= 18;
  const shell = (pit.runs >= 4 && game.inning <= 5) || (pit.innRuns >= 3);
  const wantCloser = game.inning >= 8 && lead >= 0 && lead <= 3 && pit.slotIndex !== 3;
  if (starter && !tired && !shell && !wantCloser) return '';
  if (!starter && !gassed && !shell && !wantCloser) return '';
  const idx = pickReliever(defTeam, lead);
  if (idx < 0) return '';
  const next = defTeam.bullpen[idx];
  defTeam.penUsed.push(idx);
  if (!defTeam.appeared) defTeam.appeared = [];
  defTeam.appeared.push({ cardId: pit.cardId || null, name: pit.name, outs: pit.outs || 0, runs: pit.runs || 0, slotIndex: pit.slotIndex, label: pit.label });
  const prev = (pit.label || '투수') + ' ' + pit.name;
  const made = makeArm(next.name, next.role, next.label, idx, next.spd, next.ctrl, next.stuff, next.brk, next.stm, next.mnt);
  made.cardId = next.cardId || null;
  defTeam.pitcher = made;
  return '🔁 감독 교체! ' + prev + ' → ' + next.label + ' ' + next.name;
}
function primeRunners() {
  runnersAnim.forEach(function (r) {
    r.delay = r.delay || 0;
    if (r.leadM == null) r.leadM = 0;
    if (r.roundM == null && !r.retreat && r.targetIdx - r.startIdx >= 2) r.roundM = ROUND_BULGE;
  });
  placeRunners(0);
}
function clearPlayActors() {
  runnersAnim = [];
  throwBall = null;
  throwSeq = [];
  throwPlan = [];
  glove = null;
  playLingerUntil = 0;
}
function runTimeline(minDur, ballPlay) {
  beginPlayback();
  const raced = !!(ball || runnersAnim.length || throwSeq.length);
  let last = performance.now();
  let contact = !(ballPlay && pitchFx);
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    dt *= tickCamera();
    if (!contact && pitchFx) {
      const room = Math.max(0, pitchFx.dur - pitchFx.t);
      const use = Math.min(dt, room);
      pitchFx.t += use;
      samplePitch();
      if (pitchFx.t >= pitchFx.dur - 1e-8) {
        contact = true;
        let step = dt - use;
        const mark = upcomingMark(playElapsed);
        if (mark < playElapsed + step) step = mark - playElapsed;
        playElapsed += step;
      }
    } else if (!playLingerUntil) {
      if (pitchFx && pitchFx.t < pitchFx.dur) {
        pitchFx.t = Math.min(pitchFx.dur, pitchFx.t + dt);
        samplePitch();
      }
      let step = dt;
      const mark = upcomingMark(playElapsed);
      if (mark < playElapsed + step) step = mark - playElapsed;
      playElapsed += step;
    }
    if (contact) presentPlay(playElapsed);
    else {
      placeFielders(0);
      if (runnersAnim.length) placeRunners(0);
    }
    if (celebrate) celebrate.parts.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; });
    drawField();
    const ready = contact && physicsSettled(playElapsed) && (raced || playElapsed >= (minDur || 0));
    if (ready && !playLingerUntil) playLingerUntil = performance.now() + (raced ? PLAY_LINGER_MS : 0);
    if (!ready || performance.now() < playLingerUntil) animId = requestAnimationFrame(frame);
    else {
      clearPlayActors();
      flushInningChange();
      drawField();
      if (game.isOver) finishMatch();
    }
  }
  animId = requestAnimationFrame(frame);
}
function runClockAnim(dur) {
  runTimeline(dur || 0.85, false);
}
function resolveFirstThirdSteal(atk, def, r1, r3, pit) {
  const c = fielderBy('C');
  const iq = catcherRead(c);
  const protect = iq >= 70;
  const tl = stealTimeline(pit, c, r1);
  const slack = tagSlack(r1);
  const lead3 = dynamicLead(r3, pit);
  const cArm = armMetersPerSec(c ? c.fld : 70);
  if (protect) {
    const cutD = 18.4 - (-1.5);
    const cutFlight = cutD / cArm;
    const cutRelease = tl.receive + 0.16;
    const cutT = cutRelease + cutFlight;
    const mound = fielderBy('P');
    const pArm = armMetersPerSec(mound ? mound.fld : 70);
    const relayD = 38.8 - 18.4;
    const relayRelease = cutT + 0.22;
    const relayDur = relayD / pArm;
    const throwArrive = relayRelease + relayDur;
    const jCut = judgeContest(tl.runT, throwArrive + slack, r1, mound ? mound.fld : 70, { force: false });
    if (!jCut.go) return null;
    const liveRelay = relayRelease - (jCut.cut || 0);
    setGoals(null, 0, 38.8, 'steal');
    armStealPitch(pit, tl.quick, tl.flight);
    queueThrow({
      from: 'C', to: 'P', x0: 0, y0: -1.5, x1: 0, y1: 18.4, wild: false, needsCatch: false,
      release: cutRelease, dur: cutFlight, arm: cArm
    });
    queueThrow({
      from: 'P', to: '2B', toPos: '2B', x0: 0, y0: 18.4, x1: 0, y1: 38.8, wild: false, needsCatch: false,
      release: liveRelay, dur: relayDur, arm: pArm
    });
    runnersAnim = [
      { startIdx: 1, targetIdx: 2, speed: tl.speed, delay: tl.delay, leadM: tl.lead, who: r1 },
      { startIdx: 3, targetIdx: 3, speed: runMetersPerSec(r3.spd), delay: 0, leadM: lead3, who: r3, holdM: Math.min(5.5, HALFWAY_M), goAt: cutT, retreat: true }
    ];
    noteBaseRace('2B', jCut.tRun, jCut.tLive);
    if (jCut.out) {
      noteSteal(false, jCut.kind);
      grantOuts(1);
      game.bases[0] = null;
      playCaption = { text: '컷오프 도루 저지!', bad: true };
      return { msg: '🧤 1·3루. 포수가 3루 주자를 보고 투수에게 컷. ' + r3.name + '은 귀루, ' + r1.name + '은 2루 태그 아웃.', dur: throwArrive + 0.35 };
    }
    noteSteal(true);
    game.bases[1] = r1;
    game.bases[0] = null;
    playCaption = { text: '컷오프, 2루 세이프', bad: false };
    return { msg: '👀 포수 수비·판단으로 2루 송구를 끊었습니다. ' + r1.name + ' 2루 세이프, ' + r3.name + '은 3루 잔류.', dur: throwArrive + 0.35 };
  }
  const jSteal = judgeContest(tl.runT, tl.arrive + slack, r1, c ? c.fld : 70, { force: false });
  if (!jSteal.go) return null;
  const stealRelease = tl.release - (jSteal.cut || 0);
  const homeDelay = tl.receive + 0.15;
  setGoals(null, 0, 38.8, 'steal');
  armStealPitch(pit, tl.quick, tl.flight);
  queueThrow({
    from: 'C', to: '2B', toPos: '2B', x0: 0, y0: -1.5, x1: 0, y1: 38.8, wild: false, needsCatch: false,
    release: stealRelease, dur: tl.throwDur, arm: cArm
  });
  runnersAnim = [
    { startIdx: 1, targetIdx: 2, speed: tl.speed, delay: tl.delay, leadM: tl.lead, who: r1 },
    { startIdx: 3, targetIdx: 4, speed: runMetersPerSec(r3.spd), delay: homeDelay, leadM: lead3, who: r3 }
  ];
  noteBaseRace('2B', jSteal.tRun, jSteal.tLive);
  addRuns(atk, def, 1);
  game.bases[2] = null;
  if (jSteal.out) {
    noteSteal(false, jSteal.kind);
    grantOuts(1);
    game.bases[0] = null;
    playCaption = { text: '2루 아웃, 홈인', bad: true };
    return { msg: '💨 포수가 2루 송구를 선택. ' + r1.name + ' 태그 아웃, ' + r3.name + '은 홈인.', dur: (tl.arrive - (jSteal.cut || 0)) + 0.35 };
  }
  noteSteal(true);
  game.bases[1] = r1;
  game.bases[0] = null;
  playCaption = { text: '더블 스틸!', bad: false };
  return { msg: '💨 1·3루 더블 스틸! ' + r1.name + ' 2루, ' + r3.name + ' 홈인.', dur: tl.arrive + 0.35 };
}
function resolveSidePlay(atk, def) {
  const r1 = game.bases[0];
  if (!r1) return null;
  const pit = def.pitcher;
  if (Math.random() < 0.08) {
    const pickSkill = ((pit.brk || 70) + (pit.mnt || 70)) / 2;
    const margin = (r1.spd - 74) * 0.011 - (pickSkill - 70) * 0.013 + (Math.random() * 0.05 - 0.02);
    const out = margin < -0.01;
    setGoals(null, 19.4, 19.4, 'pick');
    const pickLead = dynamicLead(r1, pit);
    runnersAnim = [{
      startIdx: 1, targetIdx: 1, speed: runMetersPerSec(r1.spd), delay: 0, leadM: pickLead, who: r1,
      holdM: out ? null : pickLead, goAt: out ? null : 0.24, retreat: !out
    }];
    const pArm = armMetersPerSec((fielderBy('P') || { fld: 70 }).fld);
    queueThrow({
      from: 'P', to: '1B', x0: 0, y0: 18.4, x1: out ? 19.4 : 26, y1: out ? 19.4 : 14, wild: !out, needsCatch: false,
      release: 0.3, dur: out ? Math.hypot(19.4, 1) / pArm : null, arm: pArm
    });
    if (out) {
      grantOuts(1);
      game.bases[0] = null;
      playCaption = { text: '견제 아웃!', bad: true };
      return { msg: '🧤 투수 견제! ' + r1.name + ' 1루 견제 아웃! (' + Math.abs(margin).toFixed(2) + '초)' , dur: 1.25 };
    }
    r1._leadCut = Math.min(1.2, (r1._leadCut || 0) + 0.4);
    playCaption = { text: '견제구', bad: false };
    return { msg: '👀 1루 견제구. ' + r1.name + ' 귀루. 리드를 줄입니다.', dur: 1.05 };
  }
  if (r1.spd >= 70 && !game.bases[1] && game.outs < 2 && Math.random() < 0.11 + (r1.spd - 70) * 0.007) {
    if (game.bases[2]) return resolveFirstThirdSteal(atk, def, r1, game.bases[2], pit);
    const c = fielderBy('C');
    const tl = stealTimeline(pit, c, r1);
    const j = judgeContest(tl.runT, tl.arrive + tagSlack(r1), r1, c ? c.fld : 70, { force: false });
    if (!j.go) return null;
    const cArm = armMetersPerSec(c ? c.fld : 70);
    const release = tl.release - (j.cut || 0);
    armStealPitch(pit, tl.quick, tl.flight);
    setGoals(null, 0, 38.8, 'steal');
    runnersAnim = [{ startIdx: 1, targetIdx: 2, speed: tl.speed, delay: tl.delay, leadM: tl.lead, who: r1 }];
    queueThrow({
      from: 'C', to: '2B', toPos: '2B', x0: 0, y0: -1.5, x1: 0, y1: 38.8, wild: false, needsCatch: false,
      release: release, dur: tl.throwDur, arm: cArm
    });
    noteBaseRace('2B', j.tRun, j.tLive);
    if (j.out) {
      noteSteal(false, j.kind);
      grantOuts(1);
      game.bases[0] = null;
      playCaption = { text: '도루 저지!', bad: true };
      return { msg: '🚫 도루 저지! 포수가 ' + Math.abs(j.dt).toFixed(2) + '초 빨랐습니다. 2루 커버.', dur: j.tLive + 0.35 };
    }
    noteSteal(true);
    game.bases[1] = r1;
    game.bases[0] = null;
    playCaption = { text: '도루 성공!', bad: false };
    return { msg: '💨 ' + r1.name + ' 도루 성공! 주자가 ' + Math.max(0.01, j.dt).toFixed(2) + '초 앞섰습니다.', dur: j.tLive + 0.35 };
  }
  return null;
}
function samplePitch() {
  if (!pitchFx) return;
  const rel = pitchFx.releaseAt || 0;
  const flight = Math.max(1e-4, (pitchFx.dur || 0.36) - rel);
  const u = pitchFx.t <= rel ? 0 : Math.min(1, (pitchFx.t - rel) / flight);
  const pt = pitchPoint(pitchFx.kind, u);
  pitchFx.x = pt.x;
  pitchFx.y = pt.y;
  pitchFx.trail.push([pt.x, pt.y]);
  if (pitchFx.trail.length > 14) pitchFx.trail.shift();
}
function pitchPoint(kind, u) {
  const t = kind === 'drop' ? u * u : u;
  const x0 = 0, y0 = 18.4, x1 = 0.15, y1 = 0.35;
  let cx = 0.3, cy = 10;
  if (kind === 'break') { cx = 6.6; cy = 8.6; }
  if (kind === 'drop') { cx = 1.3; cy = 6.4; }
  return {
    x: (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1,
    y: (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1
  };
}
function creditHit(atk, batter, bases) {
  const n = bases >= 4 ? 4 : bases;
  batter.h++;
  atk.hits++;
  if (n === 1) bump(atk, 's1', 1);
  else if (n === 2) bump(atk, 'd2', 1);
  else if (n === 3) bump(atk, 't3', 1);
  else if (n === 4) { batter.hr++; bump(atk, 'hr', 1); }
  bump(atk, 'tb', n);
  touchHeat(batter, n);
}
function resolveWildPitch(atk, def) {
  if (!game.bases[0] && !game.bases[1] && !game.bases[2]) return null;
  const pit = def.pitcher;
  const effCtrl = pit.ctrl - Math.max(0, (70 - pit.stamina) * 0.25);
  const c = fielderBy('C');
  const wp = Math.min(0.055, Math.max(0, 76 - effCtrl) * 0.0018 + Math.max(0, (pit.brk || 70) - 73) * 0.0014);
  const pb = Math.min(0.04, Math.max(0, 80 - (c ? c.fld : 70)) * 0.0012);
  const roll = Math.random();
  if (roll >= wp + pb) return null;
  const passed = roll >= wp;
  if (!passed && c && Math.random() < catcherBlockRate(c)) {
    playCaption = { text: '포수 호수비 블로킹!', bad: false };
    setGoals('C', 0, -0.2, 'block');
    return { msg: '🛡️ 포수 호수비 블로킹! 주자 진루 저지. ' + c.name + '이 원바운드 공을 몸으로 막았습니다.', dur: 1.05 };
  }
  const res = advanceWildRunners();
  addRuns(atk, def, res.runs, false);
  runnersAnim = res.animList;
  playCaption = { text: passed ? '포일!' : '폭투!', bad: false };
  if (game) game._backstop = true;
  setGoals(passed ? 'C' : 'P', 0, -4, 'fly');
  return { msg: (passed ? '🧤 포일! 공이 포수 뒤로 빠졌습니다. ' : '💨 폭투! 제구가 흔들리며 공이 빠졌습니다. ') + '주자 한 베이스 진루' + (res.runs ? ' · ' + res.runs + '득점!' : '.'), dur: 1.15 };
}
function applyInfieldIn() {
  const late = !game.isTop && game.inning >= 8;
  const one = Math.abs(game.home.score - game.away.score) <= 1;
  if (!(late && one && game.outs === 1 && game.bases[2])) return false;
  ['1B', '2B', 'SS', '3B'].forEach(function (pos) {
    const f = fielderBy(pos);
    if (!f) return;
    f.x = f.homeX * 0.55;
    f.y = Math.max(12, f.homeY * 0.58);
  });
  return true;
}
const OF_DEEP = { LF: { x: -52, y: 81 }, CF: { x: 0, y: 97 }, RF: { x: 52, y: 81 } };
function applyOutfieldDepth(batter) {
  const loaded = !!(game && game.outs >= 2 && game.bases[0] && game.bases[1] && game.bases[2]);
  const masher = !!(batter && (Number(batter.pow) || 0) >= 82);
  if (!loaded && !masher) return false;
  ['LF', 'CF', 'RF'].forEach(function (pos) {
    const f = fielderBy(pos);
    const deep = OF_DEEP[pos];
    if (!f || !deep) return;
    f.homeX = deep.x;
    f.homeY = deep.y;
    f.x = deep.x;
    f.y = deep.y;
    f.goalX = deep.x;
    f.goalY = deep.y;
  });
  return true;
}
function applyWalkoffOutfieldIn() {
  if (!game || game.isTop || game.inning < 9) return false;
  if (game.home.score !== game.away.score) return false;
  if (game.outs >= 2 || !game.bases[2]) return false;
  ['LF', 'CF', 'RF'].forEach(function (pos) {
    const f = fielderBy(pos);
    if (!f) return;
    const r = Math.hypot(f.homeX, f.homeY);
    if (!(r > 20)) return;
    const s = (r - 15) / r;
    f.homeX *= s;
    f.homeY *= s;
    f.x = f.homeX;
    f.y = f.homeY;
    f.goalX = f.homeX;
    f.goalY = f.homeY;
  });
  return true;
}
function resolveBunt(atk, def, batter, pit) {
  const close = Math.abs(atk.score - def.score) <= 1;
  const sac = game.outs === 0 && game.bases[0] && game.bases[1] && !game.bases[2] && close;
  const drag = !sac && batter.spd >= 76 && game.outs < 2 && !game.bases[2] && Math.random() < 0.028 + Math.max(0, batter.spd - 78) * 0.0015;
  if (!sac && !drag) return null;
  const fielder = fielderBy(Math.random() < 0.5 ? 'P' : (Math.random() < 0.5 ? '1B' : '3B'));
  const hands = ((pit.mnt || 70) + (fielder ? fielder.fld : 70)) / 2;
  const batQ = (batter.con + batter.spd) / 2;
  const shotX = Math.random() * 12 - 3;
  const shotY = 7 + Math.random() * 9;
  const exitKmh = 42 + Math.random() * 18;
  const rollDist = Math.hypot(shotX, shotY);
  const rollMps = Math.max(8, (exitKmh / 3.6) * 0.62);
  const tBall = rollDist / rollMps;
  const shot = {
    targetX: shotX, targetY: shotY, R: rollDist, sprayRad: Math.atan2(shotX, shotY),
    maxH: 0.28, isGrounder: true, T_ball: tBall, T_roll: tBall, exitSpeedKmh: exitKmh, launchAngle: 2,
    flightT: tBall, flightR: rollDist
  };
  const bArm = armMetersPerSec(fielder ? fielder.fld : 70);
  const fieldT = Math.max(tBall, fielder ? arriveTime(fielder, shotX, shotY) : tBall);
  const release = fieldT + 0.32;
  let msg = '';
  let sacFail = false;
  let buntCut = 0;
  if (sac) {
    const ok = Math.random() < Math.max(0.55, Math.min(0.9, 0.74 + (batQ - hands) * 0.004));
    if (ok) {
      grantOuts(1);
      const r1 = game.bases[0], r2 = game.bases[1];
      game.bases = [null, r1, r2];
      runnersAnim = [
        { startIdx: 2, targetIdx: 3, speed: runMetersPerSec(r2.spd) },
        { startIdx: 1, targetIdx: 2, speed: runMetersPerSec(r1.spd) }
      ];
      bump(atk, 'sac', 1);
      batter.chr = 0;
      playCaption = { text: '희생번트!', bad: false };
      msg = '🫡 희생번트! 주자 2·3루, ' + batter.name + '은 1루 아웃.';
    } else {
      batter.ab++;
      grantOuts(1);
      const r1 = game.bases[0];
      const r2 = game.bases[1];
      game.bases = [batter, r1, null];
      runnersAnim = [
        { startIdx: 2, targetIdx: 3, speed: runMetersPerSec(r2.spd) },
        { startIdx: 1, targetIdx: 2, speed: runMetersPerSec(r1.spd) },
        { startIdx: 0, targetIdx: 1, speed: runMetersPerSec(batter.spd) }
      ];
      batter.chr = 0;
      sacFail = true;
      playCaption = { text: '3루 송구 아웃!', bad: true };
      msg = '❌ 희생번트 실패! 3루 선행 주자 아웃, ' + batter.name + '은 1루 세이프.';
    }
  } else {
    const throwT = release + Math.hypot(19.4 - shotX, 19.4 - shotY) / bArm;
    const runT = 0.32 + 27.43 / runMetersPerSec(batter.spd);
    const jB = judgeContest(runT, throwT, batter, fielder ? fielder.fld : 70, { force: true });
    buntCut = jB.cut || 0;
    batter.ab++;
    if (!jB.out) {
      creditHit(atk, batter, 1);
      const res = advanceRunners(1, batter, false);
      addRuns(atk, def, res.runs);
      runnersAnim = res.animList;
      playCaption = { text: '기습번트!', bad: false };
      msg = '⚡ 기습번트 안타! ' + batter.name + '이 주력으로 1루에 살았습니다.' + (res.runs ? ' (' + res.runs + '타점!)' : '');
    } else {
      grantOuts(1);
      touchHeat(batter, 0);
      playCaption = { text: '번트 아웃', bad: true };
      msg = '❌ 기습번트 아웃! ' + (fielder ? fielder.name : '내야수') + ' 처리.';
      runnersAnim = [{ startIdx: 0, targetIdx: 1, speed: runMetersPerSec(batter.spd) }];
    }
  }
  if (game) {
    game._chaser = fielder ? fielder.pos : 'P';
    game._sac3 = sacFail;
  }
  runnersAnim.forEach(function (r) { if (r.delay == null) r.delay = 0.32; });
  const destX = sacFail ? -19.4 : 19.4;
  const destY = 19.4;
  queueThrow({
    from: fielder ? fielder.pos : 'P', to: sacFail ? '3B' : '1B',
    toPos: (sacFail && fielder && fielder.pos === '3B') ? 'SS' : null,
    x0: shotX, y0: shotY, x1: destX, y1: destY,
    release: release - buntCut, dur: Math.hypot(destX - shotX, destY - shotY) / bArm, arm: bArm
  });
  setGoals(fielder ? fielder.pos : 'P', shotX, shotY, 'ground');
  ball = makeBall(shot, false, false);
  return { msg: msg, dur: 1.2 };
}
function resolveDroppedThird(batter, pit, atk, def, checkCall) {
  const firstOpen = !game.bases[0];
  const twoOut = game.outs >= 2;
  if (!firstOpen && !twoOut) return null;
  const c = fielderBy('C');
  const dropP = Math.max(0.04, Math.min(0.15, 0.06 + Math.max(0, (pit.brk || 70) - 74) * 0.0024 + Math.max(0, 72 - (pit.ctrl || 70)) * 0.0018 - Math.max(0, ((c ? c.fld : 70) - 74)) * 0.0022));
  if (Math.random() >= dropP) return null;
  batter.ab++;
  bump(atk, 'k', 1);
  batter.chr = 0;
  const arm = armMetersPerSec(c ? c.fld : 70);
  const throwD = Math.hypot(19.4, 21);
  const throwT = 0.36 + throwD / arm;
  const runT = 0.25 + 27.43 / runMetersPerSec(batter.spd);
  const safe = runT < throwT;
  const t0 = 0.4;
  if (safe) {
    const res = advanceRunners(1, batter, true);
    addRuns(atk, def, res.runs);
    runnersAnim = res.animList;
    runnersAnim.forEach(function (r) { if (r.startIdx === 0) r.delay = 0.25; });
    queueThrow({
      from: 'C', to: '1B', x0: 0, y0: -1.5, x1: 19.4, y1: 19.4, wild: false, needsCatch: false,
      release: 0.36, dur: throwD / arm, arm: arm
    });
    setGoals('1B', 19.4, 19.4, 'pick');
    playCaption = { text: '낫아웃 세이프!', bad: false };
    return { msg: '🏃 낫아웃! 3스트라이크 공이 빠졌고 ' + batter.name + '이 1루까지 전력 질주해 세이프.' + (checkCall ? ' (체크스윙)' : '') + (res.runs ? ' ' + res.runs + '득점!' : '') };
  }
  grantOuts(1);
  batter.heat = 0;
  queueThrow({
    from: 'C', to: '1B', x0: 0, y0: -1.5, x1: 19.4, y1: 19.4, wild: false, needsCatch: false,
    release: 0.36, dur: throwD / arm, arm: arm
  });
  runnersAnim = [{ startIdx: 0, targetIdx: 1, speed: runMetersPerSec(batter.spd), delay: 0.25 }];
  setGoals('1B', 19.4, 19.4, 'pick');
  playCaption = { text: '낫아웃 아웃!', bad: true };
  return { msg: '🚫 낫아웃! 포수 1루 송구로 ' + batter.name + ' 아웃.' + (checkCall ? ' (체크스윙 헛스윙)' : '') };
}
function layFielderChoice(batter, bestF, shot, arm) {
  const r1 = game.bases[0];
  const r2 = game.bases[1];
  const r3 = game.bases[2];
  grantOuts(1);
  batter.chr = 0;
  const anim = [
    { startIdx: 1, targetIdx: 2, speed: runMetersPerSec(r1.spd), delay: 0 },
    { startIdx: 0, targetIdx: 1, speed: runMetersPerSec(batter.spd), delay: batterGroundDelay(batter) }
  ];
  let n2 = null;
  let n3 = r3;
  if (r2 && !r3) {
    n3 = r2;
    anim.push({ startIdx: 2, targetIdx: 3, speed: runMetersPerSec(r2.spd) });
  } else if (r2 && r3) n2 = r2;
  game.bases = [batter, n2, n3];
  runnersAnim = anim;
  const hand = groundRelease(bestF, shot, 0.4);
  const flight = throwFlight(bestF, shot.targetX, shot.targetY, 0, 38.8, hand.armScale);
  queueThrow({
    from: bestF.pos, to: '2B', x0: shot.targetX, y0: shot.targetY, x1: 0, y1: 38.8,
    release: shot.T_ball + hand.pad, dur: flight.dur, arm: flight.arm || arm, bounce: flight.bounce
  });
  playCaption = { text: '야수 선택!', bad: false };
  return '🧤 야수 선택! ' + bestF.name + '가 선행 주자를 2루에서 아웃시키고 ' + batter.name + '은 1루에 살았습니다.';
}
function canBeatThrow(spd, fromBase, toBase, x, y, release, fld, durOverride, runner, timing) {
  timing = timing || {};
  const who = runner || { spd: spd, rct: 70 };
  const plan = baserunPlan(who, fromBase, toBase, {
    fly: !!timing.fly,
    dropAt: timing.dropAt,
    twoOut: !!timing.twoOut,
    hold2: !!timing.hold2,
    batterDelay: fromBase === 0 ? (timing.batterDelay || 0) : 0,
    pit: timing.pit
  });
  const tRun = arriveMeters(plan, (toBase - fromBase) * JUDGE_BASE_M);
  let tThrow = throwArriveAt(toBase, x, y, release, fld, durOverride);
  const force = timing.force != null ? timing.force : (toBase === 1 && fromBase === 0);
  if (!force) tThrow += tagSlack(who);
  const j = judgeContest(tRun, tThrow, who, fld, { force: force });
  return j.go && !j.out;
}
function batterSafeBases(spd, x, y, release, fld, batter, timing) {
  let n = 1;
  for (let b = 2; b <= 4; b++) {
    if (canBeatThrow(spd, 0, b, x, y, release, fld, null, batter || { spd: spd, rct: 70 }, timing)) n = b;
    else break;
  }
  return n;
}
function readStretchDouble(batter, fieldAt, release, throwArrive) {
  const speed = Math.max(0.1, runMetersPerSec(batter ? batter.spd : 70));
  const tDecision = Math.max(0, JUDGE_BASE_M - 3) / speed;
  const t2 = (2 * JUDGE_BASE_M) / speed;
  const runTimeTo2B = t2 - tDecision;
  const caught = fieldAt == null ? release : fieldAt;
  const turnDelay = Math.max(0, release - caught);
  const catchRemain = Math.max(0, caught - tDecision);
  const turnRemain = tDecision >= release ? 0 : Math.max(0, (caught + turnDelay) - Math.max(tDecision, caught));
  const flightRemain = Math.max(0, throwArrive - Math.max(tDecision, release));
  const totalThrowTimeTo2B = catchRemain + turnRemain + flightRemain;
  const j = judgeContest(t2, throwArrive + tagSlack(batter), batter, 70, { force: false });
  return {
    go: j.go && !j.out,
    t2: t2,
    throwArrive: throwArrive,
    runTimeTo2B: runTimeTo2B,
    totalThrowTimeTo2B: totalThrowTimeTo2B,
    margin: j.dt
  };
}
function reachOnMiss(row, read) {
  if (!row || !row.outBase) return;
  row.dest = row.outBase;
  row.outBase = 0;
  row.tEvent = 0;
  row.plan = planTo(row.runner, row.from, row.dest, read, false);
}
function settleHit(atk, def, batter, n, x, y, release, fld, homeOutRunner, homeDur, opts) {
  opts = opts || {};
  resetHomeDrop();
  const pit = opts.pit || defensePitcher();
  const gx = opts.gloveX != null ? opts.gloveX : x;
  const gy = opts.gloveY != null ? opts.gloveY : y;
  const gr = opts.gloveRel != null ? opts.gloveRel : release;
  const who = opts.who || null;
  let leadFrom = 0;
  for (let li = 2; li >= 0; li--) {
    if (game.bases[li] && !(homeOutRunner && game.bases[li] === homeOutRunner)) { leadFrom = li + 1; break; }
  }
  const read = {
    fly: !!opts.fly,
    dropAt: opts.dropAt,
    twoOut: opts.twoOut != null ? opts.twoOut : (game.outs >= 2),
    hold2: !!opts.hold2,
    batterDelay: opts.batterDelay || 0,
    pit: pit,
    uncatchable: !!opts.uncatchable,
    leadFrom: leadFrom
  };
  const chain = !!opts.chain;
  const lock = chain ? null : (opts.lockBatter != null ? opts.lockBatter : Math.max(1, Math.min(4, n || 1)));
  let batterRow;
  if (lock != null) {
    batterRow = {
      runner: batter, from: 0, dest: lock, outBase: 0, stop: null, close2: false,
      plan: planTo(batter, 0, lock, read, false), tEvent: 0
    };
  } else {
    batterRow = chainRunner(batter, 0, 1, 4, read, who, gx, gy, gr, fld, null);
  }
  const slots = [game.bases[0], game.bases[1], game.bases[2]];
  const stay = opts.stayAt || null;
  let wave = batterRow.outBase ? Math.max(0, batterRow.outBase - 1) : batterRow.dest;
  const mins = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    if (!slots[i]) continue;
    const from = i + 1;
    if (stay && stay[from]) { mins[i] = from; continue; }
    let min = from;
    if (wave >= from) min = Math.min(4, wave + 1);
    mins[i] = min;
    wave = Math.max(wave, min);
  }
  if (stay && stay[3]) {
    for (let i = 0; i < 2; i++) if (mins[i] > 2) mins[i] = Math.max(i + 1, 2);
  }
  const judged = [null, null, null];
  let ahead = null;
  for (let i = 2; i >= 0; i--) {
    if (!slots[i]) continue;
    const from = i + 1;
    if (homeOutRunner && slots[i] === homeOutRunner) {
      const row = chainRunner(slots[i], from, 4, 4, read, who, gx, gy, gr, fld, null);
      if (!row.outBase) {
        row.outBase = 4;
        row.dest = 0;
        row.plan = planTo(slots[i], from, 4, read, true);
      }
      judged[i] = row;
      ahead = row;
      continue;
    }
    if (stay && stay[from]) {
      judged[i] = {
        runner: slots[i], from: from, dest: from, outBase: 0, stop: null,
        plan: planTo(slots[i], from, from, read, false), tEvent: 0
      };
      ahead = null;
      continue;
    }
    let cap = 4;
    if (ahead && !ahead.outBase && ahead.dest < 4) cap = Math.max(from, ahead.dest - 1);
    if (mins[i] > cap) cap = mins[i];
    const frontPlan = (ahead && (ahead.dest > ahead.from || ahead.outBase)) ? ahead.plan : null;
    const row = chainRunner(slots[i], from, Math.min(mins[i], cap), cap, read, who, gx, gy, gr, fld, frontPlan);
    judged[i] = row;
    ahead = row;
  }
  const all = [];
  for (let i = 2; i >= 0; i--) if (judged[i]) all.push(judged[i]);
  all.push(batterRow);
  if (opts.committed) all.forEach(function (row) { reachOnMiss(row, read); });
  function pickPlay(rows) {
    let out = null;
    let hold = null;
    rows.forEach(function (row) {
      if (!row || !row.stop) return;
      if (row.outBase) {
        if (!out || row.outBase > out.outBase) out = row;
      } else if (row.stop.hold) {
        if (!hold || row.stop.base > hold.stop.base) hold = row;
      }
    });
    return out || hold || null;
  }
  const play = pickPlay(all);
  if (!opts.committed) {
    all.forEach(function (row) {
      if (!row.outBase || !row.stop) return;
      if (play && play.stop && row.stop.base === play.stop.base) return;
      reachOnMiss(row, read);
    });
  }
  all.forEach(function (row) {
    if (row.outBase) row.plan = planTo(row.runner, row.from, row.outBase, read, true);
  });
  const events = [];
  all.forEach(function (row) {
    if (row.outBase && row.stop) events.push({ t: row.stop.tRun || 0, kind: 'out', row: row });
    else if (row.dest >= 4) events.push({ t: row.stop ? (row.stop.tRun || 0) : 0, kind: 'score', row: row });
  });
  events.sort(function (a, b) { return (a.t - b.t) || (a.kind === 'score' ? -1 : 1); });
  const hitBases = batterRow.outBase ? Math.max(0, batterRow.outBase - 1) : Math.max(0, Math.min(4, batterRow.dest));
  if (hitBases >= 1) creditHit(atk, batter, hitBases);
  else if (batterRow.outBase) touchHeat(batter, 0);
  let runs = 0;
  const notes = [];
  events.forEach(function (ev) {
    if (game.outs >= 3) return;
    if (ev.kind === 'out') {
      grantOuts(1);
      const j = ev.row.stop;
      const batterForce = ev.row === batterRow && ev.row.outBase === 1;
      const forced = !!(j && j.force);
      const where = ev.row.outBase >= 4 ? '홈' : (ev.row.outBase + '루');
      if (j && j.assist) {
        const atkNow = game.isTop ? game.away : game.home;
        bump(atkNow, 'assist', 1);
        if (!batterForce && !forced) bump(atkNow, 'to', 1);
        notes.push('보살 ' + where);
      } else if (j && !batterForce && !forced) {
        noteAdvanceOut('cs');
        notes.push('주루사 ' + where);
      }
    } else runs++;
  });
  const next = [null, null, null];
  const bodies = [];
  for (let i = 2; i >= 0; i--) if (judged[i]) bodies.push(judged[i]);
  if (hitBases >= 1 && hitBases < 4 && !batterRow.outBase) bodies.push(batterRow);
  bodies.sort(function (a, b) { return b.dest - a.dest; });
  bodies.forEach(function (row) {
    if (row.outBase || row.dest >= 4 || row.dest < 1) return;
    let d = row.dest;
    while (d > row.from && next[d - 1]) d--;
    if (d >= 1 && d <= 3 && !next[d - 1]) {
      next[d - 1] = row.runner;
      if (d !== row.dest) {
        row.dest = d;
        row.plan = planTo(row.runner, row.from, d, read, false);
      }
    }
  });
  game.bases = next;
  addRuns(atk, def, runs);
  const anim = [];
  if (batterRow.plan) anim.push(batterRow.plan);
  for (let i = 2; i >= 0; i--) if (judged[i] && judged[i].plan) anim.push(judged[i].plan);
  runnersAnim = anim;
  const throwRow = play && play.stop ? play : null;
  return {
    runs: runs,
    n: hitBases,
    batterOut: batterRow.outBase || 0,
    stretch: !!batterRow.close2,
    note: notes.join(' · '),
    homeDrop: !!(pendingHomeDrop && pendingHomeDrop.drop),
    throwTo: throwRow ? {
      route: throwRow.stop.route, judge: throwRow.stop, base: throwRow.stop.base,
      x: gx, y: gy, release: gr, who: who
    } : null
  };
}
function queueRelayOrBag(who, x, y, release, n, relay) {
  const tossArm = armMetersPerSec(who ? who.fld : 70);
  const baseKey = n >= 3 ? '3B' : '2B';
  if (relay) {
    queueThrow({
      from: who.pos, toPos: relay.cutId, x0: x, y0: y, x1: relay.spot.x, y1: relay.spot.y,
      release: release, dur: relay.flight1, arm: relay.arm1
    });
    queueThrow({
      from: relay.cutId, to: baseKey, toPos: n >= 3 ? '3B' : relay.bagId,
      x0: relay.spot.x, y0: relay.spot.y, release: relay.rel2,
      arm: armMetersPerSec(relay.cut ? relay.cut.fld : 70)
    });
    return;
  }
  if (n >= 3) queueThrow({ from: who.pos, to: '3B', x0: x, y0: y, x1: -19.4, y1: 19.4, release: release, arm: tossArm });
  else if (n === 2) queueThrow({ from: who.pos, to: '2B', x0: x, y0: y, x1: 0, y1: 38.8, release: release, arm: tossArm });
  else queueThrow({ from: who.pos, to: '2B', toPos: coverKeyForSecond(who.pos, x), x0: x, y0: y, x1: 0, y1: 38.8, release: release, arm: tossArm });
}
function playBounce(atk, def, batter, shot, fielder, arriveT) {
  let x = shot.targetX, y = shot.targetY, releaseAt = arriveT, who = fielder || activeFielders[0];
  let throwPrep = 0.32;
  const cantCatchFly = !shot.isGrounder && arriveT > (shot.flightT || shot.T_ball) + 1e-6;
  if (!shot.isGrounder && who) {
    const landT = shot.flightT || shot.T_ball;
    if ((shot.flightR || shot.R) > OUTFIELD_GRASS_M) {
      const again = chaseBall(shot.targetX, shot.targetY, shot.flightR || shot.R, { onlyOF: true });
      if (again.bestF) { who = again.bestF; releaseAt = again.minFTime; }
    }
    if (releaseAt > landT + 1e-6) {
      const carom = planFenceCarom(shot, who);
      if (carom) {
        if (shot.animLandX == null) {
          shot.animLandX = shot.targetX;
          shot.animLandY = shot.targetY;
        }
        shot.animT = landT;
        shot.bounceBack = {
          wallX: carom.wallX, wallY: carom.wallY, tWall: carom.tWall,
          x: carom.x, y: carom.y, tBack: carom.tBall
        };
        shot.hops = true;
        shot.hopH = 1.35;
        shot.targetX = carom.x;
        shot.targetY = carom.y;
        shot.T_roll = carom.tBall;
        if (carom.f) who = carom.f;
        x = carom.x;
        y = carom.y;
        releaseAt = carom.meet;
        if (carom.recover != null) throwPrep = carom.recover;
      } else {
        const hop = planHop(shot, who);
        if (shot.animLandX == null) {
          shot.animLandX = shot.targetX;
          shot.animLandY = shot.targetY;
        }
        shot.animT = landT;
        shot.hops = true;
        shot.rollV = hop.rollV;
        shot.rollA = hop.rollA;
        if (hop.f) who = hop.f;
        if (hop.hitFence) {
          shot.bounceBack = {
            wallX: hop.wallX, wallY: hop.wallY, tWall: hop.tWall,
            x: hop.x, y: hop.y, tBack: hop.tBall
          };
          shot.hopH = 0.62;
        } else {
          shot.hopH = Math.min(1.15, 0.32 + Math.min(hop.hopDist, 10) * 0.03);
          if (shot.spin === 'back') shot.hopH = Math.min(shot.hopH, 0.48);
          else if (shot.spin === 'dead') shot.hopH = Math.min(shot.hopH, 0.18);
        }
        shot.targetX = hop.x;
        shot.targetY = hop.y;
        shot.T_roll = hop.tBall;
        x = hop.x;
        y = hop.y;
        releaseAt = hop.meet;
        if (hop.hitFence && hop.recover != null) throwPrep = hop.recover;
      }
    }
  } else if (shot.isGrounder && shot.kick) {
    x = shot.kick.fx;
    y = shot.kick.fy;
    let best = null, bt = 999;
    activeFielders.forEach(function (f) {
      if (f.pos === 'C') return;
      const t = arriveTime(f, x, y);
      if (t < bt) { bt = t; best = f; }
    });
    if (best) who = best;
    releaseAt = Math.max(bt < 999 ? bt : releaseAt, shot.T_ball);
  } else if (shot.isGrounder) {
    const rx = shot.R * Math.sin(shot.sprayRad);
    const ry = shot.R * Math.cos(shot.sprayRad);
    if (Math.hypot(rx, ry) > OUTFIELD_GRASS_M) {
      const meet = bestOutfieldMeet(shot);
      if (meet) {
        if (shot.animLandX == null) {
          shot.animLandX = shot.targetX;
          shot.animLandY = shot.targetY;
        }
        who = meet.f;
        x = meet.x;
        y = meet.y;
        shot.targetX = x;
        shot.targetY = y;
        shot.T_roll = meet.ballAt;
        releaseAt = meet.meet;
      }
    } else {
      let best = null, bt = 999;
      activeFielders.forEach(function (f) {
        if (f.pos === 'C') return;
        const t = arriveTime(f, rx, ry);
        if (t < bt) { bt = t; best = f; }
      });
      if (best) {
        if (shot.animLandX == null) {
          shot.animLandX = shot.targetX;
          shot.animLandY = shot.targetY;
        }
        who = best;
        x = rx;
        y = ry;
        shot.targetX = rx;
        shot.targetY = ry;
        releaseAt = Math.max(bt, shot.T_roll || shot.T_ball);
      }
    }
  }
  const release = releaseAt + throwPrep;
  if (throwPrep > 0.32 + 1e-9) {
    shot.gloveAt = releaseAt;
    shot.fenceRecover = throwPrep;
  }
  const settled = settleHit(atk, def, batter, 0, x, y, release, who ? who.fld : 70, null, null, {
    fly: !shot.isGrounder && shot.launchAngle >= 15,
    dropAt: shot.flightT || shot.T_ball,
    twoOut: game.outs >= 2,
    pit: defensePitcher(),
    ballX: x,
    ballY: y,
    batterDelay: 0,
    uncatchable: cantCatchFly,
    chain: true,
    who: who,
    gloveX: x,
    gloveY: y,
    gloveRel: release
  });
  clockRunners(0, 'dyn');
  const n = settled.n;
  const fell = !shot.isGrounder;
  if (settled.homeDrop && who) {
    const flight = pendingHomeDrop && pendingHomeDrop.flight;
    queueThrow({
      from: who.pos, to: 'HOME', x0: x, y0: y, x1: 8, y1: -4, wild: true,
      release: release, dur: flight ? flight.dur : null, arm: flight ? flight.arm : armMetersPerSec(who.fld)
    });
  } else if (settled.throwTo && who) {
    queueContestThrow(who, settled.throwTo);
    const j = settled.throwTo.judge;
    if (j) noteBaseRace(settled.throwTo.route.baseKey || '2B', j.tRun, j.tLive);
  } else if (n > 0 && n < 4 && who) {
    const key = n >= 3 ? '3B' : '2B';
    const route = relayOrDirect(who, x, y, release, key);
    if (game) game._relay = route.relay ? { cutId: route.relay.cutId, bagId: route.relay.bagId, spot: route.relay.spot, baseKey: route.baseKey } : null;
    queueRelayOrBag(who, x, y, release, Math.max(1, n), route.relay);
    if (n < 2) armCaption((shot.cleared ? '키를 넘기는 안타! ' : (fell ? '떨어지는 공 · ' : '')) + singleSide(x) + ' 안타!', 'after');
  }
  let text;
  if (n <= 0) {
    text = '❌ ' + batter.name + ' 송구에 1루에서 아웃! (비거리 ' + shot.R.toFixed(0) + 'm · ' + shot.exitSpeedKmh.toFixed(0) + 'km/h)';
    playCaption = { text: '1루 아웃!', bad: true };
  } else {
    let hitName = n >= 4 ? ' 장내 홈런!' : n === 3 ? ' 3루타(3B)!' : n === 2 ? ' 2루타!' : ' 안타!';
    if (shot.bounceBack) {
      if (n >= 4) hitName = ' 담장 직격 장내 홈런!';
      else if (n === 3) hitName = ' 담장 직격 3루타!';
      else if (n === 2) hitName = ' 담장 직격 2루타!';
      else hitName = ' 담장 직격 안타!';
    } else if (shot.cleared && n === 1) hitName = ' 키를 넘기는 안타!';
    text = (n >= 2 ? '💥 ' : '⚾ ') + (fell ? '떨어지는 공 · ' : '') + batter.name + hitName + ' (비거리 ' + shot.R.toFixed(0) + 'm · ' + shot.exitSpeedKmh.toFixed(0) + 'km/h)';
    if (settled.stretch) {
      text += ' · 1루 전방 3m에서 2루 승부';
      playCaption = { text: '2루 승부!', bad: false };
    } else if (n >= 4) playCaption = { text: '홈런!', bad: false };
    else if (n === 3) playCaption = { text: shot.bounceBack ? '담장 직격 3루타!' : '3루타!', bad: false };
    else if (shot.bounceBack && n === 2) playCaption = { text: '담장 직격 2루타!', bad: false };
    if (settled.runs > 0) text += ' (' + settled.runs + '타점!)';
  }
  if (settled.note) {
    text += ' · ' + settled.note;
    if (!playCaption || playCaption.text === '2루 승부!') playCaption = { text: settled.note.indexOf('보살') >= 0 ? '보살 아웃!' : '주루사!', bad: true };
  }
  if (settled.homeDrop) text += ' · 원바운드 송구가 포수 뒤로 빠졌습니다(E)!';
  return {
    msg: text, fielder: who,
    formation: n >= 2 ? 'hit' : 'relay2',
    showTail: !shot.isGrounder && (n >= 2 || shot.R >= 55)
  };
}
function resolveContact(atk, def, batter, pit, effCtrl, effStuff) {
  batter.ab++;
  let shot = launchBattedBall(batter, pit, effCtrl, effStuff, false);
  let chase = chaseBall(shot.targetX, shot.targetY, shot.interceptR);
  let foulNote = '';
  if (shot.foul) {
    if (!shot.isGrounder && chase.bestF && chase.minFTime <= shot.T_ball) {
      const outsNow = game.outs;
      const read = occupyFlyRead(shot.T_ball, outsNow);
      grantOuts(1);
      if (read.runs) addRuns(atk, def, read.runs);
      touchHeat(batter, 0);
      runnersAnim = read.anim;
      playCaption = { text: '파울 플라이 포구!', bad: true };
      markDeepBall(shot);
      setGoals(chase.bestF.pos, shot.targetX, shot.targetY, 'fly');
      ball = makeBall(shot, true, false);
      return foulNote + '🧤 파울 플라이 추격 포구! ' + chase.bestF.name + ' 아웃.';
    }
    foulNote = shot.isGrounder ? '3루선·1루선 바깥 땅볼은 파울이 됐고, ' : '파울 쪽 뜬공은 떨어졌고, ';
    shot = launchBattedBall(batter, pit, effCtrl, effStuff, true);
    chase = chaseBall(shot.targetX, shot.targetY, shot.interceptR);
  }
  if (shot.isGrounder) {
    applyBaseKick(shot);
    if (shot.kick) chase = chaseBall(shot.targetX, shot.targetY, shot.interceptR);
  }
  if (!shot.isGrounder) {
    const gate = judgeInfieldHeight(shot);
    if (gate.snag) {
      const s = gate.snag;
      shot.targetX = s.x;
      shot.targetY = s.y;
      shot.T_ball = s.passT;
      shot.liner = s;
      chase = { bestF: s.f, minFTime: s.arrive };
    } else {
      if (gate.jumpFail) shot.cleared = 'jump';
      else if (gate.over && shot.launchAngle < 28 && shot.flightR < 78) shot.cleared = 'over';
      const onlyOF = (shot.flightR || shot.R) > OUTFIELD_GRASS_M;
      const again = chaseBall(shot.targetX, shot.targetY, shot.interceptR, { onlyOF: onlyOF, skip: gate.skip });
      if (again.bestF) chase = again;
    }
  }
  if (!shot.isGrounder && !shot.liner && isMoundCallFly(shot)) {
    const called = callInfieldPop(shot);
    if (called.bestF) {
      chase = called;
      if (called.called && called.minFTime <= shot.T_ball + 1e-6) shot.callPlay = true;
    }
  }
  let bestF = chase.bestF || activeFielders[0];
  let minFTime = chase.minFTime;
  game._chaser = bestF ? bestF.pos : '';
  game._ballX = shot.targetX;
  game._tag1 = false;
  const dpMark = { SS: '6-4-3', '2B': '4-6-3', '3B': '5-4-3', '1B': '3-6-3' };
  let formation = shot.isGrounder ? 'ground' : 'fly';
  let showTail = false;
  let fumble = false;
  let msg = foulNote;
  if (shot.detail) msg += shot.detail;
  if (shot.kick) msg += '⚡ ' + shot.kick.name + '에 맞고 불규칙 바운드! ';
  const infieldFly = !shot.isGrounder && game.outs < 2 && game.bases[0] && game.bases[1] && bestF && !bestF.isOF && shot.R >= 8 && shot.R <= 46 && shot.launchAngle >= 36 && shot.maxH >= 7 && minFTime <= shot.T_ball;
  if (!shot.liner && !shot.isGrounder && shot.R >= FENCE_DIST) {
    if (wallRob(bestF, shot)) {
      const outsNow = game.outs;
      const fenceScale = FENCE_DIST / shot.R;
      const catchT = shot.T_ball * fenceScale;
      const read = occupyFlyRead(catchT, outsNow);
      grantOuts(1);
      if (read.runs) addRuns(atk, def, read.runs);
      touchHeat(batter, 0);
      runnersAnim = read.anim;
      formation = 'fly';
      showTail = true;
      shot.animLandX = shot.targetX * fenceScale;
      shot.animLandY = shot.targetY * fenceScale;
      shot.animT = catchT;
      shot.targetX = shot.animLandX;
      shot.targetY = shot.animLandY;
      playCaption = { text: '담장 점프 호수비!', bad: true };
      msg += '🧱 ' + bestF.name + ' 담장 점프 호수비! 홈런성 타구를 잡아냈습니다. (' + shot.R.toFixed(0) + 'm)';
      if (read.runs) msg += ' ' + read.runs + '점은 포구 전에 홈을 밟았습니다.';
    } else {
      creditHit(atk, batter, 4);
      const res = advanceRunners(4, batter, false);
      addRuns(atk, def, res.runs);
      runnersAnim = res.animList;
      showTail = true;
      formation = 'hit';
      playCaption = { text: '홈런!', bad: false };
      msg += '🎉 ' + batter.name + ' ' + (res.runs === 4 ? '만루' : res.runs + '점') + ' 홈런! (비거리 ' + shot.R.toFixed(0) + 'm · 타구속도 ' + shot.exitSpeedKmh.toFixed(0) + 'km/h)';
    }
  } else if (infieldFly) {
    const outsNow = game.outs;
    const read = occupyFlyRead(shot.T_ball, outsNow);
    grantOuts(1);
    touchHeat(batter, 0);
    runnersAnim = read.anim;
    formation = 'fly';
    playCaption = { text: '인필드 플라이 자동 아웃!', bad: true };
    msg += '✋ 인필드 플라이! 자동 아웃 선언. 주자는 하프웨이에서 귀루합니다. (' + bestF.name + ')';
  } else if (!shot.liner && bestF && bestF.pos === 'P' && minFTime <= shot.T_ball && (shot.isGrounder ? shot.interceptR < 24 : (shot.launchAngle < 18 && shot.R < 28))) {
    const hands = ((pit.mnt || 70) + (pit.stm || 70)) / 2;
    const deflect = Math.random() < Math.max(0.025, Math.min(0.24, 0.05 + (70 - hands) * 0.0055));
    if (deflect) {
      creditHit(atk, batter, 1);
      const res = advanceRunners(1, batter, false);
      addRuns(atk, def, res.runs);
      runnersAnim = res.animList;
      runnersAnim.forEach(function (a) {
        if (a.startIdx === 0 && a.targetIdx === 1) a.overrunM = OVERRUN_M;
      });
      const deflectDelay = batterGroundDelay(batter);
      clockRunners(deflectDelay, 0);
      fumble = true;
      formation = 'ground';
      const pArm = armMetersPerSec((fielderBy('P') || { fld: 70 }).fld);
      const deflectD = Math.hypot(19.4 - shot.targetX, 19.4 - shot.targetY);
      const deflectDur = deflectD / pArm;
      const deflectBat = deflectDelay + 27.43 / runMetersPerSec(batter.spd);
      queueThrow({
        from: 'P', to: '1B', x0: shot.targetX, y0: shot.targetY, x1: 19.4, y1: 19.4,
        release: Math.max(shot.T_ball + 0.4, deflectBat + 0.12 - deflectDur), dur: deflectDur, arm: pArm
      });
      armCaption('내야안타! (1루 세이프)', 'safe1');
      msg += '🔥 투수 글러브에 맞고 굴절! ' + batter.name + ' 내야 안타.' + (res.runs ? ' (' + res.runs + '타점!)' : '');
    } else if (shot.isGrounder) {
      msg += resolveGround(atk, def, batter, pit, bestF, shot, dpMark);
      formation = game._form || formation;
    } else {
      const outsNow = game.outs;
      const read = occupyFlyRead(shot.T_ball, outsNow);
      grantOuts(1);
      if (read.runs) addRuns(atk, def, read.runs);
      touchHeat(batter, 0);
      runnersAnim = read.anim;
      playCaption = { text: '투수 직선타 처리!', bad: true };
      msg += '🧤 투수 강습 타구 정면 처리! ' + batter.name + ' 아웃.';
      if (read.runs) msg += ' ' + read.runs + '점은 포구 전에 홈을 밟았습니다.';
    }
  } else if (minFTime <= shot.T_ball) {
    let errRate = gloveMiss(bestF, batter);
    const early = shot.T_ball - minFTime;
    if (early > 0) errRate *= Math.max(0.45, 1 - early * 0.4);
    if (Math.random() < errRate) {
      const moveB = bestF.isOF ? 2 : 1;
      const outsNow = game.outs;
      const cast = [batter, game.bases[0], game.bases[1], game.bases[2]];
      const res = advanceRunners(moveB, batter, false);
      addRuns(atk, def, res.runs, false);
      chargeError(def);
      fumble = true;
      batter.chr = 0;
      playCaption = { text: '포구 실책!', bad: true };
      msg += '⚠️ ' + bestF.name + ' 포구 실책(E)! ' + batter.name + ' ' + moveB + '루까지 출루!';
      runnersAnim = res.animList;
      runnersAnim.forEach(function (a) {
        const who = a.startIdx === 0 ? batter : cast[a.startIdx];
        a.who = who;
        if (a.startIdx === 0 && a.targetIdx === 1) a.overrunM = OVERRUN_M;
        if (a.startIdx > 0) a.leadM = dynamicLead(who, pit);
        if (!shot.isGrounder && outsNow < 2 && (a.startIdx === 1 || a.startIdx === 2)) {
          a.holdM = HALFWAY_M;
          a.goAt = shot.T_ball;
          a.delay = 0;
        }
      });
      if (shot.isGrounder) clockRunners(batterGroundDelay(batter), 0);
      formation = shot.isGrounder ? 'ground' : 'fly';
    } else if (shot.isGrounder) {
      msg += resolveGround(atk, def, batter, pit, bestF, shot, dpMark);
      formation = game._form || formation;
    } else if (game.bases[2] && game.outs < 2) {
      const outsNow = game.outs;
      const runner = game.bases[2];
      const release = shot.T_ball + 0.32;
      const flight = throwFlight(bestF, shot.targetX, shot.targetY, 0, 0);
      const throwT = release + flight.dur;
      const tagT = shot.T_ball + JUDGE_BASE_M / runMetersPerSec(runner.spd);
      const slack = tagSlack(runner);
      let wild = Math.random() < throwMiss(bestF, batter, pit);
      const bounceDrop = !wild && flight.bounce && Math.random() < oneBounceMiss(fielderBy('C'));
      if (bounceDrop) wild = true;
      const jTag = wild ? null : judgeContest(tagT, throwT + slack, runner, bestF.fld, { force: false });
      const tagRelease = release - (!wild && jTag && jTag.cut ? jTag.cut : 0);
      queueThrow({
        from: bestF.pos, to: 'HOME', x0: shot.targetX, y0: shot.targetY, x1: wild ? 8 : 0, y1: wild ? -4 : 0, wild: wild,
        release: tagRelease, dur: flight.dur, arm: flight.arm, bounce: flight.bounce && !wild
      });
      const others = occupyFlyRead(shot.T_ball, outsNow, { 3: true });
      const send = wild || (jTag && jTag.go && !jTag.out);
      const tagOut = !wild && jTag && jTag.out;
      if (tagOut) {
        grantOuts(2);
        game.bases[2] = null;
        touchHeat(batter, 0);
        noteAdvanceOut(jTag.kind === 'assist' ? 'assist' : 'cs');
        noteBaseRace('HOME', jTag.tRun, jTag.tLive);
        playCaption = { text: '태그업 주루사!', bad: true };
        runnersAnim = [{ startIdx: 3, targetIdx: 4, speed: runMetersPerSec(runner.spd), delay: shot.T_ball, who: runner }].concat(others.anim);
        msg += '❌ ' + batter.name + ' 뜬공 아웃 (' + bestF.name + ' 포구). ' + runner.name + ' 태그업 승부, 홈에서 아웃.';
      } else if (!send) {
        grantOuts(1);
        touchHeat(batter, 0);
        runnersAnim = others.anim.concat([{
          startIdx: 3, targetIdx: 3, speed: runMetersPerSec(runner.spd), delay: 0, leadM: Math.min(3.6, dynamicLead(runner, pit)), who: runner,
          holdM: 4.2, goAt: Math.min(shot.T_ball, throwT), retreat: true
        }]);
        msg += '❌ ' + batter.name + ' 뜬공 아웃 (' + bestF.name + ' 포구). 3루 주자는 태그업을 포기.';
      } else {
        grantOuts(1);
        game.bases[2] = null;
        batter.ab--;
        bump(atk, 'sf', 1);
        touchHeat(batter, 0);
        addRuns(atk, def, 1);
        if (wild) { chargeError(def); playCaption = { text: bounceDrop ? '원바운드 포구 실책!' : '송구 악송구!', bad: true }; }
        else playCaption = { text: '희생플라이!', bad: false };
        if (!wild && jTag) noteBaseRace('HOME', jTag.tRun, jTag.tLive);
        msg += '👏 ' + batter.name + ' 희생플라이! 3루 주자 태그업 홈인 (1타점)' + (bounceDrop ? ' · 원바운드가 포수 뒤로 빠짐(E)' : (wild ? ' · 악송구(E)' : '')) + '!';
        runnersAnim = [{ startIdx: 3, targetIdx: 4, speed: runMetersPerSec(runner.spd), delay: shot.T_ball, who: runner }].concat(others.anim);
      }
      formation = 'fly';
    } else {
      const outsNow = game.outs;
      const read = occupyFlyRead(shot.T_ball, outsNow);
      grantOuts(1);
      if (read.runs) addRuns(atk, def, read.runs);
      touchHeat(batter, 0);
      runnersAnim = read.anim;
      if (shot.liner && shot.liner.jump) msg += '❌ ' + batter.name + ' 점프 캐치 직선타 아웃 (' + bestF.name + ', ' + shot.liner.z.toFixed(2) + 'm)';
      else if (shot.liner) msg += '❌ ' + batter.name + ' 직선타 아웃 (' + bestF.name + ' 포구, ' + shot.liner.z.toFixed(2) + 'm)';
      else if (shot.callPlay) msg += '❌ ' + batter.name + ' 내야 뜬공 콜 플레이 아웃 (' + bestF.name + ' 포구)';
      else msg += '❌ ' + batter.name + ' 뜬공 아웃 (' + bestF.name + ' 포구)';
      if (read.runs) msg += ' ' + read.runs + '점은 포구 전에 홈을 밟았습니다.';
      formation = 'fly';
    }
  } else {
    const bounced = playBounce(atk, def, batter, shot, bestF, minFTime);
    msg += bounced.msg;
    bestF = bounced.fielder || bestF;
    showTail = bounced.showTail;
    formation = bounced.formation;
  }
  markDeepBall(shot);
  setGoals(bestF.pos, shot.targetX, shot.targetY, formation);
  ball = makeBall(shot, showTail, fumble);
  return msg;
}
function resolveSelfPivot(atk, def, batter, pit, bestF, shot, hand) {
  const lead = game.bases[0];
  const r2 = game.bases[1];
  const batDelay = batterGroundDelay(batter);
  const batTime = batDelay + JUDGE_BASE_M / runMetersPerSec(batter.spd);
  const toBag = Math.hypot(shot.targetX, shot.targetY - 38.8);
  const touchT = shot.T_ball + toBag / moveSpeed(bestF);
  const rel = touchT + 0.20 + (hand.backhand ? 0.16 : 0) + (shot.fieldDelay || 0);
  const flight = throwFlight(bestF, 0, 38.8, 19.4, 19.4, hand.armScale);
  const throwT = rel + flight.dur;
  const leadTime = JUDGE_BASE_M / runMetersPerSec(lead.spd);
  const got2 = touchT <= leadTime + 1e-9;
  const jPivot = judgeContest(batTime, throwT, batter, bestF.fld, { force: true });
  const relOut = rel - (jPivot.cut || 0);
  const mark = bestF.pos === '2B' ? '4-3' : '6-3';
  const note = hand.backhand ? ' · 백핸드 역동작' : '';
  bestF.relayLeg = { at: shot.T_ball, x: 0, y: 38.8 };
  game._selfPivot = bestF.pos;
  game._form = 'dp';
  const wild = Math.random() < throwMiss(bestF, batter, pit);
  const got1 = !wild && jPivot.out;
  queueThrow({
    from: bestF.pos, to: '1B', x0: 0, y0: 38.8, x1: 19.4, y1: 19.4,
    release: wild ? rel : relOut, dur: flight.dur, arm: flight.arm, bounce: flight.bounce && !wild, wild: wild
  });
  if (!wild) noteBaseRace('1B', jPivot.tRun, jPivot.tLive);
  if (wild) {
    chargeError(def);
    batter.chr = 0;
    playCaption = { text: '송구 악송구!', bad: true };
    if (got2) {
      grantOuts(1);
      touchHeat(batter, 0);
      const anim = [
        { startIdx: 1, targetIdx: 2, speed: runMetersPerSec(lead.spd), delay: 0 },
        { startIdx: 0, targetIdx: 2, speed: runMetersPerSec(batter.spd), delay: batDelay }
      ];
      if (r2) anim.push({ startIdx: 2, targetIdx: 3, speed: runMetersPerSec(r2.spd) });
      game.bases = [null, batter, r2 || null];
      runnersAnim = anim;
      return '⚠️ ' + bestF.name + '이 2루를 밟았지만 1루 송구가 빠졌습니다(E)! ' + batter.name + '은 2루.' + note;
    }
    const res = advanceRunners(2, batter, false);
    addRuns(atk, def, res.runs, false);
    runnersAnim = res.animList;
    clockRunners(batDelay, 0);
    return '⚠️ ' + bestF.name + ' 피벗 송구 악송구(E)! 타자 2루 진루!' + note;
  }
  if (got2 && got1) {
    grantOuts(2);
    touchHeat(batter, 0);
    const anim = [
      { startIdx: 1, targetIdx: 2, speed: runMetersPerSec(lead.spd), delay: 0 },
      { startIdx: 0, targetIdx: 1, speed: runMetersPerSec(batter.spd), delay: batDelay }
    ];
    let n3 = null;
    if (r2) {
      n3 = r2;
      anim.push({ startIdx: 2, targetIdx: 3, speed: runMetersPerSec(r2.spd) });
    }
    game.bases = [null, null, n3];
    runnersAnim = anim;
    playCaption = { text: mark + ' 병살!', bad: false };
    return '💥 ' + mark + ' 병살! ' + bestF.name + '이 2루를 직접 밟고 1루로 송구.' + note;
  }
  if (got2) {
    grantOuts(1);
    batter.chr = 0;
    const anim = [
      { startIdx: 1, targetIdx: 2, speed: runMetersPerSec(lead.spd), delay: 0 },
      { startIdx: 0, targetIdx: 1, speed: runMetersPerSec(batter.spd), delay: batDelay }
    ];
    let n2 = null;
    let n3 = null;
    if (r2) {
      n3 = r2;
      anim.push({ startIdx: 2, targetIdx: 3, speed: runMetersPerSec(r2.spd) });
    }
    game.bases = [batter, n2, n3];
    runnersAnim = anim;
    playCaption = { text: '야수 선택!', bad: false };
    armCaption('1루 세이프', 'safe1');
    return '🧤 ' + bestF.name + '이 2루를 직접 밟아 선행 주자 아웃. ' + batter.name + '은 1루 세이프.' + note;
  }
  if (got1) {
    grantOuts(1);
    touchHeat(batter, 0);
    const anim = [
      { startIdx: 1, targetIdx: 2, speed: runMetersPerSec(lead.spd), delay: 0 },
      { startIdx: 0, targetIdx: 1, speed: runMetersPerSec(batter.spd), delay: batDelay }
    ];
    if (r2) anim.push({ startIdx: 2, targetIdx: 3, speed: runMetersPerSec(r2.spd) });
    game.bases = [null, lead, r2 || null];
    runnersAnim = anim;
    playCaption = { text: mark + ' 아웃', bad: true };
    return '❌ ' + batter.name + ' 땅볼 아웃 (' + mark + '). 선행 주자는 2루 세이프.' + note;
  }
  const scored = settleHit(atk, def, batter, 1, 0, 38.8, rel, bestF.fld, null, null, {
    batterDelay: batDelay,
    pit: pit,
    ballX: shot.targetX,
    ballY: shot.targetY,
    twoOut: game.outs >= 2,
    lockBatter: 1,
    who: bestF,
    committed: true
  });
  clockRunners(batDelay, 'dyn');
  armCaption('내야안타! (1루 세이프)', 'safe1');
  game._form = 'ground';
  return '🔥 ' + batter.name + ' 내야 안타! ' + bestF.name + '의 2루 터치가 늦었습니다.' + note + (scored.note ? ' · ' + scored.note : '') + (scored.runs > 0 ? ' (' + scored.runs + '타점!)' : '');
}
function resolveGround(atk, def, batter, pit, bestF, shot, dpMark) {
  const batDelay = batterGroundDelay(batter);
  const batTime1B = batDelay + JUDGE_BASE_M / runMetersPerSec(batter.spd);
  if (game.infieldIn && game.bases[2] && game.outs < 2) {
    const r3 = game.bases[2];
    const homePrep = groundRelease(bestF, shot, 0.38);
    const homeFlight = throwFlight(bestF, shot.targetX, shot.targetY, 0, 0, homePrep.armScale);
    const throwT = shot.T_ball + homePrep.pad + homeFlight.dur;
    const runT = 0.28 + JUDGE_BASE_M / runMetersPerSec(r3.spd);
    let wild = Math.random() < throwMiss(bestF, batter, pit);
    const bounceDrop = !wild && homeFlight.bounce && Math.random() < oneBounceMiss(fielderBy('C'));
    if (bounceDrop) wild = true;
    const jHome = wild ? { go: true, out: false, cut: 0, hold: false, tRun: runT, tLive: throwT, kind: 'safe' } : judgeContest(runT, throwT + tagSlack(r3), r3, bestF.fld, { force: false });
    if (!wild && !jHome.go) {
      const to1 = throwFlight(bestF, shot.targetX, shot.targetY, 19.4, 19.4, homePrep.armScale);
      const followRelease = shot.T_ball + homePrep.pad;
      const followAt = followRelease + to1.dur;
      const coverLag = bestF.pos === '1B' && to1.dist > 11 ? pitcherCoverArrive() : 0;
      const decide1 = Math.max(followAt, coverLag);
      const jBat = judgeContest(batTime1B, decide1, batter, bestF.fld, { force: true, floor: coverLag > 0 ? coverLag : null });
      const rel1 = followRelease - (jBat.cut || 0);
      queueThrow({
        from: bestF.pos, to: '1B', x0: shot.targetX, y0: shot.targetY, x1: 19.4, y1: 19.4,
        release: rel1, dur: to1.dur, arm: to1.arm, bounce: to1.bounce
      });
      noteBaseRace('1B', batTime1B, jBat.tLive);
      const retreat = {
        startIdx: 3, targetIdx: 3, speed: runMetersPerSec(r3.spd), delay: 0,
        leadM: Math.min(3.6, dynamicLead(r3, pit)), who: r3,
        holdM: 4.2, goAt: Math.min(shot.T_ball, throwT), retreat: true
      };
      if (jBat.out) {
        grantOuts(1);
        touchHeat(batter, 0);
        runnersAnim = [retreat, { startIdx: 0, targetIdx: 1, speed: runMetersPerSec(batter.spd), delay: batDelay, who: batter }];
        game._form = 'home';
        playCaption = { text: '홈 승부 포기', bad: false };
        return '⬇ 내야 전진. 3루 주자는 승부를 접고, ' + batter.name + '은 1루 아웃.';
      }
      const settled = settleHit(atk, def, batter, 1, shot.targetX, shot.targetY, rel1, bestF.fld, null, null, {
        batterDelay: batDelay, pit: pit, ballX: shot.targetX, ballY: shot.targetY,
        twoOut: false, lockBatter: 1, who: bestF, stayAt: { 3: true }, committed: true
      });
      clockRunners(batDelay, 'dyn');
      runnersAnim.forEach(function (a) {
        if (a.who === r3 || a.startIdx === 3) {
          a.targetIdx = 3;
          a.retreat = true;
          a.holdM = 4.2;
          a.goAt = Math.min(shot.T_ball, throwT);
          a.leadM = Math.min(3.6, dynamicLead(r3, pit));
          a.delay = 0;
        }
      });
      game._form = 'ground';
      armCaption('내야안타! (1루 세이프)', 'safe1');
      return '⬇ 3루 주자는 홈에서 멈추고, ' + batter.name + ' 내야 안타.' + (settled.runs ? ' (' + settled.runs + '타점)' : '');
    }
    if (wild) chargeError(def);
    const homeRelease = shot.T_ball + homePrep.pad - (wild ? 0 : (jHome.cut || 0));
    queueThrow({
      from: bestF.pos, to: 'HOME', x0: shot.targetX, y0: shot.targetY, x1: wild ? 6 : 0, y1: wild ? -3 : 0, wild: wild,
      release: homeRelease, dur: homeFlight.dur, arm: homeFlight.arm, bounce: homeFlight.bounce && !wild
    });
    if (!wild) noteBaseRace('HOME', jHome.tRun, jHome.tLive);
    if (!wild && jHome.out) {
      noteAdvanceOut(jHome.kind === 'assist' ? 'assist' : 'cs');
      grantOuts(1);
      const r1 = game.bases[0], r2 = game.bases[1];
      let n2 = null, n3 = null;
      const anim = [{ startIdx: 3, targetIdx: 4, speed: runMetersPerSec(r3.spd), delay: 0.28 }, { startIdx: 0, targetIdx: 1, speed: runMetersPerSec(batter.spd), delay: batDelay }];
      if (r1 && r2) { n2 = r1; n3 = r2; anim.push({ startIdx: 1, targetIdx: 2, speed: runMetersPerSec(r1.spd) }); anim.push({ startIdx: 2, targetIdx: 3, speed: runMetersPerSec(r2.spd) }); }
      else if (r2) { n3 = r2; anim.push({ startIdx: 2, targetIdx: 3, speed: runMetersPerSec(r2.spd) }); }
      else if (r1) { n2 = r1; anim.push({ startIdx: 1, targetIdx: 2, speed: runMetersPerSec(r1.spd) }); }
      game.bases = [batter, n2, n3];
      runnersAnim = anim;
      batter.chr = 0;
      game._form = 'home';
      playCaption = { text: '홈 태그 아웃!', bad: true };
      return '⬇ 내야 전진 수비! 홈 송구로 3루 주자 태그 아웃. ' + batter.name + '은 야수 선택으로 1루 세이프.';
    }
    addRuns(atk, def, 1);
    game.bases[2] = null;
    const to1 = throwFlight(bestF, shot.targetX, shot.targetY, 19.4, 19.4, homePrep.armScale);
    const followRelease = shot.T_ball + homePrep.pad;
    const followAt = followRelease + to1.dur;
    const coverAt = bestF.pos === '1B' && to1.dist > 11 ? pitcherCoverArrive() : 0;
    const decide1 = Math.max(followAt, coverAt);
    const jFollow = wild ? null : judgeContest(batTime1B, decide1, batter, bestF.fld, { force: true, floor: coverAt > 0 ? coverAt : null });
    const relFollow = followRelease - (jFollow && jFollow.cut ? jFollow.cut : 0);
    if (jFollow) noteBaseRace('1B', jFollow.tRun, jFollow.tLive);
    if (jFollow && jFollow.out) {
      grantOuts(1);
      touchHeat(batter, 0);
      game._form = 'home';
      runnersAnim = [
        { startIdx: 3, targetIdx: 4, speed: runMetersPerSec(r3.spd), delay: 0.28 },
        { startIdx: 0, targetIdx: 1, speed: runMetersPerSec(batter.spd), delay: batDelay }
      ];
      queueThrow({
        from: bestF.pos, to: '1B', x0: shot.targetX, y0: shot.targetY, x1: 19.4, y1: 19.4,
        release: relFollow, dur: to1.dur, arm: to1.arm, bounce: to1.bounce
      });
      playCaption = { text: '홈 승부 세이프', bad: false };
      return '⬇ 내야 전진! 3루 주자 홈 세이프 득점, ' + batter.name + '은 1루 아웃.';
    }
    creditHit(atk, batter, 1);
    const res = advanceRunners(1, batter, false);
    addRuns(atk, def, res.runs);
    res.animList.push({ startIdx: 3, targetIdx: 4, speed: runMetersPerSec(r3.spd), delay: 0.28 });
    runnersAnim = res.animList;
    clockRunners(batDelay, 0);
    game._form = 'ground';
    queueThrow({
      from: bestF.pos, to: '1B', x0: shot.targetX, y0: shot.targetY, x1: 19.4, y1: 19.4,
      release: relFollow, dur: to1.dur, arm: to1.arm, bounce: to1.bounce && !wild
    });
    if (wild) playCaption = { text: bounceDrop ? '원바운드 포구 실책!' : '송구 악송구!', bad: true };
    else armCaption('내야안타! (1루 세이프)', 'safe1');
    return '⬇ 내야 전진 수비 사이 내야 안타! 3루 주자 홈인.' + (bounceDrop ? ' 원바운드가 뒤로 빠짐(E)!' : (wild ? ' 홈 송구 악송구(E)!' : '')) + (coverAt > batTime1B && followAt <= batTime1B ? ' 투수 1루 커버가 늦었습니다.' : '') + (res.runs ? ' (' + res.runs + '타점)' : '');
  }
  const hand = groundRelease(bestF, shot, 0.4);
  const note = hand.backhand ? ' · 백핸드 역동작' : '';
  if ((bestF.pos === '2B' || bestF.pos === 'SS') && groundsNearSecond(shot) && game.bases[0] && !game.bases[2] && game.outs < 2) {
    return resolveSelfPivot(atk, def, batter, pit, bestF, shot, hand);
  }
  const flight0 = throwFlight(bestF, shot.targetX, shot.targetY, 19.4, 19.4, hand.armScale);
  let flight = flight0;
  let release = shot.T_ball + hand.pad;
  let throwTime = release + flight.dur;
  let cover = false;
  let coverAt = 0;
  let firstCarry = null;
  if (bestF.pos === '1B') {
    const distBag = Math.hypot((shot.targetX || 0) - 19.4, (shot.targetY || 0) - 19.4);
    const fieldAt = Math.max(shot.T_ball, arriveTime(bestF, shot.targetX, shot.targetY));
    const runDur = distBag / Math.max(0.1, moveSpeed(bestF));
    const runTouch = fieldAt + runDur;
    const mound = fielderBy('P');
    const pArrive = mound ? pitcherCoverArrive() : Infinity;
    const syncedRel = mound ? Math.max(release, pArrive - flight0.dur) : release;
    const throwPlay = syncedRel + flight0.dur;
    if (distBag <= 6.5 || !mound || runTouch <= throwPlay + 1e-9) {
      firstCarry = { release: fieldAt, dur: Math.max(1e-4, runDur) };
      flight = { arm: moveSpeed(bestF), dist: distBag, dur: firstCarry.dur, bounce: false };
      release = fieldAt;
      throwTime = runTouch;
    } else {
      cover = true;
      coverAt = pArrive;
      release = syncedRel;
      flight = flight0;
      throwTime = throwPlay;
      game._coverP = true;
      game._tag1 = false;
    }
  }
  const decideTime = cover ? Math.max(throwTime, coverAt) : throwTime;
  const j1 = judgeContest(batTime1B, decideTime, batter, bestF.fld, {
    force: true,
    floor: cover ? coverAt : null
  });
  if (j1.cut) {
    release -= j1.cut;
    throwTime -= j1.cut;
  }
  const rawThrow = (shot.T_ball + hand.pad) + flight0.dur;
  const lateCover = cover && coverAt > batTime1B + 1e-9 && rawThrow <= batTime1B + 1e-9;
  function queueFirstOut() {
    if (firstCarry && bestF) {
      bestF.relayLeg = { at: firstCarry.release, x: 19.4, y: 19.4 };
      game._tag1 = true;
      game._coverP = false;
    }
    queueThrow({
      from: bestF.pos, to: '1B', carry: !!firstCarry,
      x0: shot.targetX, y0: shot.targetY, x1: 19.4, y1: 19.4,
      release: release, dur: flight.dur, arm: flight.arm, bounce: !!flight.bounce && !firstCarry
    });
    noteBaseRace('1B', batTime1B, j1.tLive);
  }
  const wild = Math.random() < throwMiss(bestF, batter, pit);
  const drop = !wild && flight.bounce && !cover && Math.random() < oneBounceMiss(fielderBy('1B'));
  if (wild || drop) {
    const res = advanceRunners(2, batter, false);
    addRuns(atk, def, res.runs, false);
    chargeError(def);
    batter.chr = 0;
    playCaption = { text: drop ? '원바운드 포구 실책!' : '송구 악송구!', bad: true };
    runnersAnim = res.animList;
    clockRunners(batDelay, 0);
    queueThrow({
      from: bestF.pos, to: '1B', x0: shot.targetX, y0: shot.targetY, x1: 30, y1: 12, wild: true,
      release: shot.T_ball + hand.pad, dur: flight0.dur, arm: flight0.arm
    });
    game._form = 'ground';
    return (drop ? '⚠️ ' + bestF.name + ' 원바운드 송구가 1루 뒤로 빠졌습니다(E)! 타자 2루 진루!' : '⚠️ ' + bestF.name + ' 송구 악송구(E)! 타자 2루 진루!') + note;
  }
  if (j1.out) {
    const canTurn = !!(game.bases[0] && game.outs < 2 && !game.bases[2] && dpMark[bestF.pos]);
    const leadTime = game.bases[0] ? JUDGE_BASE_M / runMetersPerSec(game.bases[0].spd) : 9;
    if (canTurn) {
      const pivot = (bestF.pos === '2B' || bestF.pos === '1B') ? 'SS' : '2B';
      const pivotF = fielderBy(pivot) || bestF;
      const toss = throwFlight(bestF, shot.targetX, shot.targetY, 0, 38.8, hand.armScale);
      const back = throwFlight(pivotF, 0, 38.8, 19.4, 19.4, 1);
      const rel1 = shot.T_ball + 0.32 + (hand.backhand ? 0.16 : 0) + (shot.fieldDelay || 0);
      const turnT = rel1 + toss.dur + 0.22 + back.dur;
      if (turnT < leadTime && turnT < batTime1B + 0.08) {
        const leadRunner = game.bases[0];
        grantOuts(2);
        game.bases[0] = null;
        touchHeat(batter, 0);
        game._form = 'dp';
        playCaption = { text: dpMark[bestF.pos] + ' 병살!', bad: false };
        queueThrow({ from: bestF.pos, to: '2B', toPos: pivot, x0: shot.targetX, y0: shot.targetY, x1: 0, y1: 38.8, release: rel1, dur: toss.dur, arm: toss.arm, bounce: toss.bounce });
        queueThrow({ from: pivot, to: '1B', toPos: bestF.pos === '1B' ? 'P' : null, x0: 0, y0: 38.8, x1: 19.4, y1: 19.4, release: rel1 + toss.dur + 0.22, dur: back.dur, arm: back.arm, bounce: back.bounce });
        noteBaseRace('1B', batTime1B, turnT);
        runnersAnim = [
          { startIdx: 1, targetIdx: 2, speed: runMetersPerSec(leadRunner.spd), delay: 0 },
          { startIdx: 0, targetIdx: 1, speed: runMetersPerSec(batter.spd), delay: batDelay }
        ];
        return '💥 ' + dpMark[bestF.pos] + ' 병살타! ' + bestF.name + ' → 2루 → 1루 아웃!' + note;
      }
    }
    const fcPos = bestF.pos === 'SS' || bestF.pos === '2B' || bestF.pos === '3B' || bestF.pos === 'P';
    if (game.bases[0] && !game.bases[2] && game.outs < 2 && fcPos && Math.random() < 0.72) {
      game._form = 'dp';
      return layFielderChoice(batter, bestF, shot, flight.arm);
    }
    const lone2 = game.bases[1] && !game.bases[0] && !game.bases[2] && game.outs < 2;
    if (lone2 && shot.targetX > 4) {
      const r2 = game.bases[1];
      grantOuts(1);
      touchHeat(batter, 0);
      queueFirstOut();
      runnersAnim = [
        { startIdx: 0, targetIdx: 1, speed: runMetersPerSec(batter.spd), delay: batDelay, who: batter },
        baserunPlan(r2, 2, 3, { pit: pit })
      ];
      game.bases = [null, null, r2];
      game._form = 'ground';
      return '❌ ' + batter.name + ' 땅볼 아웃 (' + bestF.name + ' → 1루). ' + r2.name + ' 진루타 3루.' + note;
    }
    if (lone2 && shot.targetX < -4) {
      const r2 = game.bases[1];
      grantOuts(1);
      touchHeat(batter, 0);
      queueFirstOut();
      const lead = dynamicLead(r2, pit);
      runnersAnim = [
        { startIdx: 0, targetIdx: 1, speed: runMetersPerSec(batter.spd), delay: batDelay, who: batter },
        { startIdx: 2, targetIdx: 2, speed: runMetersPerSec(r2.spd), delay: 0, leadM: lead, who: r2, holdM: HALFWAY_M, goAt: shot.T_ball, retreat: true }
      ];
      game._form = 'ground';
      return '❌ ' + batter.name + ' 땅볼 아웃 (' + bestF.name + ' → 1루). ' + r2.name + '은 타구를 보고 2루에 남았습니다.' + note;
    }
    const sprint = twoOutSprint(decideTime);
    grantOuts(1);
    touchHeat(batter, 0);
    queueFirstOut();
    runnersAnim = [{ startIdx: 0, targetIdx: 1, speed: runMetersPerSec(batter.spd), delay: batDelay, who: batter }].concat(sprint);
    game._form = 'ground';
    return '❌ ' + batter.name + ' 땅볼 아웃 (' + bestF.name + ' → 1루)' + note;
  }
  const scored = settleHit(atk, def, batter, 1, shot.targetX, shot.targetY, release, bestF.fld, null, null, {
    hold2: game.outs < 2 && !!game.bases[1] && !game.bases[0] && !game.bases[2] && shot.targetX < -4,
    dropAt: shot.T_ball,
    batterDelay: batDelay,
    pit: pit,
    ballX: shot.targetX,
    ballY: shot.targetY,
    twoOut: game.outs >= 2,
    lockBatter: 1,
    who: bestF
  });
  clockRunners(batDelay, 'dyn');
  if (scored.throwTo && scored.throwTo.judge && scored.throwTo.judge.out) queueContestThrow(bestF, scored.throwTo);
  else queueFirstOut();
  armCaption('내야안타! (1루 세이프)', 'safe1');
  game._form = 'ground';
  let tail = note;
  if (lateCover) tail += ' · 투수 1루 커버가 늦었습니다';
  else if (flight.bounce) tail += ' · 원바운드 송구';
  return '🔥 ' + batter.name + ' 빠른 발로 내야 안타!' + tail + (scored.note ? ' · ' + scored.note : '') + (scored.runs > 0 ? ' (' + scored.runs + '타점!)' : '');
}
function flushInningChange() {
  if (!game || !game._closeInning) return;
  game._closeInning = false;
  const changeMsg = checkInningChange();
  if (!changeMsg) return;
  const el = document.getElementById('broadcastText');
  const base = el && el.textContent ? el.textContent : '';
  if (base.indexOf(changeMsg) >= 0) updateUI(base);
  else updateUI(base ? (base + ' | ' + changeMsg) : changeMsg);
}
function finishPlate(atkTeam, batter, usedBatter, hook, msg, mentalNote, dur, skipAnim) {
  if (batter) batter._pa = null;
  if (usedBatter) atkTeam.idx = (atkTeam.idx + 1) % 9;
  const liveBall = !skipAnim && !!ball;
  const changeMsg = liveBall ? '' : checkInningChange();
  game._closeInning = liveBall;
  if (hook) msg = hook + ' | ' + msg;
  if (mentalNote) msg += mentalNote;
  if (game.infieldIn && msg.indexOf('내야 전진') < 0) msg = '⬇ 내야 전진 수비. ' + msg;
  if (game.outfieldIn && msg.indexOf('외야 전진') < 0) msg = '🌲 외야 전진. ' + msg;
  if (game.outfieldDeep && msg.indexOf('외야 깊게') < 0) msg = '🌲 외야 깊게. ' + msg;
  if (pitchFx && msg.indexOf(pitchFx.name) < 0) msg = pitchFx.name + ' · ' + msg;
  if (changeMsg) msg += ' | ' + changeMsg;
  const deferPlay = !skipAnim && !!(ball || throwPlan.length);
  if (deferPlay) {
    game._finalBanner = msg;
    game._heldCaption = captionGate ? null : playCaption;
    game._outsHeld = game._outsThisPlay || 0;
    game._holdOuts = game._outsHeld > 0;
    game._deferResult = true;
    game._revealed = false;
    game._revealAt = null;
    if (!captionGate) playCaption = ball ? { text: '타격!', bad: false } : null;
    updateUI(ball ? '타격!' : '플레이 진행 중...');
  } else {
    game._deferResult = false;
    game._holdOuts = false;
    updateUI(msg);
  }
  glove = null;
  if (!skipAnim && ball && game._catch) {
    glove = {
      pos: game._catch.pos, x: game._catch.x, y: game._catch.y, caught: false, hop: false,
      air: !!game._catch.air, holdUntilMs: 0
    };
  }
  if (skipAnim) {
    runnersAnim = []; throwSeq = []; throwPlan = []; throwBall = null; glove = null; pitchFx = null; ball = null;
    drawField();
    if (game.isOver) finishMatch();
    return;
  }
  if (ball) {
    if (runnersAnim.length === 0) runnersAnim.push({ startIdx: 0, targetIdx: 1, speed: runMetersPerSec(batter.spd) });
    primeRunners();
    startBallAnim();
    return;
  }
  if (runnersAnim.length || pitchFx || throwSeq.length || throwPlan.length) {
    primeRunners();
    runClockAnim(dur || 0.85);
    return;
  }
  drawField();
  if (game.isOver) finishMatch();
}
function startBallAnim() {
  runTimeline(0, true);
}
function showPaBanner(atk, batter) {
  const el = document.getElementById('paBanner');
  if (!el || !batter) return;
  el.hidden = false;
  el.textContent = (atk.idx + 1) + '번 ' + batter.name + ' · ' + (batterHand(batter) === 'L' ? '좌타' : '우타') + ' · 오늘 ' + (batter.ab || 0) + '타수 ' + (batter.h || 0) + '안타 ' + (batter.hr || 0) + '홈런';
}
function playAtBat(skipAnim) {
  if (!game) return;
  if (animId) cancelAnimationFrame(animId);
  animId = null;
  if (game._closeInning) flushInningChange();
  if (game.isOver) {
    finishMatch();
    return;
  }
  game._skip = !!skipAnim;
  game.banner = '';
  game.infieldIn = false;
  game.outfieldIn = false;
  game.outfieldDeep = false;
  game._outsThisPlay = 0;
  game._deferResult = false;
  game._holdOuts = false;
  game._revealed = false;
  game._relay = null;
  game._deepBall = false;
  game.aura = false;
  game._form = '';
  setupDefenseFielders();
  throwBall = null; throwSeq = []; throwPlan = []; glove = null; captionGate = null; captionHoldUntil = 0;
  runnersAnim = []; ball = null; pitchFx = null;
  game._tag1 = false; game._coverP = false; game._needBag = ''; game._chaser = ''; game._catch = null; game._sac3 = false; game._homeOut = null; game._backstop = false; game._selfPivot = ''; game.rbiBatter = null;
  view.zoom = 1; view.target = 1; view.zoomAt = 0; view.zoomOut = -1;

  const atkTeam = game.isTop ? game.away : game.home;
  const defTeam = game.isTop ? game.home : game.away;
  const hook = maybeRelieve(defTeam, atkTeam);
  if (hook) {
    setupDefenseFielders();
    playCaption = { text: '투수 교체', bad: false };
  } else playCaption = null;
  const batter = atkTeam.batters[atkTeam.idx];
  const pit = defTeam.pitcher;
  showPaBanner(atkTeam, batter);

  const wild = resolveWildPitch(atkTeam, defTeam);
  if (wild) return finishPlate(atkTeam, batter, false, hook, wild.msg, '', wild.dur, skipAnim);
  const side = resolveSidePlay(atkTeam, defTeam);
  if (side) return finishPlate(atkTeam, batter, false, hook, side.msg, '', side.dur, skipAnim);

  game.rbiBatter = batter;
  game.infieldIn = applyInfieldIn();
  game.outfieldDeep = applyOutfieldDepth(batter);
  game.outfieldIn = applyWalkoffOutfieldIn();
  const fatiguePenalty = Math.max(0, (70 - pit.stamina) * 0.25);
  const stm = pit.stm == null ? 70 : pit.stm;
  const drain = Math.max(0.35, Math.min(2.2, 1.1 * (1 - (stm - 70) * 0.012)));
  let effSpd = pit.spd - fatiguePenalty;
  let effCtrl = pit.ctrl - fatiguePenalty;
  let effStuff = pit.stuff;
  const mnt = pit.mnt == null ? 70 : pit.mnt;
  const fastOnFirst = !!(game.bases[0] && game.bases[0].spd >= 70);
  const risp = !!(game.bases[1] || game.bases[2]);
  let mentalNote = '';
  if (fastOnFirst && mnt < 70) {
    effCtrl -= (70 - mnt) * 0.18;
    mentalNote = ' (주자의식)';
  }
  if (risp && mnt > 70) {
    const clutch = (mnt - 70) * 0.14;
    effStuff += clutch;
    effCtrl += clutch;
    mentalNote += ' (위기관리)';
  }
  if (applyPullShift(batter)) mentalNote += ' (당겨치기 시프트)';
  pit.stamina = Math.max(8, pit.stamina - drain);
  const seq = sequenceEdge(pit, effSpd, effCtrl);
  if (seq.show) mentalNote += ' (완급조절)';
  if (!skipAnim) beginPitch(pit);
  const fam = noteFamiliarity(batter, pit);
  if (fam.look >= 2 && fam.bonus > 0) mentalNote += ' (' + fam.look + '번째 타석)';
  const seeRct = batter.rct + fam.bonus;
  const seeCon = batter.con + fam.bonus;
  game.aura = (batter.heat || 0) >= 2 || risp;

  const bunt = resolveBunt(atkTeam, defTeam, batter, pit);
  if (bunt) return finishPlate(atkTeam, batter, true, hook, bunt.msg, mentalNote, bunt.dur, skipAnim);

  const launch = batter.launch != null ? batter.launch : 12;
  const frame = catcherFrameBonus();
  const bbRate = Math.max(0.02, Math.min(0.28, 0.095 + (seeRct - 70) * 0.00105 + (batter.pow - 70) * 0.0005 - (launch - 12) * 0.0012 - (effCtrl - 70) * 0.00105 - (effSpd - 70) * 0.0005 - frame));
  let kRate = Math.max(0.06, Math.min(0.48, 0.19 + (launch - 12) * 0.0045 - (seeRct - 70) * 0.00115 - (seeCon - 70) * 0.00095 + (effSpd - 70) * 0.00115 + (pit.brk - 70) * 0.00095 + frame));
  if (seq.kAdd) kRate = Math.min(0.5, kRate + seq.kAdd);
  let hbpP = 0;
  if (effCtrl < 72 && batter.rct < 72) hbpP = 0.005 + Math.min(0.005, ((72 - effCtrl) + (72 - batter.rct)) * 0.00012);
  if (Math.random() < hbpP) {
    const res = advanceRunners(1, batter, true);
    addRuns(atkTeam, defTeam, res.runs);
    runnersAnim = res.animList;
    bump(atkTeam, 'hbp', 1);
    batter.chr = 0;
    playCaption = { text: '몸에 맞는 볼!', bad: false };
    const msg = '💢 몸에 맞는 볼! ' + batter.name + ' 사구 출루.' + (res.runs ? ' (밀어내기 ' + res.runs + '득점!)' : '');
    return finishPlate(atkTeam, batter, true, hook, msg, mentalNote, 0.9, skipAnim);
  }

  const roll = Math.random();
  let outcome = 'bip';
  let checkCall = '';
  if (roll < bbRate) outcome = 'bb';
  else if (roll < bbRate + kRate) outcome = 'k';
  const eye = seeRct - (pit.brk || 70);
  if (outcome === 'k' && eye >= 12 && Math.random() < Math.min(0.22, (eye - 12) * 0.008)) {
    outcome = 'bb';
    checkCall = '볼';
  } else if (outcome === 'bip' && eye <= -12 && Math.random() < Math.min(0.18, (-eye - 12) * 0.006)) {
    outcome = 'k';
    checkCall = '헛스윙';
  } else if (outcome === 'k' && Math.random() < 0.18 + Math.max(0, 64 - seeRct) * 0.004) {
    checkCall = '헛스윙';
  } else if (outcome === 'bb' && Math.random() < 0.16 + Math.max(0, seeRct - 66) * 0.004) {
    checkCall = '볼';
  }
  let msg = '';
  let lead = '';
  if (outcome === 'bb') {
    const count = virtualCount('bb');
    lead = countLead(count, chargeCount(pit, count, 'bb'), 'bb');
    const res = advanceRunners(1, batter, true);
    addRuns(atkTeam, defTeam, res.runs);
    runnersAnim = res.animList;
    bump(atkTeam, 'bb', 1);
    batter.chr = 0;
    if (checkCall) playCaption = { text: '체크스윙 볼!', bad: false };
    msg = (checkCall ? '👁️ 체크스윙! 순발력으로 참아 볼 판정. ' : '🚶 ') + batter.name + ' 볼넷 출루!' + (res.runs > 0 ? ' (밀어내기 ' + res.runs + '득점!)' : '');
  } else if (outcome === 'k') {
    const count = virtualCount('k');
    lead = countLead(count, chargeCount(pit, count, 'k'), 'k');
    const drop = resolveDroppedThird(batter, pit, atkTeam, defTeam, checkCall);
    if (drop) msg = drop.msg;
    else {
      batter.ab++;
      grantOuts(1);
      bump(atkTeam, 'k', 1);
      touchHeat(batter, 0);
      playCaption = { text: checkCall === '헛스윙' ? '체크스윙 헛스윙!' : '삼진 아웃!', bad: true };
      msg = checkCall === '헛스윙' ? '💨 체크스윙 헛스윙 삼진! ' + batter.name + ' 아웃.' : '💨 ' + batter.name + ' 헛스윙 삼진 아웃!';
    }
  } else {
    const count = virtualCount('bip');
    lead = countLead(count, chargeCount(pit, count, 'bip'), 'bip');
    batter._pa = {
      con: seeCon,
      rct: seeRct,
      pow: batter.pow + (count.hitter ? 1.1 : 0) - (count.pitcher ? 0.55 : 0),
      effSpd: effSpd,
      seqKick: seq.kick,
      countHitter: !!count.hitter,
      countPitcher: !!count.pitcher
    };
    msg = resolveContact(atkTeam, defTeam, batter, pit, effCtrl, effStuff);
  }
  finishPlate(atkTeam, batter, true, hook, lead + msg, mentalNote, 0.9, skipAnim);
}

document.getElementById('btnNext').onclick = function() { playAtBat(false); };
document.querySelectorAll('[data-speed]').forEach(function (btn) {
  btn.onclick = function () {
    playSpeed = Number(btn.getAttribute('data-speed')) || 1;
    document.querySelectorAll('[data-speed]').forEach(function (b) { b.classList.toggle('on', b === btn); });
  };
});
document.getElementById('btnSim').onclick = function () {
  if (!game || game.isOver) return;
  if (animId) cancelAnimationFrame(animId);
  animId = null;
  while (game && !game.isOver) playAtBat(true);
};
document.getElementById('btnInning').onclick = function() {
  if (!game || game.isOver) return;
  const curInn = game.inning, curTop = game.isTop;
  while (!game.isOver && game.inning === curInn && game.isTop === curTop) playAtBat(true);
};
document.getElementById('btnFull').onclick = function() { while (game && !game.isOver) playAtBat(true); };
document.getElementById('btnNew').onclick = function() { initGame(); };
const mirrorButton = document.getElementById('btnMirror');
if (mirrorButton) mirrorButton.onclick = function () { initGame('mirror'); };
window.onkeydown = function(e) {
  if (e.code !== 'Space') return;
  const match = document.getElementById('match');
  if (!match || !match.classList.contains('on') || !game) return;
  e.preventDefault();
  playAtBat(false);
};
window.addEventListener('resize', function() { if (game) drawField(); });
