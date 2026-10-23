import { Game } from './engine/game.js';
import * as layouts from './engine/layouts.js';
import { HOURS, gameOptions } from './night.js';
import { sprite } from './ui/faces.js';
import { Board } from './ui/board.js';
import { Magnifier } from './ui/magnifier.js';
import { Sound } from './ui/sound.js';
import { POINTS, par, scoreOf } from './score.js';
import { Leaderboard, BOARDS, NIGHT, boardOf, nameOf, nameProblem, tidy } from './leaderboard.js';

const MIDNIGHT = HOURS.findIndex((h) => h.name === 'Midnight');

const TREAT_NAMES = {
  candle: 'a candle, to show you a match',
  key: 'a skeleton key, to free a blocked tile',
  cat: 'a black cat, for a free shuffle',
};

// What each treat does, for a player who taps one with none in hand.
const TREAT_HELP = {
  candle: 'A candle shows you a match, for free.',
  key: 'A skeleton key frees one blocked tile.',
  cat: 'A black cat shuffles the tiles for free.',
};

// Every layout by the name an address can give it, for free play: #play/raven/12345.
const FREE = Object.fromEntries(Object.entries(layouts).map(([k, L]) => [k.toLowerCase(), L]));

const $ = (id) => document.getElementById(id);
const newSeed = () => Math.floor(Math.random() * 1e9);
const sound = new Sound();

let game = null;
let board = null;
let hour = -1; // the hour of the Long Night being played, or -1 for free play
let moves = []; // what has been done on this board, to play it back after a reload
let elapsed = 0; // seconds played before the clock last started
let started = 0; // when the clock last started, or 0 while it is held
let finished = false;
let woke = 0;
let prompted = false;

// What is kept between visits: the latest hour reached, the best time and
// the best score for each hour, with the time that score took, the boards in
// play, the night's and the one outside it, each as its seed and its moves,
// and the player's name on the leaderboard, with what has been posted there.
let saved = { reached: 0, best: {}, scores: {}, times: {}, playing: null, free: null, name: '', declined: false, posted: {} };
try {
  saved = { ...saved, ...JSON.parse(localStorage.getItem('boneyard.night')) };
} catch {}

function store() {
  const onTable = hour >= 0 ? saved.playing : saved.free; // while it is not yet cleared
  if (onTable) onTable.elapsed = played();
  try {
    localStorage.setItem('boneyard.night', JSON.stringify(saved));
  } catch {}
}

document.body.prepend(sprite());

// Holding a tile shows it up close: from the start on a phone, whose tiles
// are small, and on anything by the switch on the night's card.
const magnifier = new Magnifier();
let magnifying = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
try {
  const kept = localStorage.getItem('boneyard.magnifier');
  if (kept) magnifying = kept === 'on';
} catch {}

const leaderboard = new Leaderboard();

// ------------------------------------------------------------- the boards

// Sets up a board: deals it from its seed, plays back any moves already
// made on it, and puts it on the page. The board it takes the place of is
// kept first, with all the time played on it.
function play({ layout, options, seed, replay = [], playedFor = 0, at = -1 }) {
  if (game && !finished) store();
  hideCard();
  hour = at;
  game = new Game(layout, { seed, ...options });
  for (const move of replay) redo(move);
  moves = replay.slice();
  board = new Board($('board'), game, { say: toast, sound, magnifier: magnifying ? magnifier : null });
  game.on('match', ({ a, b }) => {
    sound.match();
    board.float(`+${POINTS.pair}`, b);
    record(['m', a, b]);
  });
  game.on('undo', () => {
    sound.undo();
    record(['u']);
    if (finished) {
      finished = false; // taking back the last match of a cleared board starts the clock again
      run();
    }
  });
  game.on('shuffle', ({ cat }) => {
    sound.shuffle();
    if (!cat) board.float(signed(POINTS.shuffle), -1, true);
    record([cat ? 'c' : 's']);
  });
  game.on('key', (i) => record(['k', i]));
  game.on('treat', ({ treat }) => {
    sound.treat();
    toast(`The jack-o'-lanterns left ${TREAT_NAMES[treat]}.`);
  });
  game.on('turn', turned);
  game.on('win', () => {
    sound.win();
    won();
  });
  game.on('stuck', () => {
    sound.stuck();
    stuck();
  });
  elapsed = playedFor;
  started = 0;
  finished = false;
  cover(true); // until its clock starts
  const turn = game.history.find((e) => e.souls);
  woke = turn ? turn.souls.length : 0;
  prompted = false;
  update();
}

