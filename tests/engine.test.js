import { test, check, equal, throws } from './run.js';
import { parseLayout, makeLayout, isFree } from '../js/engine/layout.js';
import { TURTLE, PUMPKIN } from '../js/engine/layouts.js';
import { FACES, SET, FACE, MATCH, LOST, dealPairs } from '../js/engine/tiles.js';
import { deal, redeal } from '../js/engine/deal.js';
import { soulsAt } from '../js/engine/midnight.js';
import { solve } from '../js/engine/solver.js';
import { Game, TREATS } from '../js/engine/game.js';
import { seeded } from '../js/engine/rng.js';
import { HOURS, gameOptions } from '../js/night.js';

const full = (L) => new Uint8Array(L.count).fill(1);
const facesOf = (...keys) => keys.map((key) => FACE[key]);
// How many of a face a full set has: none of the lost soul, which is never dealt.
const inSet = (f) => (f.group === 'soul' ? undefined : f.group === 'flower' || f.group === 'moon' ? 1 : 4);
const treatCount = (g) => g.treats.candle + g.treats.key + g.treats.cat;

// The tile at (x, y) on layer z, in half-tile units.
function at(L, x, y, z = 0) {
  for (let i = 0; i < L.count; i++) if (L.x[i] === x && L.y[i] === y && L.z[i] === z) return i;
  throw new Error(`no tile at (${x}, ${y}) on layer ${z}`);
}

// 1 for each tile that is present and free, 0 for the rest, as a string.
function freeString(L, present) {
  let s = '';
  for (let i = 0; i < L.count; i++) s += present[i] && isFree(L, present, i) ? '1' : '0';
  return s;
}

// Checks that a line of pairs can be played from a position, every pair free
// and matching when its turn comes, and that it clears the board.
function checkLine(L, faces, start, line, what) {
  const present = Uint8Array.from(start);
  for (const [a, b] of line) {
    check(present[a] && present[b], `${what}: a tile is taken twice`);
    check(isFree(L, present, a) && isFree(L, present, b), `${what}: a pair is not free when its turn comes`);
    check(MATCH[faces[a]] === MATCH[faces[b]], `${what}: a pair does not match`);
    present[a] = present[b] = 0;
  }
  check(present.every((p) => !p), `${what}: tiles are left over`);
}

const facesLeft = (g) => Array.from(g.faces).filter((f, i) => g.present[i]).sort((a, b) => a - b).join();

// ------------------------------------------------------------------ tiles

test('a set has 42 faces in 36 kinds, four of each but one of each flower and moon', () => {
  equal(FACES.filter((f) => f.group !== 'soul').length, 42, 'faces');
  equal(SET.length, 36, 'kinds');
  const count = new Map();
  for (const [a, b] of dealPairs(seeded(1), 72)) {
    check(MATCH[a] === MATCH[b], `${FACES[a].name} and ${FACES[b].name} are dealt as a pair`);
    for (const f of [a, b]) count.set(f, (count.get(f) || 0) + 1);
  }
  for (const f of FACES) equal(count.get(f.id), inSet(f), f.name);
});

test('a small board deals one pair of every kind before any kind twice', () => {
  const kinds = dealPairs(seeded(2), 36).map(([a]) => MATCH[a]);
  equal(new Set(kinds).size, 36, 'kinds');
});

// ---------------------------------------------------------------- layouts

test('the turtle has 144 tiles on layers of 87, 36, 16, 4 and 1, 15 tiles across', () => {
  equal(TURTLE.count, 144, 'tiles');
  const layers = [0, 0, 0, 0, 0];
  for (const z of TURTLE.z) layers[z]++;
  equal(layers.join(), '87,36,16,4,1', 'layers');
  equal(TURTLE.width / 2, 15, 'tiles across');
  equal(TURTLE.height / 2, 8, 'tiles down');
});

test('the pumpkin has 82 tiles, nine across, and its deals can be won, by day or through midnight', () => {
  equal(PUMPKIN.count, 82, 'tiles');
  equal(PUMPKIN.width / 2, 9, 'tiles across');
  for (let seed = 1; seed <= 200; seed++) {
    const r = seeded(seed);
    const day = deal(PUMPKIN, [dealPairs(r, 41)], r);
    checkLine(PUMPKIN, day.sides[0], full(PUMPKIN), day.order, `seed ${seed}`);
    const night = deal(PUMPKIN, [dealPairs(r, 41), dealPairs(r, 41)], r, { turnAt: 20 });
    equal(checkTurnLine(PUMPKIN, night.sides, 20, night.order, `seed ${seed} through midnight`), 0, `seed ${seed}: lost souls`);
  }
});

