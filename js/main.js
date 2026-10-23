import { Game } from './engine/game.js';
import * as layouts from './engine/layouts.js';
import { HOURS, gameOptions } from './night.js';
import { sprite } from './ui/faces.js';
import { Board } from './ui/board.js';
import { Sound } from './ui/sound.js';
import { POINTS, par, scoreOf } from './score.js';

const MIDNIGHT = HOURS.findIndex((h) => h.name === 'Midnight');

const TREAT_NAMES = {
  candle: 'a candle, to show you a match',
  key: 'a skeleton key, to free a blocked tile',
  cat: 'a black cat, for a free shuffle',
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
// the best score for each hour, and the board in play as its seed and its
// moves.
let saved = { reached: 0, best: {}, scores: {}, playing: null };
try {
  saved = { ...saved, ...JSON.parse(localStorage.getItem('boneyard.night')) };
} catch {}

function store() {
  if (saved.playing) saved.playing.elapsed = played();
  try {
    localStorage.setItem('boneyard.night', JSON.stringify(saved));
  } catch {}
}

document.body.prepend(sprite());

// ------------------------------------------------------------- the boards

// Sets up a board: deals it from its seed, plays back any moves already
// made on it, and puts it on the page.
function play({ layout, options, seed, replay = [], playedFor = 0, at = -1 }) {
  hideCard();
  hour = at;
  game = new Game(layout, { seed, ...options });
  for (const move of replay) redo(move);
  moves = replay.slice();
  board = new Board($('board'), game, { say: toast, sound });
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
  if (hour >= 0) store();
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
// night's boards by name, with or without a midnight.
function freePlay(key = 'turtle', seed = newSeed(), turnAt = 0) {
  if (!FREE[key]) key = 'turtle';
  play({ layout: FREE[key], options: turnAt ? { turnAt } : {}, seed });
  history.replaceState(null, '', `#play/${key}/${seed}${turnAt ? `/${turnAt}` : ''}`);
  run();
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
  hold();
  finished = true;
  const time = played();
  const { total, rows } = scoreOf(game, time);
  const lines = [...rows, ['Score', '', total]];
  const timing = `In ${clock(time)}, against a par of ${clock(par(game))}.`;
  update();
  if (hour < 0) {
    const key = location.hash.split('/')[1];
    showCard('The board is clear!', timing, [['Deal again', () => freePlay(key)], ['The Long Night', menu]], [], lines);
    return;
  }
  const spec = HOURS[hour];
  const best = saved.scores[hour];
  if (best === undefined || total > best) saved.scores[hour] = total;
  if (!saved.best[hour] || time < saved.best[hour]) saved.best[hour] = time;
  saved.reached = Math.max(saved.reached, Math.min(hour + 1, HOURS.length - 1));
  saved.playing = null;
  store();
  const note = best === undefined ? '' : total > best ? ' Your best yet.' : ` Your best is ${signed(best, '')}.`;
  if (hour === HOURS.length - 1) {
    showCard('Dawn', `The sun is up, and you have seen the Long Night through. ${nightScore()}`, [
      ['Begin again', () => beginHour(0)],
      ['The turtle', () => freePlay('turtle')],
    ], [], lines);
  } else {
    showCard(`${spec.name}: cleared`, `${timing}${note}`, [
      [`On to ${HOURS[hour + 1].name}`, () => beginHour(hour + 1)],
      ['Play it again', () => beginHour(hour)],
    ], [], lines);
  }
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
  showCard('No pairs left', 'Shuffle the tiles left, or take back a move.', actions);
}

// The Long Night's own card: go on, begin, any hour reached so far, or free
// play. On a first visit it opens over the first board, not yet begun.
function menu(opening = false) {
  hold();
  const actions = [];
  if (game && !finished && opening !== true) actions.push(['Back to the board', () => (hideCard(), run())]);
  const p = saved.playing;
  const inPlay = p && (p.hour > 0 || p.moves.length > 0); // a board begun and not yet cleared
  if (inPlay && p.hour !== hour) actions.push([`Go on at ${HOURS[p.hour].name}`, () => beginHour(p.hour, p)]);
  else if (!inPlay && saved.reached > 0) actions.push([`On to ${HOURS[saved.reached].name}`, () => beginHour(saved.reached)]);
  actions.push([saved.reached > 0 || inPlay ? 'Begin again at 6 pm' : 'Begin at 6 pm', () => beginHour(0)]);
  if (hour >= 0 || !game) actions.push(['The turtle', () => freePlay('turtle')]);
  const hours = HOURS.map((h, i) => ({
    label: h.name,
    sub: saved.scores[i] !== undefined ? `★ ${signed(saved.scores[i], '')}` : '',
    act: () => beginHour(i),
    disabled: i > saved.reached,
  }));
  const intro = 'Thirteen boards, one an hour from dusk to dawn. Each hour you reach can be played again.';
  showCard('The Long Night', `${intro} ${nightScore()}`.trim(), actions, hours);
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
    $(t).querySelector('b').textContent = g.treats[t];
    $(t).disabled = !g.treats[t];
  }
  $('key').classList.toggle('on', board.keying);
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
function run() {
  if (!started && !finished) started = performance.now();
}

function hold() {
  elapsed = played();
  started = 0;
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
// last line its total.
function showCard(title, text, actions, grid = [], lines = []) {
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
  for (const { label, sub, act, disabled } of grid) {
    const b = document.createElement('button');
    b.type = 'button';
    b.disabled = disabled;
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

// Everything the buttons and keys do.
function help(what) {
  if (!game || board.busy || (finished && what !== 'undo')) return;
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
    }
    if (game.outlook === 'lost') toast("This board can't be won from here: undo, or shuffle.");
  } else if (what === 'shuffle' || what === 'cat') {
    if (!game.shuffle({ cat: what === 'cat' })) toast('No shuffle can help now: undo instead.');
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
  $('sound').textContent = sound.muted ? '🔇' : '🔊';
  $('sound').title = sound.muted ? 'Sound is off (M)' : 'Sound is on (M)';
}
showSound();
$('new').onclick = () => freePlay(location.hash.split('/')[1]);
for (const what of ['undo', 'hint', 'shuffle', 'candle', 'key', 'cat']) $(what).onclick = () => help(what);

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
  if (e.key === ' ') {
    e.preventDefault();
    board.peek(false);
  }
});

// Offline play: sw.js keeps every file the game needs.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

new ResizeObserver(() => board && board.fit()).observe($('table'));
setInterval(tick, 1000);
addEventListener('pagehide', () => hour >= 0 && store());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && hour >= 0) store();
});

// An address of #play/name/seed plays that board freely; otherwise the night
// goes on where it was left, or begins, as it does for a visitor who only
// looked at the first board last time.
const [mode, key, seed, turnAt] = location.hash.slice(1).split('/');
const p = saved.playing;
const goingOn = p && HOURS[p.hour] && (saved.reached > 0 || p.hour > 0 || p.moves.length > 0);
if (mode === 'play') freePlay(key, Number(seed) || newSeed(), Number(turnAt) || 0);
else if (goingOn) beginHour(p.hour, p);
else {
  beginHour(0);
  menu(true);
}
