import { isFree } from './layout.js';
import { MATCH, GHOST, LANTERN, LOST, dealPairs } from './tiles.js';
import { deal, redeal } from './deal.js';
import { soulsAt } from './midnight.js';
import { solve } from './solver.js';
import { seeded } from './rng.js';

export const TREATS = ['candle', 'key', 'cat'];

// One board in play: which tiles are left and which can be taken, undo,
// hints, shuffles, treats and the stroke of midnight. Nothing here touches
// the page; the board listens with on() for what happens: 'match', 'turn',
// 'treat', 'key', 'shuffle', 'undo', 'win' and 'stuck'.
//
// Options: the seed for the deal; faces, or sides for a board that turns
// over, to set the tiles instead of dealing them; turnAt, the number of
// matches after which the tiles turn over, and firstSide, 'day' or 'night',
// the side they start on; and whether ghosts float and jack-o'-lanterns
// leave treats.
export class Game {
  constructor(
    layout,
    { seed = 1, faces = null, sides = null, turnAt = Infinity, firstSide = 'day', ghostsFloat = true, treats = true } = {},
  ) {
    const pairs = layout.count / 2;
    const turns = turnAt !== Infinity;
    if (turns && !(turnAt >= 1 && turnAt < pairs)) throw new Error(`${layout.name} cannot turn over after ${turnAt} matches`);
    this.layout = layout;
    this.seed = seed;
    this.rules = { ghostsFloat, treats };
    this.turnAt = turnAt;
    this.r = seeded(seed);
    this.treatR = seeded(seed ^ 0x5bd1e995);
    if (faces || sides) {
      this.sides = (sides || [faces]).map((f) => Int16Array.from(f));
      if (this.sides.length !== (turns ? 2 : 1)) throw new Error(`${layout.name} needs ${turns ? 2 : 1} sides of faces`);
      for (const s of this.sides) if (s.length !== layout.count) throw new Error(`${layout.name} has ${layout.count} tiles, not ${s.length}`);
      this.plan = null;
    } else {
      const dealt = deal(layout, (turns ? [0, 1] : [0]).map(() => dealPairs(this.r, pairs)), this.r, { turnAt });
      if (!dealt) throw new Error(`${layout.name} cannot be dealt`);
      this.sides = dealt.sides;
      this.plan = dealt.order; // the order the deal was made in, which wins
    }
    this.sideNames = turns ? [firstSide, firstSide === 'day' ? 'night' : 'day'] : [firstSide];
    this.present = new Uint8Array(layout.count).fill(1);
    this.left = layout.count;
    this.matches = 0;
    this.unlocked = new Uint8Array(layout.count);
    this.history = [];
    this.treats = { candle: 0, key: 0, cat: 0 };
    this.lanterns = 0; // lantern pairs taken, as things stand
    this.lanternsBest = 0; // the most ever taken at once: only a new best earns a treat
    this.hints = 0;
    this.shuffles = 0;
    // The rest of a winning line, kept while the player follows it so that
    // hints are instant, and whether the board can be won, as last found.
    this.line = this.plan && this.plan.slice();
    this.outlook = this.plan ? 'win' : 'unknown';
    this.handlers = {};
  }

  on(type, fn) {
    (this.handlers[type] || (this.handlers[type] = [])).push(fn);
    return this;
  }

  emit(type, data) {
    for (const fn of this.handlers[type] || []) fn(data);
  }

  // Which side is up: 0 until the tiles turn over, 1 after.
  get side() {
    return this.matches >= this.turnAt ? 1 : 0;
  }

  get sideName() {
    return this.sideNames[this.side];
  }

  // The faces showing.
  get faces() {
    return this.sides[this.side];
  }

  face(i) {
    return this.faces[i];
  }

  get turnAhead() {
    return this.sides.length > 1 && this.side === 0;
  }

  // The matches still to make before the tiles turn over: Infinity on a
  // board that never turns over, and 0 once it has.
  get untilTurn() {
    return Math.max(0, this.turnAt - this.matches);
  }

  // The face a tile will turn over to, for peeking, while that is to come.
  nextFace(i) {
    return this.turnAhead ? this.sides[1][i] : null;
  }

