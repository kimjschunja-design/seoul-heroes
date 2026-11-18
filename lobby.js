const SAVE_KEY = 'seoul-heroes-club-v1';
const FRIENDLY_WIN_GOLD = 800;
const SCOUT_COST = Cards.SCOUT_COST;
const LEAGUE_GOLD = Cards.LEAGUE_GOLD;
const CLUBS = [
  { name: '서울 히어로즈', short: '서', color: '#e84142' },
  { name: '부산 마린스', short: '부', color: '#1f6feb' },
  { name: '대구 라이온즈', short: '대', color: '#d4a017' },
  { name: '인천 이글스', short: '인', color: '#e67e22' },
  { name: '광주 타이거즈', short: '광', color: '#8e44ad' },
  { name: '대전 베어스', short: '전', color: '#1e8449' },
  { name: '수원 위즈', short: '수', color: '#148f77' },
  { name: '창원 돌핀스', short: '창', color: '#5dade2' }
];
const TIERS = [
  { name: '루키', ovr: 50 },
  { name: '마이너', ovr: 62 },
  { name: '메이저', ovr: 74 },
  { name: '챔피언스', ovr: 85 },
  { name: '레전드', ovr: 92 }
];
const AWARD_BONUS = { mvp: 8000, avg: 3000, hr: 3000, rbi: 3000, w: 3000, era: 3000, sv: 3000 };
const SERIES_BONUS = 20000;
const NPC_NAMES = ['한태산','문시윤','배도겸','서강민','표지훈','남궁혁','진우성','라건우','설민호','도윤재','기성훈','마준서','편하늘','제갈준','봉태오'];

const popup = document.getElementById('popup');
const popupBody = document.getElementById('popupBody');
const lobbyEl = document.getElementById('lobby');
const matchEl = document.getElementById('match');
const cardStage = document.getElementById('cardStage');
const cardStageSlot = document.getElementById('cardStageSlot');
const cardStageNote = document.getElementById('cardStageNote');
const revealFx = document.getElementById('revealFx');

let state = loadState();
let selectedSlot = 0;
let scoutBusy = false;
let manageMode = 'enhance';
let enhanceId = null;
let tradePick = [];
let dexFilter = 'ALL';
let sheetView = null;
let stageAfter = null;
let revealRaf = 0;
let stageToken = 0;

const PEN_LABELS = ['승리조A', '승리조B', '추격조', '마무리'];
let lineupTab = 'bat';
let selectedStaff = { kind: 'sp', index: 0 };

function defaultState() {
  const cards = Cards.starter();
  const bats = cards.filter(function (c) { return !Cards.isPitcher(Cards.entry(c.dex)); });
  const sps = cards.filter(function (c) { return Cards.isStarter(Cards.entry(c.dex)); });
  const rps = cards.filter(function (c) { return Cards.isBullpen(Cards.entry(c.dex)); });
  return {
    teamName: '서울 히어로즈',
    gold: 10000,
    diamond: 100,
    wins: 0,
    losses: 0,
    level: 1,
    lastNote: '',
    lineup: bats.map(function (c) { return c.id; }),
    rotation: sps.map(function (c) { return c.id; }),
    bullpen: rps.map(function (c) { return c.id; }),
    rotationIndex: 0,
    cards: cards,
    dexSeen: cards.map(function (c) { return c.dex; }),
    league: freshLeague()
  };
}

function normalizeCard(raw) {
  if (!raw) return null;
  const dex = Math.round(Number(raw.dex));
  const entry = Cards.entry(dex);
  if (!entry) return null;
  const iv = [0, 0, 0, 0, 0, 0];
  if (Array.isArray(raw.iv)) {
    for (let i = 0; i < 6; i++) {
      let n = Math.round(Number(raw.iv[i]));
      if (!isFinite(n)) n = 0;
      iv[i] = Math.max(-4, Math.min(5, n));
    }
  }
  let plus = Math.round(Number(raw.plus) || 0);
  if (!isFinite(plus)) plus = 0;
  plus = Math.max(0, Math.min(Cards.MAX_PLUS[entry.grade], plus));
  return { id: raw.id ? String(raw.id) : Cards.newId(), dex: dex, iv: iv, plus: plus };
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!raw || typeof raw !== 'object') return defaultState();
    let cards = Array.isArray(raw.cards) ? raw.cards.map(normalizeCard).filter(Boolean) : [];
    const seenIds = {};
    cards = cards.filter(function (c) {
      if (seenIds[c.id]) return false;
      seenIds[c.id] = true;
      return true;
    });
    if (!cards.length) cards = Cards.starter();
    let bats = cards.filter(function (c) { return !Cards.isPitcher(Cards.entry(c.dex)); });
    if (bats.length < 9) {
      Cards.starter().forEach(function (s) {
        if (Cards.isPitcher(Cards.entry(s.dex))) return;
        if (bats.length < 9) { cards.push(s); bats.push(s); }
      });
    }
    const batIds = {};
    bats.forEach(function (c) { batIds[c.id] = true; });
    const lineup = [];
    (Array.isArray(raw.lineup) ? raw.lineup : []).forEach(function (id) {
      if (batIds[id] && lineup.indexOf(id) < 0 && lineup.length < 9) lineup.push(id);
    });
    bats.forEach(function (c) {
      if (lineup.length < 9 && lineup.indexOf(c.id) < 0) lineup.push(c.id);
    });
    const dexSeen = [];
    (Array.isArray(raw.dexSeen) ? raw.dexSeen : []).forEach(function (n) {
      n = Math.round(Number(n));
      if (n >= 1 && n <= 124 && dexSeen.indexOf(n) < 0) dexSeen.push(n);
    });
    cards.forEach(function (c) { if (dexSeen.indexOf(c.dex) < 0) dexSeen.push(c.dex); });
    const wins = Math.max(0, Math.round(Number(raw.wins) || 0));
    const staffSeed = [];
    if (Array.isArray(raw.rotation)) raw.rotation.forEach(function (id) { staffSeed.push(id); });
    if (raw.pitcherId) staffSeed.unshift(raw.pitcherId);
    if (Array.isArray(raw.bullpen)) raw.bullpen.forEach(function (id) { staffSeed.push(id); });
    const rotation = fillStaff(cards, dexSeen, staffSeed, 'sp', 5);
    const bullpen = fillStaff(cards, dexSeen, staffSeed.concat(rotation), 'rp', 4);
    let rotationIndex = Math.round(Number(raw.rotationIndex) || 0);
    if (!isFinite(rotationIndex) || rotationIndex < 0) rotationIndex = 0;
    rotationIndex = rotationIndex % 5;
    return {
      teamName: raw.teamName || '서울 히어로즈',
      gold: Math.max(0, Math.round(Number(raw.gold) || 0)),
      diamond: Math.max(0, Math.round(Number(raw.diamond) || 0)),
      wins: wins,
      losses: Math.max(0, Math.round(Number(raw.losses) || 0)),
      level: 1 + Math.floor(wins / 2),
      lastNote: raw.lastNote || '',
      lineup: lineup,
      rotation: rotation,
      bullpen: bullpen,
      rotationIndex: rotationIndex,
      cards: cards,
      dexSeen: dexSeen,
      league: normalizeLeague(raw.league)
    };
  } catch (e) {
    return defaultState();
  }
}

function fillStaff(cards, dexSeen, preferIds, kind, count) {
  const out = [];
  function accept(id) {
    if (!id || out.indexOf(id) >= 0 || out.length >= count) return;
    const card = nullCard(cards, id);
    if (!card) return;
    const entry = Cards.entry(card.dex);
    const ok = kind === 'sp' ? Cards.isStarter(entry) : Cards.isBullpen(entry);
    if (ok) out.push(id);
  }
  preferIds.forEach(accept);
  cards.forEach(function (c) { accept(c.id); });
  const pool = Cards.DEX.filter(function (e) {
    return e.grade === 'N' && (kind === 'sp' ? e.role === 'SP' : e.role === 'RP');
  });
  let k = 0;
  while (out.length < count && pool.length) {
    const made = Cards.create(pool[k % pool.length].no, [0, 0, 0, 0, 0, 0], 0);
    cards.push(made);
    if (dexSeen.indexOf(made.dex) < 0) dexSeen.push(made.dex);
    out.push(made.id);
    k++;
  }
  return out;
}
function nullCard(cards, id) {
  for (let i = 0; i < cards.length; i++) if (cards[i].id === id) return cards[i];
  return null;
}
function saveState() {
  state.level = 1 + Math.floor(state.wins / 2);
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    teamName: state.teamName,
    gold: state.gold,
    diamond: state.diamond,
    wins: state.wins,
    losses: state.losses,
    lastNote: state.lastNote,
    lineup: state.lineup,
    rotation: state.rotation,
    bullpen: state.bullpen,
    rotationIndex: state.rotationIndex,
    cards: state.cards,
    dexSeen: state.dexSeen,
    league: state.league
  }));
}

