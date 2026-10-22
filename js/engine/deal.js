import { freeTiles, keyOf } from './layout.js';
import { MATCH } from './tiles.js';

// Dealing so that every board can be won. A deal first plays the board with
// blank tiles, taking any two free tiles at a time, and then gives each pair
// it took one pair of faces: taking the pairs in the same order wins.
//
// Returns { faces, order }, with faces filled in only where tiles are
// present, or null if the places themselves cannot all be taken, as with two
// tiles left one on top of the other.
export function deal(L, pairs, r, present = new Uint8Array(L.count).fill(1)) {
  const order = blankOrder(L, present, r);
  if (!order) return null;
  if (order.length !== pairs.length) throw new Error(`${L.name} needs ${order.length} pairs, not ${pairs.length}`);
  const faces = new Int16Array(L.count).fill(-1);
  r.shuffle(pairs.slice()).forEach(([a, b], k) => {
    faces[order[k][0]] = a;
    faces[order[k][1]] = b;
  });
  return { faces, order };
}

// The safe shuffle: deals the tiles still on the board onto the same places
// again, so that the board can be won.
export function redeal(L, faces, present, r) {
  const byKind = new Map();
  for (let i = 0; i < L.count; i++) {
    if (!present[i]) continue;
    const k = MATCH[faces[i]];
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k).push(faces[i]);
  }
  const pairs = [];
  for (const list of byKind.values()) {
    if (list.length % 2) throw new Error('A kind has an odd number of tiles left');
    for (let n = 0; n < list.length; n += 2) pairs.push([list[n], list[n + 1]]);
  }
  return deal(L, pairs, r, present);
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