  // How many lost souls would wake if the tiles turned over now.
  soulsIfNow() {
    return this.turnAhead ? soulsAt(this.layout, this.sides[1], this.present).length : 0;
  }

  get won() {
    return this.left === 0;
  }

  get stuck() {
    return this.left > 0 && this.pairs().length === 0;
  }

  // Free whatever lies on them: ghosts, when they float, and tiles opened
  // with a skeleton key. A tile floats only while its ghost face is up.
  loose(i, faces = this.faces) {
    return this.unlocked[i] === 1 || (this.rules.ghostsFloat && faces[i] === GHOST);
  }

  isFree(i) {
    return this.present[i] === 1 && (this.loose(i) || isFree(this.layout, this.present, i));
  }

  freeTiles() {
    const out = [];
    for (let i = 0; i < this.layout.count; i++) if (this.isFree(i)) out.push(i);
    return out;
  }

  canMatch(a, b) {
    return a !== b && this.isFree(a) && this.isFree(b) && MATCH[this.faces[a]] === MATCH[this.faces[b]];
  }

  // Every pair that could be taken now.
  pairs() {
    const free = this.freeTiles();
    const out = [];
    for (let p = 0; p < free.length; p++) {
      for (let q = p + 1; q < free.length; q++) {
        if (MATCH[this.faces[free[p]]] === MATCH[this.faces[free[q]]]) out.push([free[p], free[q]]);
      }
    }
    return out;
  }

  // Takes a pair. Returns { a, b, treat, turned, souls }: the treat the pair
  // left, if any; whether this match struck midnight, and if it did, the
  // tiles that woke as lost souls. Null if the pair cannot be taken.
  match(a, b) {
    if (!this.canMatch(a, b)) return null;
    const lantern = this.faces[a] === LANTERN;
    const entry = { type: 'match', a, b, lantern, line: this.line && this.line.slice(), outlook: this.outlook };
    this.present[a] = this.present[b] = 0;
    this.left -= 2;
    this.matches++;
    if (this.matches === this.turnAt) entry.souls = this.wake();
    this.history.push(entry);
    this.follow(a, b);
    let treat = null;
    if (lantern) {
      this.lanterns++;
      if (this.lanterns > this.lanternsBest) {
        this.lanternsBest = this.lanterns;
        if (this.rules.treats) {
          treat = this.treatR.pick(TREATS);
          this.treats[treat]++;
        }
      }
    }
    const turned = Boolean(entry.souls);
    const result = { a, b, treat, turned, souls: turned ? entry.souls.map(([t]) => t) : [] };
    this.emit('match', result);
    if (turned) this.emit('turn', result);
    if (treat) this.emit('treat', result);
    this.settle();
    return result;
  }

  // The tiles turn over. Returns the tiles that woke as lost souls, with the
  // faces they had, so that undo can put them back.
  wake() {
    const next = this.sides[1];
    return soulsAt(this.layout, next, this.present).map((t) => {
      const had = next[t];
      next[t] = LOST;
      return [t, had];
    });
  }

  // Takes back the last match or shuffle, and the winning line known before
  // it; a match that struck midnight turns the tiles back again. Treats stay:
  // undo never takes one back, and a turned key stays turned.
  undo() {
    const last = this.history.pop();
    if (!last) return null;
    if (last.type === 'match') {
      if (last.souls) for (const [t, had] of last.souls) this.sides[1][t] = had;
      this.present[last.a] = this.present[last.b] = 1;
      this.left += 2;
      this.matches--;
      if (last.lantern) this.lanterns--;
    } else {
      this.sides = last.sides;
    }
    this.line = last.line;
    this.outlook = last.outlook;
    this.emit('undo', last);
    return last;
  }

  // The pair to take next: the next step of a winning line when one is found
  // in time, or else the free pair that holds up the most. Null when nothing
  // can be taken. hint() is the one the player pays for. A board found lost
  // stays lost whatever is taken, so it is not searched again.
  suggest() {
    if (!this.line && this.outlook !== 'lost') {
      const { result, line } = solve(this.layout, this.position(), { budget: 20000 });
      this.outlook = result;
      this.line = result === 'win' ? line : null;
    }
    if (this.line && this.line.length) return this.line[0];
    const W = this.layout.weight;
    let best = null;
    for (const p of this.pairs()) if (!best || W[p[0]] + W[p[1]] > W[best[0]] + W[best[1]]) best = p;
    return best;
  }