test('the Long Night has thirteen boards, none more than nine tiles across', () => {
  equal(HOURS.length, 13, 'hours');
  for (const h of HOURS) check(h.layout.width / 2 <= 9, `${h.layout.name} is ${h.layout.width / 2} tiles across`);
});

test("every hour of the Long Night deals boards that can be won by its own rules, through midnight with no lost souls", () => {
  HOURS.forEach((hour, i) => {
    const options = gameOptions(i);
    for (let seed = 1; seed <= 30; seed++) {
      const g = new Game(hour.layout, { seed, ...options });
      let souls = null;
      for (const [a, b] of g.plan) {
        const result = g.match(a, b);
        check(result, `${hour.name}, seed ${seed}: a pair from the deal's own order cannot be taken`);
        if (result.turned) souls = result.souls.length;
      }
      check(g.won, `${hour.name}, seed ${seed}: not cleared`);
      if (options.turnAt) equal(souls, 0, `${hour.name}, seed ${seed}: lost souls`);
    }
  });
  return `${HOURS.length} hours, 30 deals each`;
});

test('a layout refuses overlapping tiles, floating tiles and odd numbers', () => {
  throws(() => makeLayout('overlap', [[0, 0, 0], [1, 0, 0]]), /overlapping/);
  throws(() => makeLayout('floating', [[0, 0, 0], [4, 0, 1]]), /nothing under/);
  throws(() => makeLayout('odd', [[0, 0, 0]]), /odd/);
});

// ------------------------------------------------------------- free tiles

test('in a row, only the ends are free', () => {
  const L = parseLayout('row', ['####']);
  const present = full(L);
  equal(freeString(L, present), '1001', 'free');
  present[at(L, 0, 0)] = 0;
  check(isFree(L, present, at(L, 2, 0)), 'the second tile is free once the first is gone');
});

test('a tile with another on it is not free', () => {
  const L = parseLayout('stack', ['##', '##']);
  const present = full(L);
  check(!isFree(L, present, at(L, 0, 0)) && !isFree(L, present, at(L, 2, 0)), 'the lower tiles are covered');
  check(isFree(L, present, at(L, 0, 0, 1)) && isFree(L, present, at(L, 2, 0, 1)), 'the upper tiles are free');
});

test('a tile across a join covers both tiles under it', () => {
  const L = parseLayout('join', ['####', '>.>.']);
  const present = full(L);
  equal(freeString(L, present), '000011', 'free');
  present[at(L, 1, 0, 1)] = 0;
  check(isFree(L, present, at(L, 0, 0)), 'the end tile under it is uncovered');
  check(!isFree(L, present, at(L, 2, 0)), 'the next tile is still hemmed in');
});

test('a tile half a row down sits beside the tiles of both rows', () => {
  const L = parseLayout('step', [
    `
    .##.#
    v##..
    .##..
    `,
  ]);
  const present = full(L);
  const end = at(L, 0, 3);
  check(isFree(L, present, end), 'the shifted tile is free');
  check(!isFree(L, present, at(L, 2, 2)) && !isFree(L, present, at(L, 2, 4)), 'it hems in the tiles of both rows beside it');
  check(isFree(L, present, at(L, 2, 0)), 'but not the row above those');
  present[end] = 0;
  check(isFree(L, present, at(L, 2, 2)) && isFree(L, present, at(L, 2, 4)), 'taking it frees them');
});

test('the turtle starts with 35 free tiles', () => {
  equal(freeString(TURTLE, full(TURTLE)).split('1').length - 1, 35, 'free tiles');
});

// ---------------------------------------------------------------- dealing

test('the same seed deals the same board', () => {
  const a = new Game(TURTLE, { seed: 42 }).faces.join();
  equal(new Game(TURTLE, { seed: 42 }).faces.join(), a, 'seed 42 twice');
  check(new Game(TURTLE, { seed: 43 }).faces.join() !== a, 'seed 43 deals another board');
});