function fmt(n) { return Number(n).toLocaleString('ko-KR'); }
function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function cardById(id) {
  for (let i = 0; i < state.cards.length; i++) if (state.cards[i].id === id) return state.cards[i];
  return null;
}
function isLocked(id) {
  return state.lineup.indexOf(id) >= 0 || state.rotation.indexOf(id) >= 0 || state.bullpen.indexOf(id) >= 0;
}
function seenCount() { return state.dexSeen.length; }
function addCard(card) {
  state.cards.push(card);
  if (state.dexSeen.indexOf(card.dex) < 0) state.dexSeen.push(card.dex);
}
function removeCard(id) {
  state.cards = state.cards.filter(function (c) { return c.id !== id; });
  tradePick = tradePick.filter(function (x) { return x !== id; });
  if (enhanceId === id) enhanceId = null;
}
function signed(n) {
  const v = Math.round(n * 10) / 10;
  const text = (v > 0 ? '+' : '') + (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
  return text;
}

function showScreen(which) {
  const lobbyOn = which === 'lobby';
  matchEl.classList.toggle('on', !lobbyOn);
  lobbyEl.setAttribute('aria-hidden', lobbyOn ? 'false' : 'true');
  matchEl.setAttribute('aria-hidden', lobbyOn ? 'true' : 'false');
  lobbyEl.inert = !lobbyOn;
  matchEl.inert = lobbyOn;
}

function emptyTable() {
  return CLUBS.map(function (_, i) { return { id: i, w: 0, l: 0, rs: 0, ra: 0 }; });
}
function buildSchedule() {
  const rounds = [];
  for (let cycle = 0; cycle < 6; cycle++) {
    let arr = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let r = 0; r < 7; r++) {
      const games = [];
      for (let i = 0; i < 4; i++) {
        let home = arr[i], away = arr[7 - i];
        if ((cycle + r + i) % 2 === 1) { const swap = home; home = away; away = swap; }
        games.push({ home: home, away: away, hs: null, as: null });
      }
      rounds.push(games);
      const rest = arr.slice(1);
      rest.unshift(rest.pop());
      arr = [arr[0]].concat(rest);
    }
  }
  return rounds;
}
function freshLeague() {
  return {
    tier: 0, season: 1, round: 0, phase: 'regular',
    schedule: buildSchedule(), table: emptyTable(),
    stats: { bat: {}, pit: {} }, post: null, awards: null,
    showCeremony: false, champNote: '', paid: 0
  };
}
function normalizeLeague(raw) {
  const base = freshLeague();
  if (!raw || typeof raw !== 'object') return base;
  const tier = Math.max(0, Math.min(4, Math.round(Number(raw.tier) || 0)));
  const season = Math.max(1, Math.round(Number(raw.season) || 1));
  const round = Math.max(0, Math.min(42, Math.round(Number(raw.round) || 0)));
  const phase = raw.phase === 'post' || raw.phase === 'ceremony' ? raw.phase : 'regular';
  const schedule = Array.isArray(raw.schedule) && raw.schedule.length === 42 ? raw.schedule : base.schedule;
  const table = Array.isArray(raw.table) && raw.table.length === 8 ? raw.table : base.table;
  const stats = raw.stats && raw.stats.bat && raw.stats.pit ? raw.stats : { bat: {}, pit: {} };
  return {
    tier: tier, season: season, round: round, phase: phase,
    schedule: schedule, table: table, stats: stats,
    post: raw.post || null, awards: raw.awards || null,
    showCeremony: !!raw.showCeremony, champNote: raw.champNote || '',
    paid: Math.max(0, Math.round(Number(raw.paid) || 0))
  };
}
function clubName(id) {
  if (id === 0) return state.teamName || CLUBS[0].name;
  return CLUBS[id] ? CLUBS[id].name : '구단';
}
function userOvr() {
  let sum = 0, n = 0;
  state.lineup.forEach(function (id) {
    const card = cardById(id);
    if (!card) return;
    sum += Cards.ovrOf(card); n++;
  });
  const pit = cardById(state.rotation[state.rotationIndex % 5]);
  if (pit) { sum += Cards.ovrOf(pit); n++; }
  return n ? Math.round(sum / n) : TIERS[0].ovr;
}
function teamStrength(id) {
  const base = TIERS[state.league.tier].ovr;
  if (id === 0) return userOvr();
  return base + ((id * 3) % 7) - 3;
}
function simFinal(homeId, awayId) {
  const ho = teamStrength(homeId) + 3;
  const ao = teamStrength(awayId);
  let hs = 0, as = 0;
  for (let i = 0; i < 9; i++) {
    if (Math.random() < Math.max(0.08, Math.min(0.42, 0.22 + (ho - ao) * 0.0045))) hs += 1 + (Math.random() < 0.16 ? 1 : 0);
    if (Math.random() < Math.max(0.08, Math.min(0.42, 0.20 + (ao - ho) * 0.0045))) as += 1 + (Math.random() < 0.16 ? 1 : 0);
  }
  if (hs === as) { if (Math.random() < 0.56) hs++; else as++; }
  return [Math.min(15, hs), Math.min(15, as)];
}
function sortedTable() {
  return state.league.table.map(function (t) {
    return { id: t.id, w: t.w || 0, l: t.l || 0, rs: t.rs || 0, ra: t.ra || 0 };
  }).sort(function (a, b) {
    const ag = a.w + a.l, bg = b.w + b.l;
    const ap = ag ? a.w / ag : 0, bp = bg ? b.w / bg : 0;
    if (bp !== ap) return bp - ap;
    const ad = a.rs - a.ra, bd = b.rs - b.ra;
    if (bd !== ad) return bd - ad;
    return b.w - a.w;
  });
}
function gamesBack(leader, row) {
  return ((leader.w - row.w) + (row.l - leader.l)) / 2;
}
function applyScore(row, rs, ra) {
  row.rs = (row.rs || 0) + rs;
  row.ra = (row.ra || 0) + ra;
  if (rs > ra) row.w = (row.w || 0) + 1;
  else row.l = (row.l || 0) + 1;
}
function recordRound(fieldHome, fieldAway) {
  const lg = state.league;
  if (!lg || lg.phase !== 'regular' || lg.round >= 42) return;
  const games = lg.schedule[lg.round];
  const bits = [];
  games.forEach(function (g) {
    const mine = g.home === 0 || g.away === 0;
    let homeScore = fieldHome, awayScore = fieldAway;
    if (!mine) {
      const sc = simFinal(g.home, g.away);
      homeScore = sc[0]; awayScore = sc[1];
      bits.push(clubName(g.away) + ' ' + awayScore + ':' + homeScore + ' ' + clubName(g.home));
    }
    g.hs = homeScore; g.as = awayScore;
    applyScore(lg.table[g.home], homeScore, awayScore);
    applyScore(lg.table[g.away], awayScore, homeScore);
  });
  lg.round++;
  const rank = sortedTable().findIndex(function (r) { return r.id === 0; }) + 1;
  state.lastNote = '정규 ' + lg.round + '/42 · ' + rank + '위' + (bits.length ? ' · 같은 날 ' + bits.join(' / ') : '');
  if (lg.round >= 42) {
    lg.phase = 'ceremony';
    lg.showCeremony = true;
    lg.awards = null;
  }
}
function stageName(stage) {
  if (stage === 'spo') return '준플레이오프';
  if (stage === 'po') return '플레이오프';
  return '한국시리즈';
}
function postLabel() {
  const p = state.league.post;
  if (!p) return '가을야구';
  const opp = p.high === 0 ? p.low : p.high;
  return stageName(p.stage) + ' · ' + clubName(opp) + ' · ' + (p.wins[0] || 0) + '승 ' + (p.wins[opp] || 0) + '패 (' + p.need + '선승)';
}
function simSeries(high, low, need) {
  const wins = {};
  wins[high] = 0; wins[low] = 0;
  let played = 0;
  while (wins[high] < need && wins[low] < need && played < 7) {
    const highHosts = played === 0 || played === 1 || played === 4;
    const home = highHosts ? high : low;
    const away = highHosts ? low : high;
    const sc = simFinal(home, away);
    wins[sc[0] > sc[1] ? home : away]++;
    played++;
  }
  return wins[high] >= need ? high : low;
}
function finishChampionship(winner) {
  const lg = state.league;
  const mine = winner === 0;
  let pack = null;
  const tierNow = lg.tier;
  if (mine) {
    state.gold += SERIES_BONUS;
    pack = Cards.pull();
    addCard(pack);
  }
  const nextTier = mine && tierNow < 4 ? tierNow + 1 : tierNow;
  const note = mine
    ? '한국시리즈 우승 · +' + fmt(SERIES_BONUS) + ' G · 스카우트 팩 · ' + TIERS[nextTier].name + ' 리그로 승격'
    : '한국시리즈는 ' + clubName(winner) + ' 우승 · ' + TIERS[tierNow].name + ' 리그 잔류';
  const season = lg.season + 1;
  state.league = freshLeague();
  state.league.tier = nextTier;
  state.league.season = season;
  state.league.champNote = note;
  state.lastNote = note;
  saveState();
  if (pack) {
    const entry = Cards.entry(pack.dex);
    showCardStage(pack, '우승 보너스 · 스카우트 팩 · ' + entry.name, entry.grade === 'U' || entry.grade === 'L' ? entry.grade : null, true, function () { renderLobby(); });
  }
}
function advanceStage(winner) {
  const seeds = state.league.post.seeds;
  const stage = state.league.post.stage;
  if (stage === 'spo') state.league.post = { seeds: seeds, stage: 'po', high: seeds[1], low: winner, wins: {}, need: 2, played: 0 };
  else if (stage === 'po') state.league.post = { seeds: seeds, stage: 'ks', high: seeds[0], low: winner, wins: {}, need: 3, played: 0 };
  else finishChampionship(winner);
}
function userInPost() {
  const p = state.league.post;
  return !!(p && (p.high === 0 || p.low === 0));
}
function skipAiSeries() {
  let guard = 0;
  while (state.league.phase === 'post' && state.league.post && guard++ < 4) {
    const p = state.league.post;
    if (p.high === 0 || p.low === 0) return;
    advanceStage(simSeries(p.high, p.low, p.need));
  }
}
function openPostseason() {
  const seeds = sortedTable().slice(0, 4).map(function (r) { return r.id; });
  state.league.phase = 'post';
  state.league.showCeremony = false;
  state.league.post = { seeds: seeds, stage: 'spo', high: seeds[2], low: seeds[3], wins: {}, need: 2, played: 0 };
  skipAiSeries();
  saveState();
}
function postUserHome() {
  const p = state.league.post;
  const highHosts = p.played === 0 || p.played === 1 || p.played === 4;
  if (p.high === 0) return highHosts;
  return !highHosts;
}
function onPostResult(userWon) {
  const p = state.league.post;
  if (!p) return;
  const opp = p.high === 0 ? p.low : p.high;
  const winner = userWon ? 0 : opp;
  p.wins[winner] = (p.wins[winner] || 0) + 1;
  p.played++;
  if ((p.wins[p.high] || 0) >= p.need) advanceStage(p.high);
  else if ((p.wins[p.low] || 0) >= p.need) advanceStage(p.low);
  else state.lastNote = postLabel();
  if (state.league.phase === 'post') skipAiSeries();
}
function bumpStat(bucket, id, name, patch) {
  if (!id) return;
  if (!bucket[id]) bucket[id] = { name: name };
  const row = bucket[id];
  Object.keys(patch).forEach(function (k) { row[k] = (row[k] || 0) + patch[k]; });
  if (name) row.name = name;
}
function harvestUser(g) {
  const team = g[g.userSide || 'home'];
  if (!team || !state.league) return;
  team.batters.forEach(function (b) {
    if (!b.cardId) return;
    bumpStat(state.league.stats.bat, b.cardId, b.name, { ab: b.ab || 0, h: b.h || 0, hr: b.hr || 0, rbi: b.rbi || 0 });
  });
  const arms = (team.appeared || []).concat([{
    cardId: team.pitcher.cardId || null, name: team.pitcher.name,
    outs: team.pitcher.outs || 0, runs: team.pitcher.runs || 0, slotIndex: team.pitcher.slotIndex
  }]);
  const won = g.userSide === 'away' ? g.away.score > g.home.score : g.home.score > g.away.score;
  const lead = Math.abs(g.home.score - g.away.score);
  const last = arms[arms.length - 1];
  const save = won && last && last.slotIndex === 3 && arms.length > 1 && lead > 0 && lead <= 3 && (last.outs || 0) >= 1;
  let winArm = null;
  if (won) {
    if (save) winArm = arms[arms.length - 2];
    else if (arms.length === 1 || (arms[0].outs || 0) >= 15) winArm = arms[0];
    else winArm = arms[1] || last;
  }
  arms.forEach(function (arm) {
    if (!arm.cardId) return;
    bumpStat(state.league.stats.pit, arm.cardId, arm.name, {
      outs: arm.outs || 0,
      er: arm.runs || 0,
      w: winArm && arm === winArm ? 1 : 0,
      sv: save && arm === last ? 1 : 0
    });
  });
}
function buildAwards() {
  const bats = [], pits = [];
  Object.keys(state.league.stats.bat).forEach(function (id) {
    const r = state.league.stats.bat[id];
    bats.push({ id: id, name: r.name, team: state.teamName, ab: r.ab || 0, h: r.h || 0, hr: r.hr || 0, rbi: r.rbi || 0, user: true });
  });
  Object.keys(state.league.stats.pit).forEach(function (id) {
    const r = state.league.stats.pit[id];
    pits.push({ id: id, name: r.name, team: state.teamName, outs: r.outs || 0, er: r.er || 0, w: r.w || 0, sv: r.sv || 0, user: true });
  });
  for (let t = 1; t < 8; t++) {
    const ovr = teamStrength(t);
    for (let i = 0; i < 9; i++) {
      const ab = 120 + Math.floor(Math.random() * 50);
      const avg = 0.215 + (ovr - 50) * 0.0024 + Math.random() * 0.045;
      const h = Math.max(0, Math.round(ab * avg));
      const hr = Math.max(0, Math.round(h * (0.06 + Math.max(0, ovr - 50) * 0.0016) * (0.45 + Math.random())));
      const rbi = Math.max(hr, Math.round(h * (0.55 + Math.random() * 0.5)));
      bats.push({ id: 'ai-' + t + '-b' + i, name: NPC_NAMES[(t * 3 + i) % NPC_NAMES.length], team: CLUBS[t].name, ab: ab, h: h, hr: hr, rbi: rbi, user: false });
    }
    for (let i = 0; i < 5; i++) {
      const outs = 100 + Math.floor(Math.random() * 70);
      const era = Math.max(1.5, 5.5 - (ovr - 50) * 0.05 + Math.random() * 1.2);
      pits.push({ id: 'ai-' + t + '-p' + i, name: NPC_NAMES[(t + i + 4) % NPC_NAMES.length], team: CLUBS[t].name, outs: outs, er: Math.round(era * (outs / 3) / 9), w: Math.max(0, Math.round(2 + (ovr - 50) * 0.07 + Math.random() * 5)), sv: 0, user: false });
    }
    const couts = 36 + Math.floor(Math.random() * 24);
    pits.push({ id: 'ai-' + t + '-c', name: NPC_NAMES[(t + 9) % NPC_NAMES.length], team: CLUBS[t].name, outs: couts, er: Math.round(couts / 10), w: 1 + Math.floor(Math.random() * 3), sv: 8 + Math.floor(Math.random() * 14), user: false });
  }
  function bestBat(score, qual) {
    let best = null, mark = -1;
    bats.forEach(function (b) {
      if (qual && !qual(b)) return;
      const s = score(b);
      if (!best || s > mark || (s === mark && b.user)) { best = b; mark = s; }
    });
    return best;
  }
  const avg = bestBat(function (b) { return b.ab ? b.h / b.ab : 0; }, function (b) { return b.ab >= 40; });
  const hr = bestBat(function (b) { return b.hr; });
  const rbi = bestBat(function (b) { return b.rbi; });
  let wins = null;
  pits.forEach(function (p) { if (!wins || p.w > wins.w || (p.w === wins.w && p.user)) wins = p; });
  let era = null, eraMark = 99;
  pits.forEach(function (p) {
    if ((p.outs || 0) < 36) return;
    const v = (p.er || 0) * 27 / p.outs;
    if (!era || v < eraMark || (v === eraMark && p.user)) { era = p; eraMark = v; }
  });
  let sv = null;
  pits.forEach(function (p) { if (!sv || p.sv > sv.sv || (p.sv === sv.sv && p.user)) sv = p; });
  let mvp = null, mvpScore = -1, mvpKind = 'bat';
  bats.forEach(function (b) {
    const s = (b.hr || 0) * 4 + (b.h || 0) * 0.4 + (b.rbi || 0) * 1.1 + (b.ab ? (b.h / b.ab) * 40 : 0);
    if (s > mvpScore) { mvpScore = s; mvp = b; mvpKind = 'bat'; }
  });
  pits.forEach(function (p) {
    const eraV = p.outs ? (p.er || 0) * 27 / p.outs : 6;
    const s = (p.w || 0) * 5 + (p.sv || 0) * 3 + Math.max(0, 6 - eraV) * 4;
    if (s > mvpScore) { mvpScore = s; mvp = p; mvpKind = 'pit'; }
  });
  return { mvp: mvp, mvpKind: mvpKind, avg: avg, hr: hr, rbi: rbi, w: wins, era: era, sv: sv };
}
function payAwards(awards) {
  let gold = 0;
  ['mvp', 'avg', 'hr', 'rbi', 'w', 'era', 'sv'].forEach(function (key) {
    const row = awards[key];
    if (row && row.user) gold += AWARD_BONUS[key];
  });
  if (gold) state.gold += gold;
  return gold;
}
function awardLine(label, row, extra) {
  if (!row) return '<div class="award-row"><span>' + label + '</span><b>해당 없음</b></div>';
  return '<div class="award-row' + (row.user ? ' mine' : '') + '"><span>' + label + '</span><b>' + esc(row.name) + ' · ' + esc(row.team) + (extra ? ' · ' + extra : '') + (row.user ? ' · 보너스' : '') + '</b></div>';
}
function openAwards() {
  const lg = state.league;
  if (!lg.awards) {
    lg.awards = buildAwards();
    lg.paid = payAwards(lg.awards);
    saveState();
  }
  const a = lg.awards;
  const my = sortedTable().findIndex(function (r) { return r.id === 0; }) + 1;
  const avgText = a.avg && a.avg.ab ? (a.avg.h / a.avg.ab).toFixed(3).replace(/^0/, '') : '-';
  const eraText = a.era && a.era.outs ? ((a.era.er || 0) * 27 / a.era.outs).toFixed(2) : '-';
  const inPlayoffs = my > 0 && my <= 4;
  document.getElementById('awardBody').innerHTML =
    '<h2>시즌 ' + lg.season + ' 정규리그 시상식</h2>' +
    '<p>' + TIERS[lg.tier].name + ' 리그 42경기 종료 · 우리 팀 ' + my + '위. 선수 수상 보너스 ' + fmt(lg.paid || 0) + ' G가 지급되었습니다.</p>' +
    '<div class="award-list">' +
    awardLine('정규리그 MVP', a.mvp, a.mvpKind === 'pit' ? '투수' : '타자') +
    awardLine('타격왕', a.avg, '타율 ' + avgText) +
    awardLine('홈런왕', a.hr, a.hr ? a.hr.hr + '홈런' : '') +
    awardLine('타점왕', a.rbi, a.rbi ? a.rbi.rbi + '타점' : '') +
    awardLine('다승왕', a.w, a.w ? a.w.w + '승' : '') +
    awardLine('방어율 1위', a.era, 'ERA ' + eraText) +
    awardLine('세이브왕', a.sv, a.sv ? a.sv.sv + '세이브' : '') +
    '</div>' +
    '<p>' + (inPlayoffs ? '1~4위가 가을야구에 올라갑니다. 준PO 3판 2선승, PO 3판 2선승, 한국시리즈 5판 3선승.' : '4위 밖으로 이번 가을야구는 쉬고 같은 리그에서 다음 시즌을 시작합니다.') + '</p>';
  document.getElementById('btnAwardNext').textContent = inPlayoffs ? '가을야구 시작' : '다음 시즌';
  document.getElementById('awardModal').hidden = false;
}
function renderStandings() {
  const rows = sortedTable();
  const leader = rows[0] || { w: 0, l: 0 };
  const lg = state.league;
  const tier = TIERS[lg.tier];
  const kicker = document.getElementById('seasonKicker');
  if (kicker) {
    kicker.textContent = lg.phase === 'post' && lg.post
      ? '시즌 ' + lg.season + ' · ' + postLabel()
      : '시즌 ' + lg.season + ' · ' + tier.name + ' · ' + Math.min(42, lg.round) + '/42경기';
  }
  const title = document.getElementById('heroTitle');
  if (title) title.textContent = state.teamName;
  const desc = document.getElementById('leagueDesc');
  if (desc) desc.textContent = lg.phase === 'post' ? '가을야구 · 경기당 1,500 G · 승리 시 카드 팩' : lg.phase === 'ceremony' ? '정규리그 종료 · 시상식을 확인하세요' : '7개 구단과 6경기씩 · 종료 1,500 G · 승리 시 카드 팩';
  document.getElementById('clubLevel').textContent = '구단 Lv.' + state.level + ' · ' + tier.name;
  const crest = document.querySelector('.crest');
  if (crest) crest.style.background = CLUBS[0].color;
  document.getElementById('standings').innerHTML = '<table class="stand-table"><thead><tr><th>순위</th><th>구단</th><th>승</th><th>패</th><th>승률</th><th>게임차</th></tr></thead><tbody>' +
    rows.map(function (r, i) {
      const games = r.w + r.l;
      const pct = games ? (r.w / games).toFixed(3).replace(/^0/, '') : '-';
      const gb = i === 0 ? '-' : gamesBack(leader, r).toFixed(1);
      const club = CLUBS[r.id];
      const name = r.id === 0 ? state.teamName : club.name;
      return '<tr class="' + (r.id === 0 ? 'me' : '') + '"><td>' + (i + 1) + '</td><td><span class="stand-club"><i class="stand-dot" style="background:' + club.color + '"></i>' + esc(name) + '</span></td><td>' + r.w + '</td><td>' + r.l + '</td><td>' + pct + '</td><td>' + gb + '</td></tr>';
    }).join('') + '</tbody></table>';
}
function matchMeta() {
  const lg = state.league;
  if (lg.phase === 'post' && lg.post && userInPost()) {
    const opp = lg.post.high === 0 ? lg.post.low : lg.post.high;
    const userHome = postUserHome();
    return {
      userSide: userHome ? 'home' : 'away', mode: 'post',
      userName: state.teamName, userShort: CLUBS[0].short, userColor: CLUBS[0].color,
      oppName: clubName(opp), oppShort: CLUBS[opp].short, oppColor: CLUBS[opp].color, oppOvr: teamStrength(opp)
    };
  }
  const games = lg.schedule[Math.max(0, Math.min(41, lg.round))];
  const g = games.filter(function (x) { return x.home === 0 || x.away === 0; })[0];
  const userHome = !g || g.home === 0;
  const opp = g ? (userHome ? g.away : g.home) : 1;
  return {
    userSide: userHome ? 'home' : 'away', mode: 'league',
    userName: state.teamName, userShort: CLUBS[0].short, userColor: CLUBS[0].color,
    oppName: clubName(opp), oppShort: CLUBS[opp].short, oppColor: CLUBS[opp].color, oppOvr: teamStrength(opp)
  };
}
function renderLobby() {
  const games = state.wins + state.losses;
  const rate = games ? (state.wins / games * 100).toFixed(1) + '%' : '-';
  document.getElementById('clubName').textContent = state.teamName;
  document.getElementById('clubLevel').textContent = '구단 Lv.' + state.level;
  document.getElementById('goldText').textContent = fmt(state.gold) + ' G';
  document.getElementById('diaText').textContent = fmt(state.diamond) + ' D';
  document.getElementById('lobbyRecord').textContent = state.wins + '승 ' + state.losses + '패 · 승률 ' + rate + ' · 카드 도감 ' + seenCount() + '/124';
  document.getElementById('lobbyStatus').textContent = state.lastNote || '정규 리그 경기가 대기 중입니다.';
  document.getElementById('btnDex').textContent = '카드 도감 (' + seenCount() + '/124)';
  if (state.league) renderStandings();
}