function redo([what, a, b]) {
  if (what === 'm') game.match(a, b);
  else if (what === 'u') game.undo();
  else if (what === 's') game.shuffle();
  else if (what === 'c') game.shuffle({ cat: true });
  else if (what === 'k') game.useKey(a);
  else if (what === 'h') game.hint();
  else if (what === 'l') game.useCandle();
}

function record(move) {
  moves.push(move);
  store();
  update();
}

// Starts an hour of the Long Night, or goes on with one from where it was left.
function beginHour(at, keep = null) {
  const spec = HOURS[at];
  const seed = keep ? keep.seed : newSeed();
  play({ layout: spec.layout, options: gameOptions(at), seed, replay: keep ? keep.moves : [], playedFor: keep ? keep.elapsed : 0, at });
  saved.playing = { hour: at, seed, moves, elapsed };
  store();
  history.replaceState(null, '', location.pathname + location.search);
  if (keep) {
    run();
    toast(`Back at ${spec.name}.`);
  } else {
    showCard(`${spec.name}: ${spec.title}`, spec.text, [['Play', () => (hideCard(), run())]]);
  }
}

// A board outside the night, as often as you like: the turtle, or any of the
// night's boards by name, with or without a midnight. Like the night's, the
// board in play is kept, to go on with after a reload or a visit to the
// night: `keep` is that board.
let freeKey = 'turtle'; // the board free play deals,
let freeTurn = 0; // and after how many matches its tiles turn over, if they do
function freePlay(key = 'turtle', seed = newSeed(), turnAt = 0, keep = null) {
  if (!FREE[key]) key = 'turtle';
  freeKey = key;
  freeTurn = turnAt;
  play({ layout: FREE[key], options: turnAt ? { turnAt } : {}, seed, replay: keep ? keep.moves : [], playedFor: keep ? keep.elapsed : 0 });
  saved.free = { key, seed, turnAt, moves, elapsed };
  store();
  history.replaceState(null, '', `#play/${key}/${seed}${turnAt ? `/${turnAt}` : ''}`);
  run();
  if (keep && keep.moves.length) toast(`Back to your ${game.layout.name.toLowerCase()}.`);
}

function turned({ souls }) {
  woke = souls.length;
  if (game.sideName === 'night') sound.midnight();
  else sound.sunrise();
  const what = game.sideName === 'night' ? 'Midnight! The tiles turn over.' : 'Sunrise! The tiles turn back to day.';
  toast(woke ? `${what} ${woke} lost ${woke === 1 ? 'soul wakes' : 'souls wake'}: lost souls match each other.` : `${what} Not one lost soul.`);
  const earned = woke ? woke * POINTS.soul : POINTS.clean;
  setTimeout(() => board.float(signed(earned), -1, earned < 0), 900); // once the tiles have turned
  update();
}