  hint() {
    const pair = this.suggest();
    if (pair) this.hints++;
    return pair;
  }

  useCandle() {
    if (!this.treats.candle) return null;
    const pair = this.suggest();
    if (pair) this.treats.candle--;
    return pair;
  }

  // Opens a blocked tile with a skeleton key: it stays free until it is taken.
  useKey(i) {
    if (!this.treats.key || !this.present[i] || this.isFree(i)) return false;
    this.treats.key--;
    this.unlocked[i] = 1;
    if (this.outlook === 'lost') this.outlook = 'unknown'; // an opened tile may save it
    this.emit('key', i);
    return true;
  }

  // Deals the tiles still on the board onto the same places again, so the
  // board can still be won; a black cat does it for free. Before midnight
  // both sides are dealt again. False when no shuffle can help, as with two
  // tiles left one on top of the other.
  shuffle({ cat = false } = {}) {
    if ((cat && !this.treats.cat) || !this.left) return false;
    const dealt = redeal(this.layout, this.sides, this.side, this.turnAt - this.matches, this.present, this.r);
    if (!dealt) return false;
    this.history.push({ type: 'shuffle', sides: this.sides, line: this.line && this.line.slice(), outlook: this.outlook });
    this.sides = dealt.sides;
    this.line = dealt.order.slice();
    this.outlook = 'win';
    if (cat) this.treats.cat--;
    else this.shuffles++;
    this.emit('shuffle', { cat });
    return true;
  }

  // The board as the solver sees it.
  position() {
    return {
      faces: this.faces,
      present: this.present,
      unlocked: this.unlocked,
      ghostsFloat: this.rules.ghostsFloat,
      turn: this.turnAhead ? { after: this.turnAt - this.matches, faces: this.sides[1] } : null,
    };
  }

  // Keeps the winning line good after the player takes a and b. Taking tiles
  // only ever frees others, so a pair taken early from further down the line
  // leaves the rest of it good, unless that brings midnight on sooner. Two
  // tiles that the line pairs with others leave their two partners, which
  // may match each other: they go in where the later of the two pairs was, or
  // else the earlier. Either way the line is played through to be sure.
  follow(a, b) {
    const line = this.line;
    if (!line) return;
    const i = line.findIndex((p) => p[0] === a || p[1] === a);
    const j = line.findIndex((p) => p[0] === b || p[1] === b);
    if (i < 0 || j < 0) return this.forget();
    const rest = line.filter((p, k) => k !== i && k !== j);
    const tries = [rest];
    if (i !== j) {
      const c = line[i][0] === a ? line[i][1] : line[i][0];
      const d = line[j][0] === b ? line[j][1] : line[j][0];
      tries.length = 0;
      for (const at of [Math.max(i, j) - 1, Math.min(i, j)]) tries.push(rest.slice(0, at).concat([[c, d]], rest.slice(at)));
    }
    this.line = tries.find((tried) => this.holds(tried)) || null;
    if (!this.line) this.forget();
  }

  // Whether a line of pairs wins from here, the tiles turning over when they
  // should and lost souls waking as they would.
  holds(line) {
    const p = Uint8Array.from(this.present);
    const sides = this.sides.map((s) => Int16Array.from(s));
    let matches = this.matches;
    for (const [x, y] of line) {
      const faces = sides[matches >= this.turnAt ? 1 : 0];
      const free = (i) => p[i] === 1 && (this.loose(i, faces) || isFree(this.layout, p, i));
      if (!free(x) || !free(y) || MATCH[faces[x]] !== MATCH[faces[y]]) return false;
      p[x] = p[y] = 0;
      if (++matches === this.turnAt) for (const t of soulsAt(this.layout, sides[1], p)) sides[1][t] = LOST;
    }
    return p.every((v) => v === 0);
  }

  forget() {
    this.line = null;
    this.outlook = 'unknown';
  }

  // Tells the listeners when the board is won or nothing can be taken.
  settle() {
    if (this.won) this.emit('win', this);
    else if (this.stuck) this.emit('stuck', this);
  }
}