test('1,000 turtle deals each use the whole set and can be won in the order they were dealt', () => {
  for (let seed = 1; seed <= 1000; seed++) {
    const r = seeded(seed);
    const dealt = deal(TURTLE, [dealPairs(r, 72)], r);
    check(dealt, `seed ${seed} could not be dealt`);
    const count = new Map();
    for (const f of dealt.sides[0]) count.set(f, (count.get(f) || 0) + 1);
    for (const f of FACES) equal(count.get(f.id), inSet(f), `seed ${seed}: ${f.name}`);
    checkLine(TURTLE, dealt.sides[0], full(TURTLE), dealt.order, `seed ${seed}`);
  }
});

// ----------------------------------------------------------------- solver

test('the solver wins 100 turtle deals by itself', () => {
  let most = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const g = new Game(TURTLE, { seed });
    const { result, line, steps } = solve(TURTLE, { faces: g.faces, present: g.present });
    equal(result, 'win', `seed ${seed}`);
    checkLine(TURTLE, g.faces, g.present, line, `seed ${seed}`);
    most = Math.max(most, steps);
  }
  return `${most} steps at most`;
});

test('the solver knows a lost position', () => {
  const L = parseLayout('tower', ['#', '#']);
  equal(solve(L, { faces: facesOf('eyes-1', 'eyes-1'), present: full(L) }).result, 'lost', 'two alike, one on the other');
});

// ------------------------------------------------------------------- game

test('a game takes free pairs that match, and refuses the rest', () => {
  const L = parseLayout('pairs', ['##.##']);
  const g = new Game(L, { faces: facesOf('eyes-1', 'eyes-2', 'eyes-1', 'eyes-2') });
  let won = false;
  g.on('win', () => (won = true));
  equal(g.match(0, 1), null, 'two faces that differ');
  check(g.match(0, 2), 'two alike');
  check(g.match(1, 3), 'the other two alike');
  check(g.won && won, 'the board is clear, and the game says so');
  const row = parseLayout('row', ['####']);
  const h = new Game(row, { faces: facesOf('eyes-1', 'eyes-2', 'eyes-2', 'eyes-1') });
  equal(h.match(1, 2), null, 'two alike but hemmed in');
});

test('undo puts the board back exactly, shuffles too', () => {
  const g = new Game(TURTLE, { seed: 7 });
  const start = g.faces.join();
  for (let n = 0; n < 20; n++) {
    if (n === 10) check(g.shuffle(), 'shuffled');
    check(g.match(...g.suggest()), `move ${n}`);
  }
  while (g.undo());
  equal(g.left, 144, 'tiles back');
  check(g.present.every((p) => p === 1), 'every tile present');
  equal(g.faces.join(), start, 'faces back where they were');
});

test('following the hints wins', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const g = new Game(TURTLE, { seed });
    while (!g.won) {
      const pair = g.hint();
      check(pair && g.match(...pair), `seed ${seed}: the hint with ${g.left} tiles left`);
    }
    equal(g.hints, 72, `seed ${seed}: hints counted`);
  }
});

test('after a move of your own, the hints find a new way to win', () => {
  let tried = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const g = new Game(TURTLE, { seed });
    const [x, y] = g.line[0];
    const own = g.pairs().find(([a, b]) => !(a === x && b === y) && !(a === y && b === x));
    if (!own) continue;
    g.match(...own);
    g.suggest();
    if (g.outlook !== 'win') continue; // that move happened to lose the board
    tried++;
    while (!g.won) {
      const pair = g.hint();
      check(pair && g.match(...pair), `seed ${seed}: the hint with ${g.left} tiles left`);
    }
  }
  check(tried > 0, 'some board stayed winnable');
  return `${tried} of 10 boards`;
});

test('taking a pair early from further down the winning line keeps the line', () => {
  let kept = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const g = new Game(TURTLE, { seed });
    const early = g.line.slice(1).find((p) => g.canMatch(...p));
    if (!early) continue;
    g.match(...early);
    check(g.line && g.line.length === 71 && g.holds(g.line), `seed ${seed}: the line is kept`);
    kept++;
  }
  check(kept > 0, 'some board had a pair free further down its line');
  return `${kept} of 20 boards`;
});