function showLobby() {
  closePopup();
  const modal = document.getElementById('resultModal');
  if (modal) modal.hidden = true;
  renderLobby();
  showScreen('lobby');
  if (state.league && state.league.showCeremony && state.league.phase === 'ceremony') openAwards();
}

function enterMatch(mode) {
  closePopup();
  showScreen('match');
  initGame(mode);
}

function closePopup() { popup.hidden = true; sheetView = null; }
function openSheet(html, view) {
  sheetView = view;
  popupBody.innerHTML = html;
  popupBody.classList.toggle('wide', view === 'lineup');
  popup.hidden = false;
  bindLegendTilt(popupBody);
}

function refreshSheet() {
  if (sheetView === 'scout') renderScout();
  else if (sheetView === 'lineup') renderLineup();
  else if (sheetView === 'dex') renderDex();
  else if (sheetView === 'manage') renderManage();
  else if (sheetView === 'record') renderRecord();
  else if (sheetView === 'ladder') renderLadder();
}

function recordText() {
  const games = state.wins + state.losses;
  return { games: games, rate: games ? (state.wins / games * 100).toFixed(1) + '%' : '-' };
}

function statCells(card) {
  const entry = Cards.entry(card.dex);
  const stats = Cards.statsOf(card);
  const labels = Cards.labels(entry);
  return stats.map(function (n, i) {
    const iv = card.iv[i];
    const tone = iv > 0 ? 'up' : iv < 0 ? 'down' : '';
    return '<span class="tstat ' + tone + '" title="개체 ' + signed(iv) + '"><b>' + labels[i] + '</b><em>' + n + '</em></span>';
  }).join('');
}

