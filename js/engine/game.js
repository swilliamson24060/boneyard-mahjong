import { isFree } from './layout.js';
import { MATCH, GHOST, LANTERN, dealPairs } from './tiles.js';
import { deal, redeal } from './deal.js';
import { solve } from './solver.js';
import { seeded } from './rng.js';

export const TREATS = ['candle', 'key', 'cat'];

// One board in play: which tiles are left and which can be taken, undo,
// hints, shuffles and treats. Nothing here touches the page; the board
// listens with on() for what happens: 'match', 'treat', 'key', 'shuffle',
// 'undo', 'win' and 'stuck'.
//
// Options: the seed for the deal; faces, to set the tiles instead of dealing
// them; and whether ghosts float and jack-o'-lanterns leave treats.
export class Game {
  constructor(layout, { seed = 1, faces = null, ghostsFloat = true, treats = true } = {}) {
    this.layout = layout;
    this.seed = seed;
    this.rules = { ghostsFloat, treats };
    this.r = seeded(seed);
    this.treatR = seeded(seed ^ 0x5bd1e995);
    if (faces) {
      if (faces.length !== layout.count) throw new Error(`${layout.name} has ${layout.count} tiles, not ${faces.length}`);
      this.faces = Int16Array.from(faces);
      this.plan = null;
    } else {
      const dealt = deal(layout, dealPairs(this.r, layout.count / 2), this.r);
      if (!dealt) throw new Error(`${layout.name} cannot be dealt`);
      this.faces = dealt.faces;
      this.plan = dealt.order; // the order the deal was made in, which wins
    }
    this.present = new Uint8Array(layout.count).fill(1);
    this.left = layout.count;
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

  face(i) {
    return this.faces[i];
  }

  get won() {
    return this.left === 0;
  }

  get stuck() {
    return this.left > 0 && this.pairs().length === 0;
  }

  // Free whatever lies on them: ghosts, when they float, and tiles opened
  // with a skeleton key.
  loose(i) {
    return this.unlocked[i] === 1 || (this.rules.ghostsFloat && this.faces[i] === GHOST);
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

  // Takes a pair. Returns { a, b, treat }, treat being the one the pair left,
  // if any; or null if the pair cannot be taken.
  match(a, b) {
    if (!this.canMatch(a, b)) return null;
    this.present[a] = this.present[b] = 0;
    this.left -= 2;
    const lantern = this.faces[a] === LANTERN;
    this.history.push({ type: 'match', a, b, lantern, line: this.line && this.line.slice(), outlook: this.outlook });
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
    const result = { a, b, treat };
    this.emit('match', result);
    if (treat) this.emit('treat', result);
    this.settle();
    return result;
  }

  // Takes back the last match or shuffle, and the winning line known before
  // it. Treats stay: undo never takes one back, and a turned key stays turned.
  undo() {
    const last = this.history.pop();
    if (!last) return null;
    if (last.type === 'match') {
      this.present[last.a] = this.present[last.b] = 1;
      this.left += 2;
      if (last.lantern) this.lanterns--;
    } else {
      this.faces = last.faces;
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
      const { result, line } = solve(this.layout, this.faces, this.present, { loose: this.looseTiles(), budget: 20000 });
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
  // board can still be won; a black cat does it for free. False when no
  // shuffle can help, as with two tiles left one on top of the other.
  shuffle({ cat = false } = {}) {
    if ((cat && !this.treats.cat) || !this.left) return false;
    const dealt = redeal(this.layout, this.faces, this.present, this.r);
    if (!dealt) return false;
    this.history.push({ type: 'shuffle', faces: this.faces, line: this.line && this.line.slice(), outlook: this.outlook });
    this.faces = Int16Array.from(this.faces, (f, i) => (this.present[i] ? dealt.faces[i] : f));
    this.line = dealt.order.slice();
    this.outlook = 'win';
    if (cat) this.treats.cat--;
    else this.shuffles++;
    this.emit('shuffle', { cat });
    return true;
  }

  // Keeps the winning line good after the player takes a and b. Taking tiles
  // only ever frees others, so a pair taken early from further down the line
  // leaves the rest of it good. Two tiles that the line pairs with others
  // leave their two partners, which match each other: they go in where the
  // later of the two pairs was, or else the earlier, if the line still wins.
  follow(a, b) {
    const line = this.line;
    if (!line) return;
    const i = line.findIndex((p) => p[0] === a || p[1] === a);
    const j = line.findIndex((p) => p[0] === b || p[1] === b);
    if (i < 0 || j < 0) return this.forget();
    if (i === j) {
      line.splice(i, 1);
      return;
    }
    const c = line[i][0] === a ? line[i][1] : line[i][0];
    const d = line[j][0] === b ? line[j][1] : line[j][0];
    const rest = line.filter((p, k) => k !== i && k !== j);
    for (const at of [Math.max(i, j) - 1, Math.min(i, j)]) {
      const tried = rest.slice(0, at).concat([[c, d]], rest.slice(at));
      if (this.holds(tried)) {
        this.line = tried;
        return;
      }
    }
    this.forget();
  }

  // Whether a line of pairs wins from here.
  holds(line) {
    const p = Uint8Array.from(this.present);
    const free = (i) => p[i] === 1 && (this.loose(i) || isFree(this.layout, p, i));
    for (const [x, y] of line) {
      if (!free(x) || !free(y) || MATCH[this.faces[x]] !== MATCH[this.faces[y]]) return false;
      p[x] = p[y] = 0;
    }
    return p.every((v) => v === 0);
  }

  forget() {
    this.line = null;
    this.outlook = 'unknown';
  }

  looseTiles() {
    return Uint8Array.from(this.faces, (f, i) => (this.loose(i) ? 1 : 0));
  }

  // Tells the listeners when the board is won or nothing can be taken.
  settle() {
    if (this.won) this.emit('win', this);
    else if (this.stuck) this.emit('stuck', this);
  }
}