test('two tiles the line pairs with others leave a line that is mended, or found again', () => {
  let mended = 0;
  let found = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const g = new Game(TURTLE, { seed });
    const where = (t) => g.line.findIndex((p) => p.includes(t));
    const cross = g.pairs().find(([a, b]) => where(a) !== where(b));
    if (!cross) continue;
    g.match(...cross);
    if (g.line) {
      check(g.holds(g.line), `seed ${seed}: the mended line wins`);
      mended++;
    } else if (g.suggest() && g.outlook === 'win') found++;
  }
  check(mended > 0, 'some line was mended');
  return `${mended} mended, ${found} found again`;
});

test('undo brings back the winning line from before the move', () => {
  const g = new Game(TURTLE, { seed: 11 });
  g.match(...g.suggest());
  const before = JSON.stringify(g.line);
  const own = g.pairs().find(([a, b]) => !g.line[0].includes(a) || !g.line[0].includes(b));
  g.match(...own);
  g.undo();
  equal(JSON.stringify(g.line), before, 'the line');
  equal(g.outlook, 'win', 'the outlook');
});

test('a board found lost says so, and a skeleton key can give it hope again', () => {
  // Eyes 1, 2, 1, 2 in a row hem each other in for good; the pair of threes beside them can still be taken.
  const L = parseLayout('lost', ['####.##']);
  const g = new Game(L, { faces: facesOf('eyes-1', 'eyes-2', 'eyes-1', 'eyes-2', 'eyes-3', 'eyes-3') });
  const pair = g.suggest();
  equal(g.outlook, 'lost', 'outlook');
  check(pair && g.canMatch(...pair), 'a pair is still offered');
  g.treats.key = 1;
  check(g.useKey(1), 'a key turned');
  equal(g.outlook, 'unknown', 'outlook once the key is turned');
  g.suggest();
  equal(g.outlook, 'win', 'the key saves it');
});

test('a shuffle keeps the same tiles in the same places, and the board can still be won', () => {
  const g = new Game(TURTLE, { seed: 3 });
  for (let n = 0; n < 12; n++) g.match(...g.suggest());
  const before = g.faces.join();
  const left = facesLeft(g);
  check(g.shuffle(), 'shuffled');
  equal(facesLeft(g), left, 'the same faces are left');
  equal(g.left, 120, 'tiles left');
  check(g.faces.join() !== before, 'the tiles moved');
  checkLine(TURTLE, g.faces, g.present, g.line, 'after the shuffle');
  g.undo();
  equal(g.faces.join(), before, 'undo puts them back');
});

test('the safe shuffle deals 200 half-played boards so they can be won', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const g = new Game(TURTLE, { seed });
    for (let n = 0; n < seed % 60; n++) g.match(...g.suggest());
    const r = seeded(seed);
    const dealt = redeal(TURTLE, g.sides, g.side, Infinity, g.present, r);
    check(dealt, `seed ${seed}: no shuffle`);
    checkLine(TURTLE, dealt.sides[0], g.present, dealt.order, `seed ${seed}`);
  }
});

test('no shuffle can save two tiles left one on top of the other', () => {
  const L = parseLayout('tower', ['#', '#']);
  const g = new Game(L, { faces: facesOf('eyes-1', 'eyes-1') });
  check(g.stuck, 'stuck');
  equal(g.shuffle(), false, 'shuffle');
  equal(g.hint(), null, 'hint');
  equal(g.hints, 0, 'an empty hint costs nothing');
});

// ----------------------------------------------------------------- twists

test('ghosts float: a ghost can be taken from under another tile', () => {
  const L = parseLayout('stack', ['##', '##']);
  const g = new Game(L, { faces: facesOf('ghost', 'ghost', 'eyes-1', 'eyes-1') });
  check(g.match(0, 1), 'the ghosts underneath');
  check(g.match(2, 3), 'the tiles that lay on them');
  const tower = parseLayout('tower', ['#', '#']);
  const position = { faces: facesOf('ghost', 'ghost'), present: full(tower), ghostsFloat: true };
  equal(solve(tower, position).result, 'win', 'the solver lets ghosts float');
  const h = new Game(L, { faces: facesOf('ghost', 'ghost', 'eyes-1', 'eyes-1'), ghostsFloat: false });
  equal(h.match(0, 1), null, 'ghosts are held down on a board where they do not float');
});

