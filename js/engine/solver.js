import { isFree, keyOf } from './layout.js';
import { KINDS, MATCH, GHOST, LOST } from './tiles.js';
import { soulsAt } from './midnight.js';
import { seeded } from './rng.js';

// Tuned on a few thousand turtle deals: how much more a pair counts for when
// it frees a tile whose match is already free, how widely ties are broken,
// and the length of the shortest go, in steps. Before midnight a pair that
// will match on the other side too counts for a little more, as taking it
// leaves no tile to wake as a lost soul.
const MATES = 6;
const NOISE = 10;
const UNIT = 500;
const BOTH = 3;

// Finds a way to win from a position: the pairs to take, in order.
//
// Once the faces are settled for good, when every tile left of one kind is
// free, it takes them all without searching: they can only go with each
// other, and taking a tile never pins another down, so taking them can never
// hurt. It also gives up on a position at once when even a generous
// reckoning cannot clear it (see hopeless below). Before midnight neither
// holds, since the tiles will turn over. Otherwise it tries first the pairs
// that free the most tiles, above all tiles whose match is already free.
//
// A search that wanders into a hopeless corner can take a long time to see
// it, so the solver searches in short goes, now and then a longer one,
// breaking ties another way each time and remembering the positions it has
// already proved lost.
//
// The position: faces, the faces showing; present; unlocked, the tiles
// opened with a skeleton key; ghostsFloat; and turn, while the tiles have
// still to turn over: { after, faces }, the matches until they do and the
// faces they turn over to.
//
// Returns { result, line, steps }, where result is 'win', 'lost', or
// 'unknown' when the budget of steps ran out first.
export function solve(L, position, { budget = 200000 } = {}) {
  const { faces, unlocked = null, ghostsFloat = false, turn = null } = position;
  const n = L.count;
  const K = KINDS.length;
  const present = Uint8Array.from(position.present);
  const next = turn && Int16Array.from(turn.faces); // lost souls are written in as they wake
  let cur = faces; // the faces showing at this point of the search
  let settled = !turn; // no turning over still to come
  let souls = ''; // which tiles woke as lost souls: part of every position after midnight
  const kindOf = (i) => MATCH[cur[i]];
  const loose = (i) => (unlocked !== null && unlocked[i] === 1) || (ghostsFloat && cur[i] === GHOST);
  const free = (i) => loose(i) || isFree(L, present, i);
  const r = seeded(7);
  const line = [];
  const dead = new Set();
  const freeNow = new Uint8Array(n);
  const seen = new Int32Array(n);
  const rest = new Uint8Array(n);
  let stamp = 0;
  let steps = 0;
  let limit = 0;
  let cut = false; // this go ran out of steps

  // Remembers a lost position, unless this go was cut short.
  const lost = (key) => {
    if (!cut) dead.add(key);
    return false;
  };

  // The tiles turn over: the next faces show from here on, with any tiles
  // left without a partner awake as lost souls, as the game wakes them.
  const wake = () => {
    const woke = soulsAt(L, next, present).map((t) => [t, next[t]]);
    for (const [t] of woke) next[t] = LOST;
    cur = next;
    settled = true;
    souls = `|${woke.map(([t]) => t).join(',')}`;
    return woke;
  };

  const sleep = (woke) => {
    for (const [t, had] of woke) next[t] = had;
    cur = faces;
    settled = false;
    souls = '';
  };

  // Plays on as if a kind with more than two tiles left could be taken a tile
  // at a time, and a kind down to its last two only as a pair. If even that
  // cannot clear the board, nothing can. Taking tiles only ever frees others,
  // so the order this plays in makes no difference.
  const hopeless = (tiles, left) => {
    rest.set(present);
    const queue = [];
    for (let i = 0; i < n; i++) if (rest[i]) queue.push(i);
    const take = (t) => {
      rest[t] = 0;
      left--;
      for (const near of [L.below[t], L.left[t], L.right[t]]) for (const u of near) if (rest[u]) queue.push(u);
    };
    const freeRest = (t) => loose(t) || isFree(L, rest, t);
    while (queue.length && left > 0) {
      const t = queue.pop();
      if (!rest[t] || !freeRest(t)) continue;
      const own = tiles[kindOf(t)];
      if (own.length !== 2) take(t);
      else {
        const mate = own[0] === t ? own[1] : own[0];
        if (rest[mate] && freeRest(mate)) {
          take(t);
          take(mate);
        }
      }
    }
    return left > 0;
  };

  // How much taking a and b would free: four for each tile that is not free
  // now and would be, and more again when that tile's match is already free.
  const frees = (a, b, open) => {
    stamp++;
    present[a] = present[b] = 0;
    let score = 0;
    for (const near of [L.below[a], L.below[b], L.left[a], L.right[a], L.left[b], L.right[b]]) {
      for (const t of near) {
        if (!present[t] || freeNow[t] || seen[t] === stamp) continue;
        seen[t] = stamp;
        if (free(t)) score += 4 + (open[kindOf(t)].some((m) => m !== a && m !== b) ? MATES : 0);
      }
    }
    present[a] = present[b] = 1;
    return score;
  };

  let turnLeft = -1; // the tiles left at the stroke of midnight

  const search = (left) => {
    if (left === 0) return true;
    if (++steps > limit) {
      cut = true;
      return false;
    }
    const key = keyOf(present) + souls;
    if (dead.has(key)) return false;

    const tiles = [];
    const open = [];
    for (let k = 0; k < K; k++) {
      tiles.push([]);
      open.push([]);
    }
    for (let i = 0; i < n; i++) {
      if (!present[i]) continue;
      const k = kindOf(i);
      tiles[k].push(i);
      freeNow[i] = free(i) ? 1 : 0;
      if (freeNow[i]) open[k].push(i);
    }

    if (settled) {
      if (hopeless(tiles, left)) return lost(key);
      const forced = open.findIndex((o, k) => o.length > 0 && o.length === tiles[k].length);
      if (forced >= 0) {
        const o = open[forced];
        for (const i of o) present[i] = 0;
        for (let m = 0; m < o.length; m += 2) line.push([o[m], o[m + 1]]);
        if (search(left - o.length)) return true;
        line.length -= o.length / 2;
        for (const i of o) present[i] = 1;
        return lost(key);
      }
    }

    const moves = [];
    for (const o of open) {
      for (let p = 0; p < o.length; p++) {
        for (let q = p + 1; q < o.length; q++) {
          const a = o[p];
          const b = o[q];
          const both = !settled && MATCH[next[a]] === MATCH[next[b]] ? BOTH : 0;
          moves.push({ a, b, score: frees(a, b, open) + both + L.z[a] + L.z[b] + r() * NOISE });
        }
      }
    }
    moves.sort((m1, m2) => m2.score - m1.score);
    for (const { a, b } of moves) {
      present[a] = present[b] = 0;
      line.push([a, b]);
      const turning = !settled && left - 2 === turnLeft;
      const woke = turning ? wake() : null;
      if (search(left - 2)) return true;
      if (turning) sleep(woke);
      line.pop();
      present[a] = present[b] = 1;
      if (cut) return false;
    }
    return lost(key);
  };

  let left = 0;
  for (let i = 0; i < n; i++) left += present[i];
  if (turn) turnLeft = left - 2 * turn.after;
  for (let go = 1; ; go++) {
    limit = Math.min(steps + UNIT * luby(go), budget);
    cut = false;
    line.length = 0;
    if (search(left)) return { result: 'win', line, steps };
    if (!cut) return { result: 'lost', line: [], steps };
    if (steps >= budget) return { result: 'unknown', line: [], steps };
  }
}

// The lengths of the goes, in units: 1, 1, 2, 1, 1, 2, 4, 1, 1, 2, ... Long
// goes come round now and then, but the search keeps going back to short ones.
function luby(i) {
  for (let k = 1; ; k++) {
    if (i === 2 ** k - 1) return 2 ** (k - 1);
    if (i < 2 ** k - 1) return luby(i - 2 ** (k - 1) + 1);
  }
}