// A cleared board: its score, line by line, and the best for its hour kept.
function won() {
  finished = true;
  hold();
  const time = played();
  const { total, rows } = scoreOf(game, time);
  const lines = [...rows, ['Score', '', total]];
  const timing = `In ${clock(time)}, against a par of ${clock(par(game))}.`;
  update();
  if (hour < 0) {
    saved.free = null;
    store();
    showCard('The board is clear!', timing, [['Deal again', () => freePlay(freeKey, newSeed(), freeTurn)], ['Back to the Long Night', toNight]], [], lines);
    return;
  }
  const spec = HOURS[hour];
  const best = saved.scores[hour];
  const better = best === undefined || total > best;
  if (better) {
    saved.scores[hour] = total;
    saved.times[hour] = Math.floor(time);
  }
  if (!saved.best[hour] || time < saved.best[hour]) saved.best[hour] = time;
  saved.reached = Math.max(saved.reached, Math.min(hour + 1, HOURS.length - 1));
  saved.playing = null;
  store();
  const note = best === undefined ? '' : better ? ' Your best yet.' : ` Your best is ${signed(best, '')}.`;
  if (hour === HOURS.length - 1) {
    showCard('Dawn', `The sun is up, and you have seen the Long Night through. ${nightScore()}`, [
      ['Begin again', () => beginHour(0)],
      ['Play the turtle', toTurtle],
      ...toLeaderboard(boardOf(hour)),
    ], [], lines);
  } else {
    showCard(`${spec.name}: cleared`, `${timing}${note}`, [
      [`On to ${HOURS[hour + 1].name}`, () => beginHour(hour + 1)],
      ['Play it again', () => beginHour(hour)],
      ...toLeaderboard(boardOf(hour)),
    ], [], lines);
  }
  if (better && hour === HOURS.length - 1) postAndRank(NIGHT, Object.values(saved.scores).reduce((a, b) => a + b, 0));
  else if (better) postAndRank(boardOf(hour), total);
}

// The night score: the best score at each hour, added up.
function nightScore() {
  const scores = Object.values(saved.scores);
  if (!scores.length) return '';
  return `Your night score, your best at each hour added up, is ${signed(scores.reduce((a, b) => a + b, 0), '')}.`;
}

function stuck() {
  const actions = [['Shuffle', () => help('shuffle')], ['Undo', () => help('undo')]];
  if (game.treats.cat) actions.unshift(['Black cat', () => help('cat')]);
  if (game.treats.key) actions.push(['Skeleton key', () => help('key')]);
  actions.push(['Give up', giveUp]);
  showCard('No pairs left', 'Shuffle the tiles left, take back a move, or give up the board.', actions);
}

// The menu: back to the board or give it up, the Long Night or the turtle,
// any hour reached so far, and the leaderboard. On a first visit it opens
// over the first board, not yet begun. The night's board in play and the
// turtle's are both kept, so that going from one to the other loses neither.
function menu(opening = false) {
  hold();
  if (opening === true) cover(false); // a first board to look at, dealt afresh before it is played
  const playing = game && !finished && opening !== true;
  const night = nightInPlay();
  const actions = [];
  if (playing) actions.push(['Back to the board', () => (hideCard(), run())]);
  if (playing && moves.length) actions.push(['Give up this board', giveUp]);
  if (hour < 0) actions.push(['Back to the Long Night', toNight]);
  else if (!night) actions.push(saved.reached > 0 ? [`On to ${HOURS[saved.reached].name}`, () => beginHour(saved.reached)] : ['Begin at 6 pm', () => beginHour(0)]);
  if (hour >= 0) actions.push(['Play the turtle', toTurtle]);
  if (leaderboard.on) actions.push(['Leaderboard', () => showLeaderboard(hour >= 0 ? boardOf(hour) : NIGHT)]);
  const hours = HOURS.map((h, i) => ({
    label: h.name,
    sub: saved.scores[i] !== undefined ? `★ ${signed(saved.scores[i], '')}` : '',
    act: () => toHour(i),
    disabled: i > saved.reached,
    on: night && night.hour === i,
  }));
  const intro = 'Thirteen boards, one an hour from dusk to dawn. Each hour you reach can be played again.';
  showCard('The Long Night', `${intro} ${nightScore()}`.trim(), actions, hours);
  $('magnify').checked = magnifying;
  $('card-options').hidden = false;
}

