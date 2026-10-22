// Where the tiles sit. Positions are in half-tile units: a tile at (x, y) on
// layer z covers x to x + 2 across and y to y + 2 down, so a tile can sit
// across the join between two others, as the top of the turtle does.

const SHIFT = { '#': [0, 0], '>': [1, 0], v: [0, 1], '+': [1, 1] };

// Reads a layout drawn as text: one drawing per layer, all on the same grid,
// one character per tile.
//   #  a tile
//   >  a tile shifted half a tile to the right
//   v  a tile shifted half a tile down
//   +  a tile shifted half a tile both ways
// Dots are empty, and the drawings' indentation is ignored.
export function parseLayout(name, layers) {
  const cells = [];
  layers.forEach((drawing, z) => {
    rows(drawing).forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const s = SHIFT[ch];
        if (s) cells.push([x * 2 + s[0], y * 2 + s[1], z]);
      });
    });
  });
  return makeLayout(name, cells);
}

function rows(drawing) {
  const lines = drawing.split('\n').filter((line) => line.trim());
  const indent = Math.min(...lines.map((line) => line.length - line.trimStart().length));
  return lines.map((line) => line.slice(indent).trimEnd());
}

// Builds a layout from [x, y, z] cells: sorts them by layer, row and column,
// checks them, and works out which tiles lie on which and which sit side by
// side.
export function makeLayout(name, cells) {
  const count = cells.length;
  if (count % 2) throw new Error(`${name} has an odd number of tiles (${count})`);
  if (count > 144) throw new Error(`${name} has more tiles than a set (${count})`);
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  const sorted = cells
    .map(([x, y, z]) => [x - minX, y - minY, z])
    .sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  const x = Int16Array.from(sorted, (c) => c[0]);
  const y = Int16Array.from(sorted, (c) => c[1]);
  const z = Int16Array.from(sorted, (c) => c[2]);
  const above = [];
  const below = [];
  const left = [];
  const right = [];
  for (let i = 0; i < count; i++) {
    above.push([]);
    below.push([]);
    left.push([]);
    right.push([]);
  }
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const dx = x[j] - x[i];
      if (Math.abs(y[j] - y[i]) >= 2) continue;
      if (z[j] === z[i]) {
        if (Math.abs(dx) < 2) throw new Error(`${name} has two tiles overlapping at (${x[j]}, ${y[j]}) on layer ${z[j]}`);
        if (dx === 2) {
          right[i].push(j);
          left[j].push(i);
        } else if (dx === -2) {
          left[i].push(j);
          right[j].push(i);
        }
      } else if (Math.abs(dx) < 2) {
        // Sorted by layer, so j is the higher of the two.
        above[i].push(j);
        below[j].push(i);
      }
    }
  }
  for (let i = 0; i < count; i++) {
    if (z[i] > 0 && !below[i].some((j) => z[j] === z[i] - 1)) {
      throw new Error(`${name} has a tile with nothing under it at (${x[i]}, ${y[i]}) on layer ${z[i]}`);
    }
  }
  // How much each tile holds up: the tiles under it and beside it. The solver
  // and the hints try first the pairs that hold up the most.
  const weight = Int16Array.from(below, (b, i) => b.length + left[i].length + right[i].length);
  return {
    name,
    count,
    x,
    y,
    z,
    above,
    below,
    left,
    right,
    weight,
    width: Math.max(...x) + 2,
    height: Math.max(...y) + 2,
    depth: Math.max(...z) + 1,
  };
}

// A tile is free when no tile lies on it and its left or right side is open.
export function isFree(L, present, i) {
  for (const j of L.above[i]) if (present[j]) return false;
  return open(L.left[i], present) || open(L.right[i], present);
}

function open(side, present) {
  for (const j of side) if (present[j]) return false;
  return true;
}

export function freeTiles(L, present) {
  const out = [];
  for (let i = 0; i < L.count; i++) if (present[i] && isFree(L, present, i)) out.push(i);
  return out;
}

// Which tiles are present, as a short string, for remembering positions
// already tried.
export function keyOf(present) {
  let key = '';
  for (let i = 0; i < present.length; i += 16) {
    let bits = 0;
    for (let j = i; j < i + 16 && j < present.length; j++) if (present[j]) bits |= 1 << (j - i);
    key += String.fromCharCode(bits);
  }
  return key;
}
