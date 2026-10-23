import { freeTiles, keyOf } from './layout.js';
import { MATCH } from './tiles.js';

// Dealing so that every board can be won. A deal first plays the board with
// blank tiles, taking any two free tiles at a time, and then gives each pair
// it took one pair of faces: taking the pairs in the same order wins.
//
// A board with two sides turns over after turnAt matches. The pairs taken
// before the turn match on both sides, and the pairs taken after it match on
// the second side, their first faces paired at random, so each side on its
// own is a full, normal set. A player who peeks and takes pairs that match on
// both sides before the turn meets no lost souls; the rest is a new board,
// paired up afresh.
//
// sides holds the pairs of faces for each side. Returns { sides, order }:
// each side's faces, filled in where tiles are present, and the order the
// deal was made in. Null if the places themselves cannot all be taken, as
// with two tiles left one on top of the other.
export function deal(L, sides, r, { present = new Uint8Array(L.count).fill(1), turnAt = Infinity } = {}) {
  const order = blankOrder(L, present, r);
  if (!order) return null;
  for (const pairs of sides) {
    if (pairs.length !== order.length) throw new Error(`${L.name} needs ${order.length} pairs, not ${pairs.length}`);
  }
  const before = order.slice(0, turnAt);
  const after = order.slice(turnAt);
  const out = sides.map(() => new Int16Array(L.count).fill(-1));
  place(out[0], before.concat(regroup(after, r)), r.shuffle(sides[0].slice()));
  if (sides.length > 1) place(out[1], after.concat(before), r.shuffle(sides[1].slice()));
  return { sides: out, order };
}

function place(faces, places, pairs) {
  pairs.forEach(([a, b], k) => {
    faces[places[k][0]] = a;
    faces[places[k][1]] = b;
  });
}

// Pairs up the tiles of some pairs afresh, at random.
function regroup(pairs, r) {
  const tiles = r.shuffle(pairs.flat());
  const out = [];
  for (let k = 0; k < tiles.length; k += 2) out.push([tiles[k], tiles[k + 1]]);
  return out;
}

// The safe shuffle: deals the tiles still on the board onto the same places
// again, so that the board can be won. side is the side in play, and ahead
// the matches still to come before the tiles turn over. Before the turn both
// sides are dealt again; the second keeps its faces, but for one each of any
// kinds left with an odd number, which are made into pairs. After the turn
// only the side in play is dealt again. Returns { sides, order }, with every
// side whole.
export function redeal(L, sides, side, ahead, present, r) {
  const both = sides.length > 1 && side === 0 && ahead > 0;
  const dealt = both
    ? deal(L, [pairsOf(sides[0], present), pairsOf(sides[1], present, true)], r, { present, turnAt: ahead })
    : deal(L, [pairsOf(sides[side], present)], r, { present });
  if (!dealt) return null;
  const out = sides.map((faces) => Int16Array.from(faces));
  (both ? [0, 1] : [side]).forEach((s, k) => {
    for (let i = 0; i < L.count; i++) if (present[i]) out[s][i] = dealt.sides[k][i];
  });
  return { sides: out, order: dealt.order };
}

// The pairs of faces that one side of the present tiles makes. With odd,
// one each of any kinds left with an odd number are paired with each other,
// the second taking the first one's face.
function pairsOf(faces, present, odd = false) {
  const byKind = new Map();
  for (let i = 0; i < faces.length; i++) {
    if (!present[i]) continue;
    const k = MATCH[faces[i]];
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k).push(faces[i]);
  }
  const pairs = [];
  const spare = [];
  for (const list of byKind.values()) {
    if (list.length % 2) {
      if (!odd) throw new Error('A kind has an odd number of tiles left');
      spare.push(list.pop());
    }
    for (let k = 0; k < list.length; k += 2) pairs.push([list[k], list[k + 1]]);
  }
  for (let k = 0; k < spare.length; k += 2) pairs.push([spare[k], spare[k]]);
  return pairs;
}

// An order for taking every present tile two free tiles at a time, faces
// ignored. Taking a tile never pins another down, so a random walk nearly
// always gets through, and the search only has to back out of the odd dead
// end. Null if there is no such order, or none was found within the budget.
export function blankOrder(L, start, r, budget = 20000) {
  const present = Uint8Array.from(start);
  const order = [];
  const dead = new Set();
  let steps = 0;
  const walk = (left) => {
    if (left === 0) return true;
    if (++steps > budget) return false;
    const key = keyOf(present);
    if (dead.has(key)) return false;
    const free = r.shuffle(freeTiles(L, present));
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const a = free[i];
        const b = free[j];
        present[a] = present[b] = 0;
        order.push([a, b]);
        if (walk(left - 2)) return true;
        order.pop();
        present[a] = present[b] = 1;
        if (steps > budget) return false;
      }
    }
    dead.add(key);
    return false;
  };
  let left = 0;
  for (const p of present) left += p;
  return walk(left) ? order : null;
}