// The night's board in play: come to, or begun, and not yet cleared.
function nightInPlay() {
  const p = saved.playing;
  return p && HOURS[p.hour] && (p.hour > 0 || p.moves.length > 0) ? p : null;
}

// An hour from the menu: the night's board in play, if it is at that hour,
// or else the hour dealt afresh, once the player has agreed to give up a
// board begun at another hour.
function toHour(i) {
  const night = nightInPlay();
  if (night && night.hour === i) {
    if (hour === i) {
      hideCard();
      run();
    } else beginHour(i, night);
    return;
  }
  if (night && night.moves.length) {
    askToLose({ which: `your board at ${HOURS[night.hour].name}`, then: `${HOURS[i].name} begins`, go: () => beginHour(i), back: () => menu(), keep: 'Keep it' });
    return;
  }
  beginHour(i);
}

// Back to the Long Night: its board in play, or the latest hour reached.
function toNight() {
  const p = saved.playing;
  if (p && HOURS[p.hour]) beginHour(p.hour, p);
  else beginHour(saved.reached);
}

// The turtle: the one in play, if there is one, or else a new deal, once the
// player has agreed to give up any other board begun outside the night.
function toTurtle() {
  const f = saved.free;
  if (f && f.key === 'turtle') freePlay('turtle', f.seed, f.turnAt, f);
  else if (f && f.moves.length) {
    askToLose({ which: `your ${FREE[f.key].name.toLowerCase()}`, then: 'a turtle is dealt', go: () => freePlay('turtle'), back: () => menu(), keep: 'Keep it' });
  } else freePlay('turtle');
}

// Gives up the board in play, once the player has said so: the same hour of
// the night deals again, or the same board outside it.
function giveUp() {
  askToLose({
    which: 'this board',
    then: hour >= 0 ? `${HOURS[hour].name} deals again` : 'a new one is dealt',
    go: hour >= 0 ? () => beginHour(hour) : () => freePlay(freeKey, newSeed(), freeTurn),
    back: () => (hideCard(), run()),
  });
}

// A new deal outside the night: at once, unless this one has moves to lose.
function newDeal() {
  if (!finished && moves.length) giveUp();
  else freePlay(freeKey, newSeed(), freeTurn);
}

// Asks before throwing away a board with moves on it: which board, and what
// happens instead. The way back, `keep`, comes first, so that a key pressed
// without thinking keeps the board.
function askToLose({ which, then, go, back, keep = 'Keep playing' }) {
  hold();
  showCard(`Give up ${which}?`, `The moves made on it will be lost, and ${then}.`, [[keep, back], ['Give up', go]]);
}

// -------------------------------------------------------- the leaderboard

// The win card's way to the leaderboard: straight there, or by joining it
// first, for a player who has not yet said whether they would.
function toLeaderboard(where) {
  if (!leaderboard.on) return [];
  if (!saved.name && !saved.declined) return [['Join the leaderboard', () => askName(() => showLeaderboard(where))]];
  return [['Leaderboard', () => showLeaderboard(where)]];
}

// Puts the player's bests on the leaderboard, those not there yet: each
// hour's, with the time it took, and the night's, the bests added up. What
// cannot go now goes the next time. One posting at a time.
let posting = Promise.resolve();
function postScores() {
  posting = posting.then(sendScores).catch(() => {});
  return posting;
}

async function sendScores() {
  if (!leaderboard.on || !saved.name) return;
  const due = (where, score) => {
    const was = saved.posted[where];
    return score >= 0 && !(was && was.score === score && was.name === saved.name);
  };
  const entries = [];
  for (const [h, score] of Object.entries(saved.scores)) {
    const where = boardOf(Number(h));
    if (due(where, score)) entries.push({ board: where, name: saved.name, score, seconds: Math.floor(saved.times[h] ?? saved.best[h]) });
  }
  const bests = Object.values(saved.scores);
  const night = bests.reduce((a, b) => a + b, 0);
  if (bests.length && due(NIGHT, night)) entries.push({ board: NIGHT, name: saved.name, score: night, hours: bests.length });
  if (!entries.length) return;
  for (const e of await leaderboard.post(entries)) saved.posted[e.board] = { score: e.score, name: e.name };
  store();
}