function cardMarkup(card, size) {
  const entry = Cards.entry(card.dex);
  const ovr = Cards.ovrOf(card);
  const grade = entry.grade.toLowerCase();
  const stage = size === 'stage';
  const art = Cards.portraitSVG(entry);
  const radar = stage ? Cards.radarSVG(Cards.labels(entry), Cards.statsOf(card)) : '';
  return '<article class="tcard grade-' + grade + ' ' + (stage ? 'stage' : 'mini show-front') + '">' +
    '<div class="tcard-flip">' +
      '<div class="tcard-back"><div class="back-crest">SH</div><p>SEOUL HEROES</p><span>카드 팩</span></div>' +
      '<div class="tcard-front"><div class="tcard-core">' +
        '<div class="portrait-wrap">' + art + '</div>' +
        '<header class="tcard-top"><span class="dex">' + Cards.pad(entry.no) + '</span><span class="badge">' + entry.grade + '</span><span class="pos">' + esc(entry.pos) + ' ' + esc(Cards.posKo[entry.pos]) + '</span><span class="ovr"><small>오버롤(OVR)</small><b>' + ovr + '</b></span></header>' +
        '<p class="tcard-title">' + esc(entry.title) + '</p>' +
        '<p class="tcard-name">' + esc(entry.name) + '</p>' +
        '<div class="tcard-meta"><span class="mbti">' + esc(entry.mbti) + '</span><span class="plus">' + card.plus + '강</span><span class="ivline">개체 평균 ' + signed(Cards.ivAverage(card.iv)) + '</span></div>' +
        (radar ? '<div class="radar-wrap">' + radar + '</div>' : '') +
        '<div class="tstats">' + statCells(card) + '</div>' +
        '<p class="tcard-story">' + esc(entry.story) + '</p>' +
      '</div><div class="holo"></div></div>' +
    '</div></article>';
}

