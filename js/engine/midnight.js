import { MATCH } from './tiles.js';

// When the tiles turn over, any kind left with an odd number of tiles on the
// new side has one too many, and that one wakes as a lost soul. Lost souls
// match each other, and there is always an even number of them, so no tile
// is ever left with nothing to match. Returns the tiles that wake.
//
// Which tile of a kind wakes is settled the same way every time, so that a
// line planned through midnight plays out as planned: never one that would
// leave the other two lying one on the other, where they could never be
// taken together; otherwise the one with the fewest tiles on it, which is
// the easiest to bring to another lost soul.
export function soulsAt(L, faces, present) {
  const byKind = new Map();
  for (let i = 0; i < L.count; i++) {
    if (!present[i]) continue;
    const k = MATCH[faces[i]];
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k).push(i);
  }
  const souls = [];
  for (const tiles of byKind.values()) if (tiles.length % 2) souls.push(odd(L, tiles, present));
  return souls;
}

function odd(L, tiles, present) {
  if (tiles.length === 1) return tiles[0];
  const stacked = (a, b) => L.above[a].includes(b) || L.above[b].includes(a);
  const cover = (t) => L.above[t].filter((u) => present[u]).length;
  let best = -1;
  let bestScore = Infinity;
  for (const t of tiles) {
    const rest = tiles.filter((u) => u !== t);
    const score = (rest.length === 2 && stacked(rest[0], rest[1]) ? 1000 : 0) + cover(t);
    if (score < bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}