// After a new best, up it goes, and the win card, while it is still up,
// says where it stands.
async function postAndRank(where, score) {
  if (!leaderboard.on || !saved.name) return;
  const title = $('card-title').textContent;
  const still = () => !$('card').hidden && $('card-title').textContent === title;
  await postScores();
  if (!still() || !saved.posted[where] || saved.posted[where].score !== score) return;
  try {
    const place = ordinal(await leaderboard.rank(where, score));
    if (!still()) return;
    $('card-text').textContent += where === NIGHT ? ` Your night is ${place} on the leaderboard.` : ` That's ${place} on the leaderboard.`;
  } catch {}
}

// The leaderboard's card: the best ten on a board, and the player's own
// place if they are further down, with every board to choose from.
let shown = null; // the board the card shows, while it is up
async function showLeaderboard(where) {
  hold();
  const grid = BOARDS.map((b) => ({
    label: nameOf(b),
    sub: saved.posted[b] ? `★ ${saved.posted[b].score.toLocaleString()}` : '',
    act: () => showLeaderboard(b),
    on: b === where,
  }));
  const actions = [
    ['Back', () => menu()],
    [saved.name ? 'Your name' : 'Join the leaderboard', () => askName(() => showLeaderboard(where))],
  ];
  const about = where === NIGHT ? "The whole night: each player's best at every hour, added up." : `The best at ${nameOf(where)}.`;
  showCard('Leaderboard', `${about} Fetching…`, actions, grid);
  showRanks([], null); // its ten places, empty, so that nothing moves when they come
  shown = where;
  try {
    const rows = await leaderboard.top(where);
    const mine = saved.posted[where];
    let below = null; // the player, when they are on the board but not in its first ten
    if (mine && leaderboard.me && !rows.some((r) => r.id === leaderboard.me)) {
      below = { name: mine.name, score: mine.score, place: await leaderboard.rank(where, mine.score) };
    }
    if (shown !== where) return;
    $('card-text').textContent = rows.length ? about : `${about} No one is on it yet.`;
    showRanks(rows, below);
  } catch {
    if (shown === where) $('card-text').textContent = `${about} The leaderboard can't be reached just now.`;
  }
}

function showRanks(rows, below) {
  const table = $('card-ranks');
  table.replaceChildren();
  const add = (place, name, score, me) => {
    const tr = table.insertRow();
    if (me) tr.className = 'me';
    tr.insertCell().textContent = place;
    tr.insertCell().textContent = name;
    tr.insertCell().textContent = score.toLocaleString();
  };
  rows.forEach((r, k) => add(k + 1, r.name, r.score, r.id === leaderboard.me));
  for (let k = rows.length; k < 10; k++) table.insertRow().insertCell().colSpan = 3;
  if (below) {
    const gap = table.insertRow().insertCell();
    gap.colSpan = 3;
    gap.textContent = '⋯';
    add(below.place, below.name, below.score, true);
  }
  table.hidden = false;
}