function lockedMarkup(no) {
  const entry = Cards.entry(no);
  return '<article class="tcard grade-' + entry.grade.toLowerCase() + ' mini show-front is-locked">' +
    '<div class="tcard-flip"><div class="tcard-front"><div class="tcard-core">' +
      '<header class="tcard-top"><span class="dex">' + Cards.pad(no) + '</span><span class="badge">' + entry.grade + '</span></header>' +
      '<p class="locked-copy">미발견</p><p class="tcard-title">' + esc(Cards.gradeName(entry.grade)) + '</p>' +
    '</div></div></div></article>';
}

function bindLegendTilt(root) {
  (root || document).querySelectorAll('.tcard.grade-l').forEach(function (card) {
    if (card.dataset.tilt) return;
    card.dataset.tilt = '1';
    const apply = function (e) {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', ((px - 0.5) * 16) + 'deg');
      card.style.setProperty('--rx', ((0.5 - py) * 12) + 'deg');
      card.style.setProperty('--mx', (px * 100) + '%');
      card.style.setProperty('--my', (py * 100) + '%');
      card.classList.add('is-tilt');
    };
    card.addEventListener('pointerdown', apply);
    card.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      apply(e);
    });
    card.addEventListener('pointerleave', function () {
      card.classList.remove('is-tilt');
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--rx', '0deg');
    });
  });
}

function playReveal(grade) {
  return new Promise(function (resolve) {
    const canvas = document.getElementById('revealParticles');
    const stage = document.getElementById('stage');
    revealFx.hidden = false;
    revealFx.className = 'reveal-fx on ' + (grade === 'L' ? 'is-l' : 'is-u');
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(2, Math.round(rect.width * dpr));
    canvas.height = Math.max(2, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    const colors = grade === 'L'
      ? ['#fff4c4', '#ffd15a', '#ff9d2e', '#ffffff', '#ffe9a0']
      : ['#f2e6ff', '#c9a6ff', '#7d5cff', '#ffffff', '#e4d4ff'];
    const parts = [];
    const cx = canvas.width / 2;
    const cy = canvas.height * 0.42;
    for (let i = 0; i < 78; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (Math.random() * 4.2 + 1.4) * dpr;
      parts.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.2 * dpr,
        g: 0.085 * dpr, life: 1, decay: 0.007 + Math.random() * 0.01,
        r: (2 + Math.random() * 3.2) * dpr, color: colors[i % colors.length]
      });
    }
    const t0 = performance.now();
    function frame(now) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach(function (p) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.life -= p.decay;
        if (p.life <= 0) return;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (now - t0 < 1700) revealRaf = requestAnimationFrame(frame);
      else {
        revealFx.hidden = true;
        revealFx.className = 'reveal-fx';
        resolve();
      }
    }
    revealRaf = requestAnimationFrame(frame);
  });
}

function showCardStage(card, note, drama, jackpot, after) {
  const token = ++stageToken;
  stageAfter = after || null;
  cardStageNote.textContent = note;
  cardStageNote.className = 'stage-note' + (jackpot ? ' jackpot' : '');
  cardStageSlot.innerHTML = cardMarkup(card, 'stage');
  cardStage.hidden = false;
  const flip = function () {
    if (token !== stageToken) return;
    const el = cardStageSlot.querySelector('.tcard');
    if (!el) return;
    void el.offsetWidth;
    el.classList.add('flipped');
    bindLegendTilt(cardStageSlot);
  };
  if (drama === 'U' || drama === 'L') {
    cardStageSlot.style.visibility = 'hidden';
    playReveal(drama).then(function () {
      if (token !== stageToken) return;
      cardStageSlot.style.visibility = '';
      flip();
    });
  } else {
    cardStageSlot.style.visibility = '';
    setTimeout(flip, 60);
  }
}

function closeCardStage() {
  stageToken++;
  cardStage.hidden = true;
  cardStageSlot.style.visibility = '';
  revealFx.hidden = true;
  revealFx.className = 'reveal-fx';
  if (revealRaf) cancelAnimationFrame(revealRaf);
  const fn = stageAfter;
  stageAfter = null;
  if (fn) fn();
}

function renderRecord() {
  const rec = recordText();
  openSheet(
    '<div class="sheet-head"><h2>기록실</h2><button type="button" class="ghost" data-act="close">닫기</button></div>' +
    '<p>리그 모드 경기만 승패에 반영됩니다. 리그 종료 시 ' + fmt(LEAGUE_GOLD) + ' G, 승리 시 기본 선수 카드 팩 1장이 추가됩니다.</p>' +
    '<div class="record-grid">' +
      '<div class="record-tile"><b>' + state.wins + '</b><span>승</span></div>' +
      '<div class="record-tile"><b>' + state.losses + '</b><span>패</span></div>' +
      '<div class="record-tile"><b>' + rec.rate + '</b><span>승률 · ' + rec.games + '경기</span></div>' +
    '</div>',
    'record'
  );
}

function renderLadder() {
  openSheet(
    '<div class="sheet-head"><h2>래더 매치</h2><button type="button" class="ghost" data-act="close">닫기</button></div>' +
    '<p>래더 시즌은 아직 준비 중입니다.</p>' +
    '<p>같은 9이닝 경기로 친선 평가전을 바로 시작할 수 있습니다. 승패는 기록실에 남지 않고, 승리하면 ' + fmt(FRIENDLY_WIN_GOLD) + ' G를 받습니다. 친선전은 상대 라인업과 투수 능력치를 우리 팀과 같게 맞춥니다.</p>' +
    '<div class="pop-actions"><button type="button" class="solid" data-act="friendly">친선 평가전 시작</button><button type="button" class="solid" data-act="mirror">동일 OVR 테스트</button></div>' +
    '<p>동일 OVR 테스트는 양 팀 라인업 9명과 투수진을 KBO 평균 주전인 OVR 70(세부 스탯 70)으로 메모리에서만 맞춥니다. 구단 데이터는 저장되지 않습니다.</p>',
    'ladder'
  );
}

function rateTable() {
  return '<aside class="rate-panel"><h3>출현 확률</h3><table class="rate-table">' +
    Cards.RATES.map(function (r) {
      return '<tr class="rate-' + r.grade.toLowerCase() + '"><th>' + r.name + ' (' + r.grade + ')</th><td>' + r.pct + '%</td></tr>';
    }).join('') +
    '</table><p class="rate-note">같은 도감 카드라도 6대 능력치에 개체값 -4 ~ +5가 붙습니다.</p></aside>';
}

function renderScout() {
  const poor = state.gold < SCOUT_COST;
  openSheet(
    '<div class="sheet-head"><h2>선수 영입</h2><button type="button" class="ghost" data-act="close">닫기</button></div>' +
    '<div class="scout-layout"><div><p>보유 골드 ' + fmt(state.gold) + ' G · 보유 카드 ' + state.cards.length + '장 · 카드 도감 ' + seenCount() + '/124</p>' +
    '<p>1,500 G로 기본 선수 카드 팩을 엽니다. 카드가 뒤집히며 도감 선수 1장을 획득합니다.</p>' +
    '<div class="pop-actions"><button type="button" class="solid gold" data-act="scout-pack"' + (poor || scoutBusy ? ' disabled' : '') + '>카드 팩 개봉 ' + fmt(SCOUT_COST) + ' G</button></div>' +
    (poor ? '<p class="hint">골드가 부족합니다.</p>' : '') +
    '</div>' + rateTable() + '</div>',
    'scout'
  );
}

function playerLine(card) {
  const entry = Cards.entry(card.dex);
  return esc(entry.name) + '<small>' + Cards.pad(entry.no) + ' · ' + esc(entry.pos) + ' · ' + esc(entry.title) + ' · ' + card.plus + '강</small>' +
    '<span class="stat-grid"><i>오버롤(OVR) ' + Cards.ovrOf(card) + '</i><i>' + entry.grade + ' ' + esc(Cards.gradeName(entry.grade)) + '</i><i>' + esc(entry.mbti) + '</i></span>';
}

const FIELD_ANCHOR = {
  CF: ['50%', '16%'], LF: ['18%', '30%'], RF: ['82%', '30%'],
  SS: ['34%', '46%'], '2B': ['66%', '46%'],
  '3B': ['16%', '62%'], '1B': ['84%', '62%'],
  C: ['50%', '84%'], DH: ['84%', '84%']
};