test("a pair of jack-o'-lanterns leaves one treat, even after an undo", () => {
  const L = parseLayout('pairs', ['##.##']);
  const g = new Game(L, { faces: facesOf('lantern', 'lantern', 'eyes-1', 'eyes-1') });
  check(TREATS.includes(g.match(0, 1).treat), 'a treat');
  g.undo();
  equal(treatCount(g), 1, 'undo keeps the treat');
  equal(g.match(0, 1).treat, null, 'the same pair again');
  equal(treatCount(g), 1, 'still one treat');
  const h = new Game(L, { faces: facesOf('lantern', 'lantern', 'eyes-1', 'eyes-1'), treats: false });
  equal(h.match(0, 1).treat, null, 'no treats on a board without them');
});

test('a skeleton key frees one blocked tile', () => {
  const L = parseLayout('row', ['####']);
  const g = new Game(L, { faces: facesOf('eyes-1', 'eyes-2', 'eyes-1', 'eyes-2') });
  check(g.stuck, 'stuck to begin with');
  equal(g.useKey(1), false, 'no key yet');
  g.treats.key = 1;
  equal(g.useKey(0), false, 'a key is not wasted on a free tile');
  check(g.useKey(1), 'the key opens the second tile');
  equal(g.treats.key, 0, 'the key is used');
  check(g.match(1, 3), 'the opened tile');
  check(g.match(0, 2), 'the rest');
});

test('a candle shows a match and is used up', () => {
  const g = new Game(TURTLE, { seed: 5 });
  g.treats.candle = 1;
  const pair = g.useCandle();
  check(pair && g.canMatch(...pair), 'a pair that can be taken');
  equal(g.treats.candle, 0, 'the candle is used');
  equal(g.useCandle(), null, 'no candle left');
  equal(g.hints, 0, 'a candle is not a paid hint');
});

test('a black cat shuffles for free', () => {
  const g = new Game(TURTLE, { seed: 6 });
  g.treats.cat = 1;
  check(g.shuffle({ cat: true }), 'the cat shuffles');
  equal(g.treats.cat, 0, 'the cat is used');
  equal(g.shuffles, 0, 'no paid shuffle counted');
  equal(g.shuffle({ cat: true }), false, 'no cat left');
  check(g.shuffle(), 'an ordinary shuffle');
  equal(g.shuffles, 1, 'paid shuffle counted');
});

// --------------------------------------------------------------- midnight

// Plays a line through the stroke of midnight: before it pairs must match on
// the first side, and after it on the second, with lost souls woken as the
// game wakes them. Returns how many woke.
function checkTurnLine(L, sides, turnAt, line, what) {
  const present = full(L);
  const second = Int16Array.from(sides[1]);
  let souls = 0;
  line.forEach(([a, b], k) => {
    const faces = k < turnAt ? sides[0] : second;
    check(present[a] && present[b], `${what}: a tile is taken twice`);
    check(isFree(L, present, a) && isFree(L, present, b), `${what}: a pair is not free when its turn comes`);
    check(MATCH[faces[a]] === MATCH[faces[b]], `${what}: a pair does not match ${k < turnAt ? 'before' : 'after'} midnight`);
    present[a] = present[b] = 0;
    if (k + 1 === turnAt) {
      const woke = soulsAt(L, second, present);
      for (const t of woke) second[t] = LOST;
      souls = woke.length;
    }
  });
  check(present.every((p) => !p), `${what}: tiles are left over`);
  return souls;
}

test('1,000 Midnight deals: each side a full set, and the order they were dealt in wins through midnight', () => {
  for (let seed = 1; seed <= 1000; seed++) {
    const r = seeded(seed);
    const turnAt = 6 + (seed % 60);
    const dealt = deal(TURTLE, [dealPairs(r, 72), dealPairs(r, 72)], r, { turnAt });
    check(dealt, `seed ${seed} could not be dealt`);
    for (const side of dealt.sides) {
      const count = new Map();
      for (const f of side) count.set(f, (count.get(f) || 0) + 1);
      for (const f of FACES) equal(count.get(f.id), inSet(f), `seed ${seed}: ${f.name}`);
    }
    equal(checkTurnLine(TURTLE, dealt.sides, turnAt, dealt.order, `seed ${seed}`), 0, `seed ${seed}: lost souls`);
    for (const [a, b] of dealt.order.slice(0, turnAt)) {
      check(MATCH[dealt.sides[1][a]] === MATCH[dealt.sides[1][b]], `seed ${seed}: a pair taken before midnight does not match by night`);
    }
  }
});

