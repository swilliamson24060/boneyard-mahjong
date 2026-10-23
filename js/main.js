import { Game } from './engine/game.js';
import { TURTLE, PUMPKIN } from './engine/layouts.js';
import { sprite } from './ui/faces.js';
import { Board } from './ui/board.js';

// The boards to choose from, until the Long Night has its thirteen.
const BOARDS = {
  pumpkin: { name: 'Pumpkin', layout: PUMPKIN },
  'pumpkin-midnight': { name: 'Pumpkin at midnight', layout: PUMPKIN, turnAt: 20 },
  turtle: { name: 'Turtle', layout: TURTLE },
  'turtle-midnight': { name: 'Turtle at midnight', layout: TURTLE, turnAt: 36 },
};
const FIRST = 'pumpkin-midnight';

// Seconds added to the time for help: a hint, and a shuffle. Treats are free.
const HINT_COST = 15;
const SHUFFLE_COST = 30;

const TREAT_NAMES = {
  candle: 'a candle, to show you a match',
  key: 'a skeleton key, to free a blocked tile',
  cat: 'a black cat, for a free shuffle',
};

const $ = (id) => document.getElementById(id);
let game = null;
let board = null;
let key = FIRST;
let started = 0;
let finished = 0;
let woke = 0;

document.body.prepend(sprite());

for (const [k, spec] of Object.entries(BOARDS)) $('pick').add(new Option(spec.name, k));

// Starts a board, from a seed so that the same deal can be had again: the
// address keeps both, as #board/seed.
function start(k, seed = Math.floor(Math.random() * 1e9)) {
  key = BOARDS[k] ? k : FIRST;
  const spec = BOARDS[key];
  game = new Game(spec.layout, { seed, turnAt: spec.turnAt ?? Infinity });
  board = new Board($('board'), game, { say: toast });
  game.on('match', update);
  game.on('undo', () => {
    finished = 0; // taking back the last match of a cleared board starts the clock again
    update();
  });
  game.on('shuffle', update);
  game.on('key', update);
  game.on('treat', ({ treat }) => toast(`The jack-o'-lanterns left ${TREAT_NAMES[treat]}.`));
  game.on('turn', turned);
  game.on('win', won);
  game.on('stuck', stuck);
  $('pick').value = key;
  history.replaceState(null, '', `#${key}/${seed}`);
  try {
    localStorage.setItem('boneyard.board', key);
  } catch {}
  started = performance.now();
  finished = 0;
  woke = 0;
  hideCard();
  update();
}

function turned({ souls }) {
  woke = souls.length;
  const what = game.sideName === 'night' ? 'Midnight! The tiles turn over.' : 'Sunrise! The tiles turn back.';
  toast(woke ? `${what} ${woke} lost ${woke === 1 ? 'soul wakes' : 'souls wake'}: lost souls match each other.` : `${what} Not one lost soul.`);
}

function won() {
  finished = performance.now();
  update();
  const lost = woke ? ` ${woke} lost ${woke === 1 ? 'soul' : 'souls'} woke at midnight.` : '';
  showCard('The board is clear!', `In ${clock(seconds())}.${lost}`, [['Deal again', () => start(key)]]);
}

function stuck() {
  const actions = [['Shuffle', () => help('shuffle')], ['Undo', () => help('undo')]];
  if (game.treats.cat) actions.unshift(['Black cat', () => help('cat')]);
  if (game.treats.key) actions.push(['Skeleton key', () => help('key')]);
  showCard('No pairs left', 'Shuffle the tiles left, or take back a move.', actions);
}

// Everything the buttons and keys do.
function help(what) {
  if (!game || board.busy) return;
  hideCard();
  if (what === 'undo') game.undo();
  else if (what === 'hint' || what === 'candle') {
    const pair = what === 'hint' ? game.hint() : game.useCandle();
    if (pair) board.show(pair);
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

function update() {
  const g = game;
  $('left').innerHTML = `<b>${g.left}</b> tiles`;
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
  $('souls').title = g.turnAhead ? 'Lost souls if midnight struck now' : 'Lost souls that woke';
  $('souls').innerHTML = `👻 <b>${g.turnAhead ? g.soulsIfNow() : woke}</b>`;
  for (const t of ['candle', 'key', 'cat']) {
    $(t).querySelector('b').textContent = g.treats[t];
    $(t).disabled = !g.treats[t];
  }
  $('key').classList.toggle('on', board.keying);
  $('undo').disabled = !g.history.length;
  $('moon').disabled = !g.turnAhead;
  document.body.classList.toggle('night', g.sideName === 'night');
  tick();
}

function seconds() {
  const end = finished || performance.now();
  return (end - started) / 1000 + HINT_COST * game.hints + SHUFFLE_COST * game.shuffles;
}

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function tick() {
  if (game) $('time').textContent = `⏱ ${clock(seconds())}`;
}

let toastTimer = 0;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function showCard(title, text, actions) {
  $('card-title').textContent = title;
  $('card-text').textContent = text;
  const box = $('card-actions');
  box.replaceChildren();
  for (const [label, act] of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = act;
    box.append(b);
  }
  $('card').hidden = false;
  box.firstChild.focus();
}

function hideCard() {
  $('card').hidden = true;
}

// ---------------------------------------------------------- buttons and keys

$('pick').onchange = () => start($('pick').value);
$('new').onclick = () => start(key);
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
  if (e.target.closest && e.target.closest('select')) return;
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
  else if (e.key.toLowerCase() === 'n') start(key);
  else if (e.key === 'Escape') {
    board.setKeying(false);
    board.select(-1);
    hideCard();
    update();
  }
});
document.addEventListener('keyup', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    board.peek(false);
  }
});

new ResizeObserver(() => board && board.fit()).observe($('table'));
setInterval(tick, 1000);

// The board in the address, if any, else the last one played.
const [hashBoard, hashSeed] = location.hash.slice(1).split('/');
let last = FIRST;
try {
  last = localStorage.getItem('boneyard.board') || FIRST;
} catch {}
start(hashBoard || last, hashSeed ? Number(hashSeed) : undefined);