function miniFace(card, orderText, selected) {
  const entry = Cards.entry(card.dex);
  return '<button type="button" class="face-card' + (selected ? ' sel' : '') + '">' +
    '<span class="face-ord">' + esc(orderText) + '</span>' +
    '<span class="face-art">' + Cards.portraitSVG(entry) + '</span>' +
    '<span class="face-name">' + esc(entry.name) + '</span>' +
    '<span class="face-meta">' + esc(entry.pos) + ' · OVR ' + Cards.ovrOf(card) + '</span>' +
    '</button>';
}

function renderLineup() {
  if (selectedSlot < 0 || selectedSlot > 8) selectedSlot = 0;
  const need = 2 - (state.wins % 2);
  const next = cardById(state.rotation[state.rotationIndex]);
  const nextName = next ? Cards.entry(next.dex).name : '-';
  let board = '';
  let bench = '';
  if (lineupTab === 'bat') {
    const used = {};
    board = '<div class="diamond-board">' + state.lineup.map(function (id, i) {
      const card = cardById(id);
      const entry = Cards.entry(card.dex);
      const anchor = FIELD_ANCHOR[entry.pos] || FIELD_ANCHOR.DH;
      const key = entry.pos;
      const bump = used[key] || 0;
      used[key] = bump + 1;
      const top = 'calc(' + anchor[1] + ' + ' + (bump * 18) + 'px)';
      return '<div class="fslot" style="left:' + anchor[0] + ';top:' + top + '" data-act="select" data-i="' + i + '">' +
        miniFace(card, (i + 1) + '번', i === selectedSlot) + '</div>';
    }).join('') +
      '<div class="diamond-hint">카드를 고른 뒤 타순을 바꾸거나 벤치에서 교체합니다.</div></div>';
    const selected = cardById(state.lineup[selectedSlot]);
    const batBench = state.cards.filter(function (c) {
      return !Cards.isPitcher(Cards.entry(c.dex)) && state.lineup.indexOf(c.id) < 0;
    });
    bench = '<div class="order-tools"><b>' + (selectedSlot + 1) + '번 ' + esc(Cards.entry(selected.dex).name) + '</b>' +
      '<button type="button" class="mini" data-act="up" data-i="' + selectedSlot + '"' + (selectedSlot === 0 ? ' disabled' : '') + '>▲</button>' +
      '<button type="button" class="mini" data-act="down" data-i="' + selectedSlot + '"' + (selectedSlot === 8 ? ' disabled' : '') + '>▼</button>' +
      '<span>타순 이동</span></div>' +
      (batBench.length ? batBench.map(function (c) {
        return '<div class="bench-row player-card"><span class="who">' + playerLine(c) + '</span>' +
          '<button type="button" class="ghost" data-act="insert" data-id="' + esc(c.id) + '">' + (selectedSlot + 1) + '번 교체</button></div>';
      }).join('') : '<p>벤치 타자 카드가 없습니다.</p>');
  } else {
    const sp = state.rotation.map(function (id, i) {
      const on = selectedStaff.kind === 'sp' && selectedStaff.index === i;
      return '<div data-act="pick-staff" data-kind="sp" data-i="' + i + '">' +
        miniFace(cardById(id), (i + 1) + '선발' + (i === state.rotationIndex ? ' · 다음' : ''), on) + '</div>';
    }).join('');
    const rp = state.bullpen.map(function (id, i) {
      const on = selectedStaff.kind === 'rp' && selectedStaff.index === i;
      return '<div data-act="pick-staff" data-kind="rp" data-i="' + i + '">' +
        miniFace(cardById(id), PEN_LABELS[i], on) + '</div>';
    }).join('');
    board = '<div class="rotation-board"><h3>선발 로테이션</h3><div class="rot-row">' + sp + '</div>' +
      '<h3>불펜</h3><div class="pen-row">' + rp + '</div>' +
      '<p>불펜 카드는 승리조 · 추격조 · 마무리 어디에나 넣을 수 있습니다. 다음 경기 선발은 ' + (state.rotationIndex + 1) + '선발 ' + esc(nextName) + '.</p></div>';
    const list = selectedStaff.kind === 'sp' ? state.rotation : state.bullpen;
    const slotCard = cardById(list[selectedStaff.index]);
    const pool = state.cards.filter(function (c) {
      const entry = Cards.entry(c.dex);
      if (list.indexOf(c.id) >= 0) return false;
      return selectedStaff.kind === 'sp' ? Cards.isStarter(entry) : Cards.isBullpen(entry);
    });
    const slotName = selectedStaff.kind === 'sp' ? ((selectedStaff.index + 1) + '선발') : PEN_LABELS[selectedStaff.index];
    bench = '<div class="order-tools"><b>' + slotName + ' ' + esc(Cards.entry(slotCard.dex).name) + '</b></div>' +
      (pool.length ? pool.map(function (c) {
        return '<div class="bench-row player-card"><span class="who">' + playerLine(c) + '</span>' +
          '<button type="button" class="ghost" data-act="set-staff" data-id="' + esc(c.id) + '">' + slotName + ' 배치</button></div>';
      }).join('') : '<p>이 슬롯에 넣을 여분 투수가 없습니다.</p>');
  }
  openSheet(
    '<div class="sheet-head"><h2>팀 정보 / 라인업</h2><button type="button" class="ghost" data-act="close">닫기</button></div>' +
    '<p>' + esc(state.teamName) + ' · Lv.' + state.level + ' · 18인 로스터 · 카드 도감 ' + seenCount() + '/124 · 다음 레벨까지 리그 ' + need + '승. 출전 중인 카드는 강화와 트레이드에서 잠깁니다.</p>' +
    '<div class="subtabs lineup-tabs">' +
      '<button type="button" class="' + (lineupTab === 'bat' ? 'on' : '') + '" data-act="lineup-tab" data-tab="bat">타자 라인업</button>' +
      '<button type="button" class="' + (lineupTab === 'pit' ? 'on' : '') + '" data-act="lineup-tab" data-tab="pit">투수 로테이션</button>' +
    '</div>' +
    '<div class="lineup-layout"><div>' + board + '</div><div class="lineup-side"><h3>' + (lineupTab === 'bat' ? '교체 · 타순' : '슬롯 교체') + '</h3>' + bench + '</div></div>',
    'lineup'
  );
}

function gradeRank(g) { return { L: 5, U: 4, S: 3, R: 2, N: 1 }[g] || 0; }