test('a player who takes pairs that match on both sides before midnight meets no lost souls', () => {
  let none = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const g = new Game(TURTLE, { seed, turnAt: 36 });
    const r = seeded(seed);
    for (;;) {
      const pairs = g.pairs();
      const both = pairs.filter(([a, b]) => MATCH[g.nextFace(a)] === MATCH[g.nextFace(b)]);
      const result = g.match(...r.pick(both.length ? both : pairs));
      if (result.turned) {
        if (result.souls.length === 0) none++;
        break;
      }
    }
  }
  check(none >= 8, `${none} of 10 boards met none`);
  return `${none} of 10 boards met none`;
});

test('the tiles turn over after the set number of matches, and undo turns them back', () => {
  const g = new Game(TURTLE, { seed: 1, turnAt: 3 });
  equal(g.sideName, 'day', 'the side to begin with');
  equal(g.untilTurn, 3, 'matches until midnight');
  equal(g.nextFace(0), g.sides[1][0], 'a peek shows the night face');
  for (let n = 1; n <= 2; n++) equal(g.match(...g.suggest()).turned, false, `match ${n}`);
  const third = g.match(...g.suggest());
  check(third.turned, 'the third match strikes midnight');
  equal(third.souls.length, 0, 'following the deal wakes no lost souls');
  equal(g.sideName, 'night', 'the side after');
  check(g.faces === g.sides[1], 'the night faces show');
  equal(g.nextFace(0), null, 'nothing left to peek at');
  g.undo();
  equal(g.sideName, 'day', 'undo turns the tiles back');
  equal(g.untilTurn, 1, 'one match to go');
});

// Two rows of two: by day each row is a pair.
const rows = () => parseLayout('rows', ['##.##']);
const dayRows = () => facesOf('eyes-1', 'eyes-1', 'eyes-2', 'eyes-2');

test('straying before midnight wakes lost souls, and lost souls match each other', () => {
  // By night each column is a pair, so taking a row by day splits both.
  const g = new Game(rows(), { sides: [dayRows(), facesOf('vampire', 'werewolf', 'vampire', 'werewolf')], turnAt: 1 });
  equal(g.soulsIfNow(), 0, 'no lost souls if midnight struck now');
  const result = g.match(0, 1);
  check(result.turned, 'midnight');
  equal(result.souls.join(), '2,3', 'the vampire and the werewolf left alone wake as lost souls');
  check(g.face(2) === LOST && g.face(3) === LOST, "they show a lost soul's face");
  check(g.match(2, 3), 'lost souls match each other');
  check(g.won, 'the board is clear');
});

test('pairs that match on both sides wake no lost souls', () => {
  const g = new Game(rows(), { sides: [dayRows(), facesOf('vampire', 'vampire', 'werewolf', 'werewolf')], turnAt: 1 });
  equal(g.match(0, 1).souls.length, 0, 'lost souls');
  check(g.match(2, 3), 'the werewolves');
});

test('undo across midnight puts back the faces the lost souls had', () => {
  const night = facesOf('vampire', 'werewolf', 'vampire', 'werewolf');
  const g = new Game(rows(), { sides: [dayRows(), night], turnAt: 1 });
  g.match(0, 1);
  g.undo();
  equal(g.sideName, 'day', 'the side');
  equal(g.sides[1].join(), night.join(), 'the night faces, as they were');
  equal(g.soulsIfNow(), 0, 'no lost souls if midnight struck now');
});

test('which tile wakes as a lost soul is settled the same way every time', () => {
  // Three vampires, one lying on another, and a werewolf. Waking the vampire on
  // top leaves the other two free to be taken together; the werewolf has no partner.
  const L = parseLayout('souls', ['#.##', '#...']);
  const night = facesOf('vampire', 'vampire', 'werewolf', 'vampire');
  const souls = soulsAt(L, night, full(L)).sort((a, b) => a - b);
  equal(souls.join(), [at(L, 6, 0), at(L, 0, 0, 1)].sort((a, b) => a - b).join(), 'the werewolf and the vampire on top');
});