// The card for joining the leaderboard, or for changing the name on it or
// coming off it. `then` is where to go afterwards.
function askName(then) {
  hold();
  const joined = Boolean(saved.name);
  const input = $('card-input');
  const save = async () => {
    const name = tidy(input.value);
    const problem = nameProblem(name);
    if (problem) {
      $('card-text').textContent = problem;
      input.focus();
      return;
    }
    saved.name = name;
    saved.declined = false;
    store();
    $('card-text').textContent = 'Putting your best scores up…';
    await postScores();
    then();
  };
  const actions = [['Save', save]];
  if (joined) actions.push(['Leave the leaderboard', () => leave(then)]);
  actions.push([
    joined ? 'Back' : 'Not now',
    () => {
      if (!joined) {
        saved.declined = true;
        store();
      }
      then();
    },
  ]);
  showCard(joined ? 'Your name' : 'Join the leaderboard', 'The name everyone will see beside your best scores: 16 letters at most.', actions);
  input.hidden = false;
  input.value = saved.name;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  };
  input.focus();
}

// Takes the player's scores off every board, and forgets their name.
async function leave(then) {
  $('card-text').textContent = 'Taking your scores down…';
  try {
    await posting;
    await leaderboard.leave();
  } catch {
    $('card-text').textContent = "The leaderboard can't be reached just now: try again later.";
    return;
  }
  saved.name = '';
  saved.declined = true;
  saved.posted = {};
  store();
  toast('Your scores are off the leaderboard.');
  then();
}