function renderManage() {
  const target = enhanceId ? cardById(enhanceId) : null;
  let enhanceBox = '<p>강화할 카드를 고르세요. 같은 도감 번호의 실물 카드 1장과 골드를 소모합니다. 조각이나 하위 등급 재료는 쓰지 않습니다.</p>';
  if (target) {
    const entry = Cards.entry(target.dex);
    const max = Cards.MAX_PLUS[entry.grade];
    const fodders = state.cards.filter(function (c) { return c.id !== target.id && c.dex === target.dex && !isLocked(c.id); })
      .sort(function (a, b) { return a.plus - b.plus; });
    const fodder = fodders[0];
    if (target.plus >= max) {
      enhanceBox = cardMarkup(target, 'mini') + '<p>풀강입니다. ' + esc(entry.name) + ' 오버롤(OVR) ' + Cards.ovrOf(target) + ' · 이 등급 풀강 기준 ' + Cards.fullOvr(entry.grade) + '.</p>';
    } else {
      const cost = Cards.enhanceCost(entry.grade, target.plus);
      const next = { id: target.id, dex: target.dex, iv: target.iv, plus: target.plus + 1 };
      const poor = state.gold < cost;
      const warn = fodder && fodder.plus > 0 ? '<p class="hint">가장 낮은 강화의 복제 카드(' + fodder.plus + '강)가 재료로 사라집니다.</p>' : '';
      enhanceBox = '<div class="manage-preview">' + cardMarkup(target, 'mini') +
        '<div><p>' + esc(entry.name) + ' · ' + target.plus + '강 → ' + (target.plus + 1) + '강</p>' +
        '<p>오버롤(OVR) ' + Cards.ovrOf(target) + ' → ' + Cards.ovrOf(next) + ' · 6대 능력치 +' + Cards.GAIN[entry.grade] + '</p>' +
        '<p>재료: 같은 도감 ' + Cards.pad(entry.no) + ' 카드 ' + fodders.length + '장 보유(라인업 제외) · 비용 ' + fmt(cost) + ' G</p>' + warn +
        '<button type="button" class="solid gold" data-act="do-enhance"' + (!fodder || poor ? ' disabled' : '') + '>강화 ' + fmt(cost) + ' G</button>' +
        (!fodder ? '<p class="hint">같은 도감의 여분 카드가 없습니다.</p>' : '') +
        (poor ? '<p class="hint">골드가 부족합니다.</p>' : '') +
        '</div></div>';
    }
  }
  const owned = state.cards.slice().sort(function (a, b) {
    const ea = Cards.entry(a.dex), eb = Cards.entry(b.dex);
    if (gradeRank(ea.grade) !== gradeRank(eb.grade)) return gradeRank(eb.grade) - gradeRank(ea.grade);
    if (a.dex !== b.dex) return a.dex - b.dex;
    return b.plus - a.plus;
  });
  const list = owned.map(function (c) {
    const entry = Cards.entry(c.dex);
    const on = c.id === enhanceId ? ' on' : '';
    return '<button type="button" class="own-row' + on + '" data-act="pick-enhance" data-id="' + esc(c.id) + '">' +
      '<b>' + Cards.pad(entry.no) + ' ' + esc(entry.name) + '</b><span>' + entry.grade + ' · ' + esc(entry.pos) + ' · ' + c.plus + '강 · 오버롤(OVR) ' + Cards.ovrOf(c) +
      (isLocked(c.id) ? ' · 출전' : '') + '</span></button>';
  }).join('');
  const tradeCards = state.cards.filter(function (c) { return !isLocked(c.id); });
  const picked = tradePick.map(cardById).filter(Boolean);
  const tradeGrade = picked.length ? Cards.entry(picked[0].dex).grade : '';
  const tradeGrid = tradeCards.map(function (c) {
    const entry = Cards.entry(c.dex);
    const on = tradePick.indexOf(c.id) >= 0;
    return '<div class="trade-cell' + (on ? ' on' : '') + '" data-act="trade-toggle" data-id="' + esc(c.id) + '">' +
      cardMarkup(c, 'mini') + '<span class="trade-tag">' + entry.grade + ' ' + c.plus + '강</span></div>';
  }).join('');
  const upText = '노멀 3장 → 30% 레어 / 레어 3장 → 14% 스페셜 / 스페셜 3장 → 12% 유니크 / 유니크 3장 → 6% 레전드 / 레전드 3장 → 다른 레전드 확정';
  const canTrade = picked.length === 3 && picked.every(function (c) { return Cards.entry(c.dex).grade === tradeGrade; });
  openSheet(
    '<div class="sheet-head"><h2>강화 / 트레이드</h2><button type="button" class="ghost" data-act="close">닫기</button></div>' +
    '<div class="subtabs">' +
      '<button type="button" class="' + (manageMode === 'enhance' ? 'on' : '') + '" data-act="manage-tab" data-tab="enhance">순수 동일 카드 강화</button>' +
      '<button type="button" class="' + (manageMode === 'trade' ? 'on' : '') + '" data-act="manage-tab" data-tab="trade">3장 트레이드</button>' +
    '</div>' +
    (manageMode === 'enhance'
      ? enhanceBox + '<div class="own-list">' + list + '</div>'
      : '<p>출전 중이 아닌 같은 등급 카드 3장을 합성합니다. 실패하면 같은 등급의 새 카드 1장, 대성공이면 한 단계 위 등급입니다.</p><p>' + upText + '</p>' +
        '<div class="pop-actions"><button type="button" class="solid" data-act="do-trade"' + (canTrade ? '' : ' disabled') + '>합성 ' + picked.length + '/3' + (tradeGrade ? ' · ' + tradeGrade : '') + '</button></div>' +
        '<div class="card-grid">' + (tradeGrid || '<p>합성할 여분 카드가 없습니다.</p>') + '</div>'),
    'manage'
  );
}

function renderDex() {
  const filters = ['ALL', 'L', 'U', 'S', 'R', 'N'].map(function (g) {
    const label = g === 'ALL' ? '전체' : Cards.gradeName(g) + ' ' + g;
    return '<button type="button" class="' + (dexFilter === g ? 'on' : '') + '" data-act="dex-filter" data-grade="' + g + '">' + label + '</button>';
  }).join('');
  const html = Cards.DEX.filter(function (e) { return dexFilter === 'ALL' || e.grade === dexFilter; }).map(function (e) {
    const owned = state.dexSeen.indexOf(e.no) >= 0;
    if (!owned) return lockedMarkup(e.no);
    const sample = state.cards.filter(function (c) { return c.dex === e.no; }).sort(function (a, b) { return Cards.ovrOf(b) - Cards.ovrOf(a); })[0];
    const view = sample || { id: 'dex-' + e.no, dex: e.no, iv: [0, 0, 0, 0, 0, 0], plus: 0 };
    return '<div data-act="view-dex" data-dex="' + e.no + '">' + cardMarkup(view, 'mini') + '</div>';
  }).join('');
  openSheet(
    '<div class="sheet-head"><h2>카드 도감 (' + seenCount() + '/124)</h2><button type="button" class="ghost" data-act="close">닫기</button></div>' +
    '<p>타자 62 · 투수 62. 노멀 64 · 레어 32 · 스페셜 16 · 유니크 8 · 레전드 4. 이름, 포지션, 등급, MBTI, 스토리, 기본 능력치는 고정입니다.</p>' +
    '<div class="subtabs">' + filters + '</div><div class="card-grid">' + html + '</div>',
    'dex'
  );
}

function scoutPack() {
  if (scoutBusy) return;
  if (state.gold < SCOUT_COST) { renderScout(); return; }
  scoutBusy = true;
  state.gold -= SCOUT_COST;
  const card = Cards.pull();
  addCard(card);
  saveState();
  renderLobby();
  const entry = Cards.entry(card.dex);
  const drama = entry.grade === 'U' || entry.grade === 'L' ? entry.grade : null;
  showCardStage(card, Cards.gradeName(entry.grade) + '(' + entry.grade + ') · ' + entry.name, drama, false, function () {
    scoutBusy = false;
    if (sheetView === 'scout') renderScout();
    renderLobby();
  });
}

function doEnhance() {
  const target = cardById(enhanceId);
  if (!target) return;
  const entry = Cards.entry(target.dex);
  if (target.plus >= Cards.MAX_PLUS[entry.grade]) return;
  const fodder = state.cards.filter(function (c) { return c.id !== target.id && c.dex === target.dex && !isLocked(c.id); })
    .sort(function (a, b) { return a.plus - b.plus; })[0];
  const cost = Cards.enhanceCost(entry.grade, target.plus);
  if (!fodder || state.gold < cost) return;
  state.gold -= cost;
  removeCard(fodder.id);
  target.plus += 1;
  saveState();
  renderLobby();
  renderManage();
}

function doTrade() {
  const picked = tradePick.map(cardById).filter(function (c) { return c && !isLocked(c.id); });
  if (picked.length !== 3) return;
  const grade = Cards.entry(picked[0].dex).grade;
  if (picked.some(function (c) { return Cards.entry(c.dex).grade !== grade; })) return;
  const up = grade !== 'L' && Cards.tradeUpgrades(grade);
  const resultGrade = up ? Cards.nextGrade(grade) : grade;
  const except = grade === 'L' ? picked.map(function (c) { return c.dex; }) : null;
  const card = Cards.pullFromGrade(resultGrade, except);
  picked.forEach(function (c) { removeCard(c.id); });
  tradePick = [];
  addCard(card);
  saveState();
  renderLobby();
  const entry = Cards.entry(card.dex);
  const drama = entry.grade === 'U' || entry.grade === 'L' ? entry.grade : null;
  const note = (up ? '대성공! ' : (grade === 'L' ? '레전드 교환 · ' : '합성 완료 · ')) + Cards.gradeName(entry.grade) + '(' + entry.grade + ') ' + entry.name;
  showCardStage(card, note, drama, up, function () {
    if (sheetView === 'manage') renderManage();
    renderLobby();
  });
}

function armOf(id, label, slotIndex) {
  const pit = Cards.toPitcher(cardById(id));
  pit.label = label;
  pit.slotIndex = slotIndex;
  pit.cardId = id;
  pit.runs = 0;
  pit.innRuns = 0;
  pit.outs = 0;
  pit.stamina = 100;
  return pit;
}
function createMatchTeam() {
  const batters = state.lineup.map(function (id) {
    const batter = Cards.toBatter(cardById(id));
    batter.cardId = id;
    batter.ab = 0; batter.h = 0; batter.hr = 0; batter.rbi = 0;
    return batter;
  });
  const staff = state.rotation.map(function (id, i) { return armOf(id, (i + 1) + '선발', -1); });
  const bullpen = state.bullpen.map(function (id, i) { return armOf(id, PEN_LABELS[i], i); });
  const n = state.rotationIndex % 5;
  const pitcher = armOf(state.rotation[n], (n + 1) + '선발', -1);
  return { batters: batters, staff: staff, bullpen: bullpen, penUsed: [], appeared: [], pitcher: pitcher, idx: 0, score: 0, hits: 0, errors: 0 };
}