test('ghosts float only while their ghost face shows', () => {
  // By day two ghosts lie under a pair of twos; by night the ghosts are threes.
  const L = parseLayout('ghosts', ['##.##', '##...']);
  const g = new Game(L, {
    sides: [
      facesOf('ghost', 'ghost', 'eyes-1', 'eyes-1', 'eyes-2', 'eyes-2'),
      facesOf('eyes-3', 'eyes-3', 'eyes-4', 'eyes-4', 'eyes-5', 'eyes-5'),
    ],
    turnAt: 1,
  });
  check(g.isFree(0), 'by day the ghost floats');
  check(g.match(2, 3).turned, 'midnight');
  check(!g.isFree(0), 'by night it is held down');
  check(g.match(4, 5), 'the pair on top');
  check(g.match(0, 1), 'the threes underneath');
});

test('a shuffle before midnight deals both sides again, and the board can still be won through midnight', () => {
  const g = new Game(TURTLE, { seed: 4, turnAt: 36 });
  for (let n = 0; n < 10; n++) g.match(...g.suggest());
  const sides = g.sides.map((s) => s.join()).join('/');
  const dayLeft = facesLeft(g);
  check(g.shuffle(), 'shuffled');
  equal(facesLeft(g), dayLeft, 'the same day faces are left');
  check(g.holds(g.line), 'the new line wins');
  g.undo();
  equal(g.sides.map((s) => s.join()).join('/'), sides, 'undo puts both sides back');
  check(g.shuffle(), 'shuffled again');
  let souls = null;
  while (!g.won) {
    const result = g.match(...g.hint());
    if (result.turned) souls = result.souls.length;
  }
  equal(souls, 0, 'following the line wakes no lost souls');
});

test('a shuffle after midnight deals the night side again', () => {
  const g = new Game(TURTLE, { seed: 5, turnAt: 20 });
  for (let n = 0; n < 25; n++) g.match(...g.suggest());
  equal(g.sideName, 'night', 'past midnight');
  const nightLeft = facesLeft(g);
  check(g.shuffle(), 'shuffled');
  equal(facesLeft(g), nightLeft, 'the same night faces are left');
  while (!g.won) check(g.match(...g.hint()), `the hint with ${g.left} tiles left`);
});

test('a board that starts on its night side turns to day at sunrise', () => {
  const g = new Game(TURTLE, { seed: 6, turnAt: 30, firstSide: 'night' });
  equal(g.sideName, 'night', 'the side to begin with');
  for (let n = 0; n < 30; n++) g.match(...g.suggest());
  equal(g.sideName, 'day', 'the side after sunrise');
  while (!g.won) check(g.match(...g.suggest()), `the line with ${g.left} tiles left`);
});

test('following the hints wins through midnight, waking no lost souls', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const g = new Game(TURTLE, { seed, turnAt: 36 });
    let souls = null;
    while (!g.won) {
      const result = g.match(...g.hint());
      if (result.turned) souls = result.souls.length;
    }
    equal(souls, 0, `seed ${seed}: lost souls`);
  }
});

test('after a move of your own before midnight, the hints still find a way through', () => {
  let tried = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const g = new Game(TURTLE, { seed, turnAt: 36 });
    const [x, y] = g.line[0];
    const own = g.pairs().find(([a, b]) => !(a === x && b === y) && !(a === y && b === x));
    g.match(...own);
    g.suggest();
    if (g.outlook !== 'win') continue; // that move happened to lose the board
    tried++;
    while (!g.won) {
      const pair = g.hint();
      check(pair && g.match(...pair), `seed ${seed}: the hint with ${g.left} tiles left`);
    }
  }
  check(tried > 0, 'some board stayed winnable');
  return `${tried} of 10 boards`;
});

test('the solver finds a way through midnight from boards that strayed', () => {
  const tally = { win: 0, lost: 0, unknown: 0 };
  let most = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const g = new Game(TURTLE, { seed, turnAt: 36 });
    const r = seeded(seed);
    for (let n = 0; n < 3; n++) g.match(...r.pick(g.pairs()));
    const { result, line, steps } = solve(TURTLE, g.position());
    tally[result]++;
    most = Math.max(most, steps);
    if (result === 'win') check(g.holds(line), `seed ${seed}: the solver's line wins`);
  }
  check(tally.win > 0, 'some boards won');
  return `${tally.win} won, ${tally.lost} lost, ${tally.unknown} unknown; ${most} steps at most`;
});