// 1st, 2nd, 3rd, 4th, ... 11th, 12th, 13th, ... 21st.
function ordinal(n) {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n.toLocaleString()}${(!teen && { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10]) || 'th'}`;
}

// --------------------------------------------------------- what's showing

function update() {
  const g = game;
  $('where').innerHTML = hour >= 0 ? `<b>${HOURS[hour].name}</b> ${HOURS[hour].layout.name}` : `<b>Free play</b> ${g.layout.name}`;
  $('new').hidden = hour >= 0;
  $('left').innerHTML = `<b>${g.left}</b> tiles`;
  $('score').innerHTML = `★ <b>${signed(scoreOf(g, played()).total, '')}</b>`;
  const turns = g.sides.length > 1;
  const night = g.sideNames[1] === 'night';
  $('clock').hidden = !turns;
  if (turns) {
    $('clock').innerHTML = g.turnAhead
      ? `${night ? '🕛' : '🌅'} <b>${g.untilTurn}</b> to ${night ? 'midnight' : 'sunrise'}`
      : night
        ? '🌙 night'
        : '☀️ day';
  }
  $('souls').hidden = !turns;
  $('souls').title = g.turnAhead ? 'Lost souls if the tiles turned over now' : 'Lost souls that woke';
  $('souls').innerHTML = `👻 <b>${g.turnAhead ? g.soulsIfNow() : woke}</b>`;
  for (const t of ['candle', 'key', 'cat']) {
    $(t).querySelector('.count').textContent = g.treats[t];
    $(t).classList.toggle('none', !g.treats[t]);
  }
  $('key').classList.toggle('on', board.keying);
  $('pause').disabled = finished;
  $('undo').disabled = !g.history.length;
  $('moon').disabled = !g.turnAhead;
  document.body.classList.toggle('night', g.sideName === 'night');
  sky();
  if (hour === MIDNIGHT && g.turnAhead && g.untilTurn === 3 && !prompted) {
    prompted = true;
    toast('Three matches to midnight. Hold the moon to see the night side, and take pairs that match on both sides.');
  }
  tick();
}

// The sky behind the board: the hour's own, or the dawn once the sun is up.
function sky() {
  const s = document.body.style;
  if (hour < 0) {
    s.removeProperty('--sky-top');
    s.removeProperty('--sky-low');
    return;
  }
  const spec = HOURS[hour];
  const [top, low] = spec.dawn && game.sideName === 'day' ? spec.dawn : spec.sky;
  s.setProperty('--sky-top', top);
  s.setProperty('--sky-low', low);
}

// The clock runs while a board is in play, and holds while a card is up.
// While it holds on a board not yet cleared, the board is hidden, so that
// no one can study it with the clock stopped.
function run() {
  if (!started && !finished) started = performance.now();
  paused = false;
  cover(false);
}

function hold() {
  elapsed = played();
  started = 0;
  cover(!finished);
}

function cover(on) {
  document.body.classList.toggle('covered', on);
}

// A pause, from its button, the P key, or the player leaving the page: the
// clock stops and the board is hidden until they come back.
let paused = false;
function pause() {
  if (!game || finished || !started) return;
  hold();
  showCard('Paused', 'The clock has stopped, and the board is hidden until you come back.', [['Resume', () => (hideCard(), run())]]);
  paused = true;
}

const played = () => elapsed + (started ? (performance.now() - started) / 1000 : 0);
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Points with their sign, the minus a true one: +10, −100. With no plus, for totals.
const signed = (n, plus = '+') => (n < 0 ? `−${(-n).toLocaleString()}` : `${n ? plus : ''}${n.toLocaleString()}`);

// The clock, against par.
function tick() {
  if (!game) return;
  $('time').textContent = `⏱ ${clock(played())} / ${clock(par(game))}`;
  $('time').title = 'Time, against par: two points for every second under it';
}

let toastTimer = 0;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
}

// A card over the board: a title, a few words, buttons, and perhaps a grid
// of smaller buttons with a line under each, or a score line by line, the
// last line its total. Only the night's card shows the options under them,
// and only the leaderboard's its places, and the name card its box.
function showCard(title, text, actions, grid = [], lines = []) {
  shown = null;
  paused = false;
  $('card-options').hidden = true;
  $('card-input').hidden = true;
  $('card-ranks').hidden = true;
  $('card-title').textContent = title;
  $('card-text').textContent = text;
  const table = $('card-score');
  table.replaceChildren();
  table.hidden = !lines.length;
  lines.forEach(([what, how, n], k) => {
    const tr = table.insertRow();
    if (k === lines.length - 1) tr.className = 'total';
    tr.insertCell().textContent = what;
    tr.insertCell().textContent = how;
    tr.insertCell().textContent = k === lines.length - 1 ? signed(n, '') : signed(n);
  });
  const box = $('card-grid');
  box.replaceChildren();
  box.hidden = !grid.length;
  for (const { label, sub, act, disabled, on } of grid) {
    const b = document.createElement('button');
    b.type = 'button';
    b.disabled = disabled;
    b.classList.toggle('on', Boolean(on));
    b.innerHTML = `${label}<small>${sub || '&nbsp;'}</small>`;
    b.onclick = act;
    box.append(b);
  }
  const row = $('card-actions');
  row.replaceChildren();
  for (const [label, act] of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = act;
    row.append(b);
  }
  $('card').hidden = false;
  row.firstChild.focus();
}

function hideCard() {
  $('card').hidden = true;
}

// ---------------------------------------------------------- buttons and keys

// Everything the buttons and keys do. A treat with none in hand says what it
// would do, and where treats come from.
function help(what) {
  if (!game || board.busy || (finished && what !== 'undo')) return;
  if (TREAT_HELP[what] && !game.treats[what]) {
    toast(`${TREAT_HELP[what]} ${game.rules.treats ? "Each pair of jack-o'-lanterns leaves a treat." : 'Treats begin at 7 pm.'}`);
    return;
  }
  hideCard();
  run();
  if (what === 'undo') game.undo();
  else if (what === 'hint' || what === 'candle') {
    const pair = what === 'hint' ? game.hint() : game.useCandle();
    record([what === 'hint' ? 'h' : 'l']);
    if (pair) {
      sound.hint();
      board.show(pair);
      if (what === 'hint') board.float(signed(POINTS.hint), pair[0], true);
      else toast('The candle shows you a match, for free.');
    }
    if (game.outlook === 'lost') toast("This board can't be won from here: undo, or shuffle.");
  } else if (what === 'shuffle' || what === 'cat') {
    if (!game.shuffle({ cat: what === 'cat' })) toast('No shuffle can help now: undo instead.');
    else if (what === 'cat') toast('The black cat knocks the tiles about: a free shuffle.');
  } else if (what === 'key') {
    if (!game.treats.key) return;
    board.setKeying(!board.keying);
    if (board.keying) toast('Choose a blocked tile for the skeleton key.');
  }
  update();
}

$('menu').onclick = () => menu();
$('sound').onclick = () => toggleSound();

function toggleSound() {
  sound.setMuted(!sound.muted);
  showSound();
}

function showSound() {
  $('sound').querySelector('.icon').textContent = sound.muted ? '🔇' : '🔊';
  $('sound').querySelector('.label').textContent = sound.muted ? 'Sound off' : 'Sound on';
  $('sound').title = sound.muted ? 'Sound is off (M)' : 'Sound is on (M)';
}
showSound();
$('new').onclick = newDeal;
$('pause').onclick = pause;

$('magnify').onchange = (e) => {
  magnifying = e.target.checked;
  try {
    localStorage.setItem('boneyard.magnifier', magnifying ? 'on' : 'off');
  } catch {}
  if (board) board.setMagnifier(magnifying ? magnifier : null);
};
for (const what of ['undo', 'hint', 'shuffle', 'candle', 'key', 'cat']) $(what).onclick = () => help(what);
$('hint').title = `A hint, for ${-POINTS.hint} points (H)`;
$('shuffle').title = `A shuffle, for ${-POINTS.shuffle} points (S)`;

const moon = $('moon');
moon.onpointerdown = (e) => {
  try {
    moon.setPointerCapture(e.pointerId); // keep peeking if the finger slides off
  } catch {}
  board.peek(true);
};
moon.onpointerup = moon.onpointercancel = () => board.peek(false);
moon.oncontextmenu = (e) => e.preventDefault();

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return; // a name being typed
  if (e.key === ' ') {
    e.preventDefault();
    if (!e.repeat) board.peek(true);
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) {
    if (e.key === 'z') {
      e.preventDefault();
      help('undo');
    }
    return;
  }
  const act = { h: 'hint', u: 'undo', z: 'undo', s: 'shuffle' }[e.key.toLowerCase()];
  if (act) help(act);
  else if (e.key.toLowerCase() === 'n' && hour < 0) $('new').click();
  else if (e.key.toLowerCase() === 'm') toggleSound();
  else if (e.key.toLowerCase() === 'p') {
    if (paused) {
      hideCard();
      run();
    } else pause();
  }
  else if (e.key === 'Escape') {
    board.setKeying(false);
    board.select(-1);
    if (!$('card').hidden && game && !finished) {
      hideCard();
      run();
    }
    update();
  }
});
document.addEventListener('keyup', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === ' ') {
    e.preventDefault();
    board.peek(false);
  }
});

// Offline play: sw.js keeps every file the game needs.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

new ResizeObserver(() => board && board.fit()).observe($('table'));
setInterval(tick, 1000);
addEventListener('pagehide', store);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  pause(); // called away: the clock stops while the player is gone
  store();
});

// An address of #play/name/seed plays that board freely, going on with it if
// it is the one kept (as it is when the page is reloaded); otherwise the
// night goes on where it was left, or begins, as it does for a visitor who
// only looked at the first board last time.
const [mode, key, seed, turnAt] = location.hash.slice(1).split('/');
const p = saved.playing;
const f = saved.free;
const goingOn = p && HOURS[p.hour] && (saved.reached > 0 || p.hour > 0 || p.moves.length > 0);
if (mode === 'play') {
  const kept = f && f.key === key && (!seed || f.seed === Number(seed)) && f.turnAt === (Number(turnAt) || 0) ? f : null;
  freePlay(key, kept ? kept.seed : Number(seed) || newSeed(), Number(turnAt) || 0, kept);
} else if (goingOn) beginHour(p.hour, p);
else {
  beginHour(0);
  menu(true);
}
postScores(); // any bests that could not go up last time