function handleMatchEnd(g) {
  const userWon = g.userSide === 'away' ? g.away.score > g.home.score : g.home.score > g.away.score;
  const scoreLine = (g.away.name || '원정') + ' ' + g.away.score + ' : ' + g.home.score + ' ' + (g.home.name || '홈');
  if (g.mode === 'mirror') {
    const modal = document.getElementById('resultModal');
    modal.classList.toggle('win', userWon);
    modal.classList.toggle('loss', !userWon);
    document.getElementById('resultKicker').textContent = 'MIRROR';
    document.getElementById('resultTitle').textContent = userWon ? '승리' : '패배';
    document.getElementById('resultScore').textContent = scoreLine;
    document.getElementById('resultReward').textContent = '동일 OVR 테스트 · 구단 데이터는 저장되지 않았습니다.';
    modal.hidden = false;
    return;
  }
  const win = userWon;
  let rewardText = '골드 보상 없음';
  let rewardCard = null;
  if (g.mode === 'league' || g.mode === 'post') {
    const prev = state.level;
    state.gold += LEAGUE_GOLD;
    rewardText = '+' + fmt(LEAGUE_GOLD) + ' G';
    if (state.league) {
      harvestUser(g);
      if (g.mode === 'league') recordRound(g.home.score, g.away.score);
      else onPostResult(userWon);
    }
    if (userWon) {
      state.wins += 1;
      state.level = 1 + Math.floor(state.wins / 2);
      rewardCard = Cards.pull();
      addCard(rewardCard);
      const entry = Cards.entry(rewardCard.dex);
      rewardText += ' · 기본 선수 카드 팩 · ' + Cards.gradeName(entry.grade) + ' ' + entry.name;
      if (state.level > prev) rewardText += ' · 구단 Lv.' + state.level;
      if (!state.lastNote) state.lastNote = '승리 · ' + scoreLine;
    } else {
      state.losses += 1;
      if (!state.lastNote) state.lastNote = '패배 · ' + scoreLine;
    }
  } else if (win) {
    state.gold += FRIENDLY_WIN_GOLD;
    rewardText = '친선 승리 +' + fmt(FRIENDLY_WIN_GOLD) + ' G';
    state.lastNote = '친선 승리 · 홈 ' + g.home.score + ' : 원정 ' + g.away.score + ' · +' + fmt(FRIENDLY_WIN_GOLD) + ' G';
  } else {
    state.lastNote = '친선 패배 · 홈 ' + g.home.score + ' : 원정 ' + g.away.score;
    rewardText = '친선 경기는 전적에 반영되지 않습니다.';
  }
  state.rotationIndex = (state.rotationIndex + 1) % 5;
  saveState();
  const modal = document.getElementById('resultModal');
  modal.classList.toggle('win', win);
  modal.classList.toggle('loss', !win);
  document.getElementById('resultKicker').textContent = g.mode === 'post' ? 'POSTSEASON' : g.mode === 'league' ? 'LEAGUE' : 'FRIENDLY';
  document.getElementById('resultTitle').textContent = win ? '승리' : '패배';
  document.getElementById('resultScore').textContent = scoreLine;
  document.getElementById('resultReward').textContent = rewardText;
  modal.hidden = false;
  if (rewardCard) {
    const entry = Cards.entry(rewardCard.dex);
    const drama = entry.grade === 'U' || entry.grade === 'L' ? entry.grade : null;
    showCardStage(rewardCard, '경기 보상 · ' + Cards.gradeName(entry.grade) + '(' + entry.grade + ') ' + entry.name, drama, false, null);
  }
}

popup.addEventListener('click', function (e) {
  if (e.target === popup) closePopup();
});
popupBody.addEventListener('click', function (e) {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const act = btn.getAttribute('data-act');
  const index = Number(btn.getAttribute('data-i'));
  if (act === 'close') closePopup();
  else if (act === 'friendly') enterMatch('friendly');
  else if (act === 'mirror') enterMatch('mirror');
  else if (act === 'scout-pack') scoutPack();
  else if (act === 'lineup-tab') {
    lineupTab = btn.getAttribute('data-tab') === 'pit' ? 'pit' : 'bat';
    renderLineup();
  } else if (act === 'select') { selectedSlot = index; renderLineup(); }
  else if (act === 'pick-staff') {
    selectedStaff = { kind: btn.getAttribute('data-kind') === 'rp' ? 'rp' : 'sp', index: index };
    renderLineup();
  } else if (act === 'set-staff') {
    const id = btn.getAttribute('data-id');
    const card = cardById(id);
    const entry = card ? Cards.entry(card.dex) : null;
    const list = selectedStaff.kind === 'sp' ? state.rotation : state.bullpen;
    const other = selectedStaff.kind === 'sp' ? state.bullpen : state.rotation;
    if (!entry || list.indexOf(id) >= 0) return;
    if (selectedStaff.kind === 'sp' && !Cards.isStarter(entry)) return;
    if (selectedStaff.kind === 'rp' && !Cards.isBullpen(entry)) return;
    const swapped = list[selectedStaff.index];
    const otherAt = other.indexOf(id);
    if (otherAt >= 0) other[otherAt] = swapped;
    list[selectedStaff.index] = id;
    saveState();
    renderLineup();
  } else if (act === 'up' && index > 0) {
    const tmp = state.lineup[index];
    state.lineup[index] = state.lineup[index - 1];
    state.lineup[index - 1] = tmp;
    selectedSlot = index - 1;
    saveState();
    renderLineup();
  } else if (act === 'down' && index < 8) {
    const tmp = state.lineup[index];
    state.lineup[index] = state.lineup[index + 1];
    state.lineup[index + 1] = tmp;
    selectedSlot = index + 1;
    saveState();
    renderLineup();
  } else if (act === 'insert') {
    const id = btn.getAttribute('data-id');
    if (state.lineup.indexOf(id) >= 0) return;
    const card = cardById(id);
    if (!card || Cards.isPitcher(Cards.entry(card.dex))) return;
    state.lineup[selectedSlot] = id;
    saveState();
    renderLineup();
  } else if (act === 'manage-tab') {
    manageMode = btn.getAttribute('data-tab');
    renderManage();
  } else if (act === 'pick-enhance') {
    enhanceId = btn.getAttribute('data-id');
    renderManage();
  } else if (act === 'do-enhance') doEnhance();
  else if (act === 'trade-toggle') {
    const id = btn.getAttribute('data-id');
    const card = cardById(id);
    if (!card || isLocked(id)) return;
    const grade = Cards.entry(card.dex).grade;
    const exist = tradePick.indexOf(id);
    if (exist >= 0) tradePick.splice(exist, 1);
    else {
      const first = tradePick.length ? cardById(tradePick[0]) : null;
      if (first && Cards.entry(first.dex).grade !== grade) tradePick = [];
      if (tradePick.length < 3) tradePick.push(id);
    }
    renderManage();
  } else if (act === 'do-trade') doTrade();
  else if (act === 'dex-filter') {
    dexFilter = btn.getAttribute('data-grade');
    renderDex();
  } else if (act === 'view-dex') {
    const no = Number(btn.getAttribute('data-dex'));
    if (state.dexSeen.indexOf(no) < 0) return;
    const sample = state.cards.filter(function (c) { return c.dex === no; }).sort(function (a, b) { return Cards.ovrOf(b) - Cards.ovrOf(a); })[0];
    const view = sample || { id: 'dex-' + no, dex: no, iv: [0, 0, 0, 0, 0, 0], plus: 0 };
    const entry = Cards.entry(no);
    showCardStage(view, '도감 ' + Cards.pad(no) + ' · ' + entry.name + (sample ? '' : ' · 기본 능력치'), null, false, function () {
      if (sheetView === 'dex') renderDex();
    });
  }
});

document.getElementById('btnLeague').onclick = function () {
  if (!state.league) { enterMatch('league'); return; }
  if (state.league.phase === 'ceremony' || state.league.showCeremony) { openAwards(); return; }
  if (state.league.phase === 'post') {
    if (!userInPost()) skipAiSeries();
    if (state.league.phase !== 'post' || !userInPost()) { renderLobby(); return; }
    enterMatch('post');
    return;
  }
  if (state.league.round >= 42) { openAwards(); return; }
  enterMatch('league');
};
document.getElementById('btnAwardNext').onclick = function () {
  document.getElementById('awardModal').hidden = true;
  if (!state.league || state.league.phase !== 'ceremony') { renderLobby(); return; }
  const rank = sortedTable().findIndex(function (r) { return r.id === 0; }) + 1;
  state.league.showCeremony = false;
  if (rank <= 4) openPostseason();
  else {
    const tier = state.league.tier;
    const season = state.league.season + 1;
    state.league = freshLeague();
    state.league.tier = tier;
    state.league.season = season;
    state.lastNote = TIERS[tier].name + ' 리그 시즌 ' + season + '이 시작됩니다.';
    saveState();
  }
  renderLobby();
};
document.getElementById('btnLadder').onclick = renderLadder;
document.getElementById('btnScout').onclick = renderScout;
document.getElementById('btnLineup').onclick = renderLineup;
document.getElementById('btnManage').onclick = renderManage;
document.getElementById('btnDex').onclick = renderDex;
document.getElementById('btnRecord').onclick = renderRecord;
document.getElementById('btnLobby').onclick = function () { stopMatch(); showLobby(); };
document.getElementById('btnResultLobby').onclick = function () { closeCardStage(); stopMatch(); showLobby(); };
document.getElementById('cardStageOk').onclick = closeCardStage;
window.addEventListener('keydown', function (e) {
  if (e.code !== 'Escape') return;
  if (!cardStage.hidden) closeCardStage();
  else if (!popup.hidden) closePopup();
});

window.Club = { createMatchTeam: createMatchTeam, handleMatchEnd: handleMatchEnd, matchMeta: matchMeta };
renderLobby();
showScreen('lobby');
