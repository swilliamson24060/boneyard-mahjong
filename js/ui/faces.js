import { FACES } from '../engine/tiles.js';

// The faces, drawn in code as SVG symbols on a 60 by 80 tile and gathered in
// one hidden sprite that every tile points into. Outlines and small dark
// details use var(--ink) and whites var(--paper), which a night tile turns
// pale, so one drawing serves both sides: by night the faces glow. The other
// colours read on ivory and on midnight blue alike.

const INK = 'var(--ink)';
const PAPER = 'var(--paper)';
const DARK = '#231c2b'; // dark fills that stay dark by night, outlined in ink
const LEAF = '#3a8f55';

// The groups with an index in a corner, in the group's colour, which the tile
// sets as --index-eyes and so on: brighter by night. Like a playing card's,
// it is what names the tile, big and bold enough to read at a glance on the
// smallest board, with no eyes or bones to count: the drawing gives it the
// top left corner, shrinking toward the bottom right, and the index is
// ringed in the tile's own colour, --face-1, where the two meet.
const INDEXED = new Set(['eyes', 'bones', 'graves', 'monster', 'flower', 'moon']);
const SHRINK = 0.8; // the drawing on a tile with an index

export const symbolId = (face) => `face-${FACES[face].key}`;
const indexed = (f) => Boolean(f.index) && INDEXED.has(f.group);

// The sprite, to be put in the page once.
export function sprite() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  const symbols = FACES.map((f) => `<symbol id="${symbolId(f.id)}" viewBox="0 0 60 80">${art(f)}${index(f)}</symbol>`);
  svg.innerHTML = `<defs>${symbols.join('')}</defs>`;
  return svg;
}

// A face's drawing, shrunk toward the bottom right on a tile with an index.
function art(f) {
  if (!indexed(f)) return draw(f);
  return `<g transform="translate(${60 * (1 - SHRINK)} ${80 * (1 - SHRINK)}) scale(${SHRINK})">${draw(f)}</g>`;
}

function draw(f) {
  if (f.group === 'eyes') return f.index === '1' ? bigEye() : EYES[f.index].map((e) => eye(...e)).join('');
  if (f.group === 'bones') return f.index === '1' ? crow() : bones(BONES[f.index]);
  if (f.group === 'graves') return grave(f.index);
  if (f.group === 'moon') return moon(f.key);
  return ART[f.key]();
}

function index(f) {
  if (!indexed(f)) return '';
  const ring = 'stroke:var(--face-1);stroke-width:4;stroke-linejoin:round;paint-order:stroke';
  return `<text x="2.5" y="25.5" style="fill:var(--index-${f.group});${ring};font:900 29px system-ui,-apple-system,sans-serif">${f.index}</text>`;
}

const style = (fill, stroke = 'none', width = 1.4, extra = '') =>
  `style="fill:${fill};stroke:${stroke};stroke-width:${width};stroke-linejoin:round;stroke-linecap:round${extra}"`;

const n = (v) => +v.toFixed(2);

// ------------------------------------------------------------------- eyes

// Where the eyes sit, as the dots do on a dots tile: [x, y, size, red].
const EYES = {
  2: [[30, 27, 11], [30, 59, 11]],
  3: [[18, 24, 9], [30, 43, 9], [42, 62, 9]],
  4: [[19, 29, 9.5], [41, 29, 9.5], [19, 57, 9.5], [41, 57, 9.5]],
  5: [[17, 26, 8.5], [43, 26, 8.5], [30, 43, 8.5, true], [17, 60, 8.5], [43, 60, 8.5]],
  6: [[20, 24, 8.5], [40, 24, 8.5], [20, 43, 8.5], [40, 43, 8.5], [20, 62, 8.5], [40, 62, 8.5]],
  7: [[18, 22, 6.5], [30, 31, 6.5], [42, 40, 6.5], [20, 55, 7], [40, 55, 7], [20, 69, 7], [40, 69, 7]],
  8: [[20, 21, 7], [40, 21, 7], [20, 37, 7], [40, 37, 7], [20, 53, 7], [40, 53, 7], [20, 69, 7], [40, 69, 7]],
  9: [[16, 24, 7], [30, 24, 7], [44, 24, 7], [16, 43, 7], [30, 43, 7, true], [44, 43, 7], [16, 62, 7], [30, 62, 7], [44, 62, 7]],
};

function eye(cx, cy, r, red = false) {
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}" ${style(PAPER, INK, n(Math.max(1, r / 7)))}/>` +
    `<circle cx="${cx}" cy="${cy}" r="${n(r * 0.56)}" ${style(red ? '#c8323c' : '#2f6fc0')}/>` +
    `<circle cx="${cx}" cy="${cy}" r="${n(r * 0.26)}" ${style(INK)}/>` +
    `<circle cx="${n(cx - r * 0.22)}" cy="${n(cy - r * 0.24)}" r="${n(r * 0.13)}" ${style('#fff')}/>`
  );
}

// The one of eyes: a single great eye, bloodshot.
function bigEye() {
  return (
    `<circle cx="30" cy="44" r="17" ${style(PAPER, INK, 1.6)}/>` +
    `<path d="M13.6 40 q4 1 6 -1 q2 2 4 1 M46.4 47 q-4 -1 -6 1 q-2 -2 -4 -1 M24 59.6 q1 -4 -1 -6 M38 28.6 q-1 4 1 6 M17 52 q4 -1 5 -4" ${style('none', '#c8323c', 0.9)}/>` +
    `<circle cx="30" cy="44" r="9.5" ${style('#2f6fc0')}/>` +
    `<circle cx="30" cy="44" r="4.6" ${style(INK)}/>` +
    `<circle cx="26.5" cy="40.5" r="2" ${style('#fff')}/>`
  );
}

// ------------------------------------------------------------------ bones

// Where the bones stand, as the sticks do on a bamboo tile: [x, y, length, width].
const BONES = {
  2: [[30, 28, 24, 7], [30, 58, 24, 7]],
  3: [[30, 28, 22, 7], [19, 58, 22, 7], [41, 58, 22, 7]],
  4: [[20, 28, 24, 7], [40, 28, 24, 7], [20, 58, 24, 7], [40, 58, 24, 7]],
  5: [[16, 27, 20, 6], [44, 27, 20, 6], [30, 43, 20, 6], [16, 60, 20, 6], [44, 60, 20, 6]],
  6: [[16, 29, 22, 6], [30, 29, 22, 6], [44, 29, 22, 6], [16, 59, 22, 6], [30, 59, 22, 6], [44, 59, 22, 6]],
  7: [[30, 21, 15, 6], [16, 43, 15, 6], [30, 43, 15, 6], [44, 43, 15, 6], [16, 65, 15, 6], [30, 65, 15, 6], [44, 65, 15, 6]],
  8: [[13, 31, 22, 4.6], [24.6, 31, 22, 4.6], [36.2, 31, 22, 4.6], [47.8, 31, 22, 4.6], [13, 60, 22, 4.6], [24.6, 60, 22, 4.6], [36.2, 60, 22, 4.6], [47.8, 60, 22, 4.6]],
  9: [[16, 22, 15, 6], [30, 22, 15, 6], [44, 22, 15, 6], [16, 44, 15, 6], [30, 44, 15, 6], [44, 44, 15, 6], [16, 66, 15, 6], [30, 66, 15, 6], [44, 66, 15, 6]],
};

// A bone standing up: a shaft with two knobs at each end.
function bone(cx, cy, len, w) {
  const top = cy - len / 2;
  const bot = cy + len / 2;
  const k = w * 0.5;
  const dx = w * 0.4;
  return (
    `<rect x="${n(cx - w * 0.31)}" y="${n(top)}" width="${n(w * 0.62)}" height="${n(len)}"/>` +
    [top, bot].map((y) => `<circle cx="${n(cx - dx)}" cy="${n(y)}" r="${n(k)}"/><circle cx="${n(cx + dx)}" cy="${n(y)}" r="${n(k)}"/>`).join('')
  );
}

// Bones are outlined by drawing them once fat in green and again in white on top.
function bones(list, turn = '') {
  const parts = list.map((b) => bone(...b)).join('');
  return `<g ${turn} ${style('#2e7d4a', '#2e7d4a', 2.6)}>${parts}</g><g ${turn} ${style(PAPER)}>${parts}</g>`;
}

// The one of bones: a crow, as the one of bamboo is a bird, perched on a bone.
function crow() {
  return (
    bones([[30, 66, 30, 6]], 'transform="rotate(90 30 66)"') +
    `<path d="M17 53 L5 61 L9 63.5 L20 57.5 Z" ${style(DARK, INK, 1)}/>` +
    `<path d="M15 52 C14 41 23 32 34 33 C43 34 47 40 46 46 C45 54 37 59 27 59 C21 59 16 56 15 52 Z" ${style(DARK, INK, 1)}/>` +
    `<circle cx="40" cy="30" r="7.5" ${style(DARK, INK, 1)}/>` +
    `<path d="M46.5 27 L56 30.5 L46.5 33.5 Z" ${style('#e0a526', INK, 0.8)}/>` +
    `<path d="M22 45 C28 40 35 41 40 47" ${style('none', '#6a5f80', 1.6)}/>` +
    `<circle cx="42.5" cy="28.5" r="1.8" ${style('#f2c94c')}/>` +
    `<path d="M27 59 L25.5 63 M33 59 L33 63" ${style('none', INK, 1.6)}/>`
  );
}

// ----------------------------------------------------------------- graves

function grave(number) {
  return (
    `<path d="M9 71 H51" ${style('none', '#3f8f4f', 3.2)}/>` +
    `<path d="M15 70 V37 A15 15 0 0 1 45 37 V70 Z" ${style('#8f88aa', INK, 1.5)}/>` +
    `<path d="M19 68 V38 A11 11 0 0 1 30 27" ${style('none', '#aaa3c4', 1.2)}/>` +
    `<path d="M30 28.5 V37.5 M26.5 31.5 H33.5" ${style('none', '#3a3350', 1.5)}/>` +
    `<text x="30" y="63" text-anchor="middle" style="fill:#2c2640;font:700 24px Georgia,'Times New Roman',serif">${number}</text>`
  );
}

// ------------------------------------------------------------------ moons

function moon(key) {
  const lit = '#f6e9a8';
  const stars = [[18, 32, 0.9], [41, 30, 1], [44, 54, 0.8], [17, 56, 0.9], [26, 27.5, 0.6], [36, 60, 0.7]];
  const phase = {
    'new-moon': `<circle cx="30" cy="44" r="10.5" ${style('#1a1d3b', lit, 1, ';stroke-dasharray:2 2')}/>`,
    'waxing-moon': `<path d="M30 33.5 A10.5 10.5 0 0 1 30 54.5 A5.5 10.5 0 0 0 30 33.5 Z" ${style(lit)}/>`,
    'full-moon':
      `<circle cx="30" cy="44" r="10.5" ${style(lit)}/>` +
      `<circle cx="26.5" cy="41" r="2.3" ${style('#d9ca86')}/><circle cx="33" cy="47.5" r="1.7" ${style('#d9ca86')}/><circle cx="31.5" cy="38.5" r="1.1" ${style('#d9ca86')}/>`,
    'waning-moon': `<path d="M30 33.5 A10.5 10.5 0 0 0 30 54.5 A5.5 10.5 0 0 1 30 33.5 Z" ${style(lit)}/>`,
  };
  return (
    `<circle cx="30" cy="44" r="19.5" ${style('#262a52', INK, 1.3)}/>` +
    stars.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" ${style('#fff6c8')}/>`).join('') +
    phase[key]
  );
}

// ------------------------------------------------------------ everything else

function star(cx, cy, r) {
  const points = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    points.push(`${n(cx + rr * Math.cos(a))},${n(cy + rr * Math.sin(a))}`);
  }
  return `<polygon points="${points.join(' ')}"`;
}

const ART = {
  vampire: () =>
    `<path d="M10 72 L17 47 L30 58 L43 47 L50 72 Z" ${style('#8e1f30', INK, 1.4)}/>` +
    `<path d="M17 47 L22 72 M43 47 L38 72" ${style('none', '#5c1220', 1.2)}/>` +
    `<ellipse cx="30" cy="42" rx="12.5" ry="15" ${style('#efe4f3', INK, 1.4)}/>` +
    `<path d="M17 41 C15 27 24 21 30 23 C36 21 45 27 43 41 C40 33 35 31 30 36 C25 31 20 33 17 41 Z" ${style(DARK, INK, 1)}/>` +
    `<circle cx="25" cy="44" r="2.3" ${style('#d6262c')}/><circle cx="35" cy="44" r="2.3" ${style('#d6262c')}/>` +
    `<path d="M24 51.5 Q30 55 36 51.5" ${style('none', INK, 1.3)}/>` +
    `<path d="M26.3 52.6 L27.4 56.2 L28.5 53.3 Z M31.5 53.3 L32.6 56.2 L33.7 52.6 Z" ${style(PAPER, INK, 0.6)}/>`,

  werewolf: () =>
    `<path d="M14 34 L17 13 L27 27 Z M46 34 L43 13 L33 27 Z" ${style('#7a4b30', INK, 1.3)}/>` +
    `<path d="M17.5 27 L18.5 18 L23.5 25 Z M42.5 27 L41.5 18 L36.5 25 Z" ${style('#d9a37a')}/>` +
    `<path d="M14 44 L8 49 L13 49 L9 55 L16 52 Z M46 44 L52 49 L47 49 L51 55 L44 52 Z" ${style('#8a5a3c', INK, 1)}/>` +
    `<path d="M13 42 C13 27 47 27 47 42 C47 57 39 68 30 68 C21 68 13 57 13 42 Z" ${style('#8a5a3c', INK, 1.4)}/>` +
    `<ellipse cx="30" cy="56" rx="9.5" ry="8.5" ${style('#cfa173', INK, 1)}/>` +
    `<ellipse cx="30" cy="50.5" rx="3.6" ry="2.6" ${style(DARK)}/>` +
    `<path d="M19.5 42 Q23 39 26.5 42 Q23 44.5 19.5 42 Z M33.5 42 Q37 39 40.5 42 Q37 44.5 33.5 42 Z" ${style('#f4c542', INK, 0.8)}/>` +
    `<path d="M23 40.4 V43.6 M37 40.4 V43.6" ${style('none', DARK, 1.3)}/>` +
    `<path d="M25 60 Q30 63 35 60" ${style('none', INK, 1.2)}/>` +
    `<path d="M26.5 60.4 L27.3 63.6 L28.1 61 Z M31.9 61 L32.7 63.6 L33.5 60.4 Z" ${style(PAPER)}/>`,

  mummy: () =>
    `<path d="M44 60 C50 63 47 70 54 73" ${style('none', INK, 4.2)}/>` +
    `<path d="M44 60 C50 63 47 70 54 73" ${style('none', '#e8dcbb', 2.4)}/>` +
    `<path d="M15 34 C15 19 45 19 45 34 V60 C45 69 15 69 15 60 Z" ${style('#e8dcbb', INK, 1.4)}/>` +
    `<path d="M15 30 L45 25 M15 37 L45 33 M15 53 L45 49 M15 60 L45 57 M17 64.5 L43 66" ${style('none', '#b4a27a', 1.8)}/>` +
    `<rect x="17" y="39.5" width="26" height="8" rx="4" ${style(DARK, INK, 0.8)}/>` +
    `<circle cx="24.5" cy="43.5" r="2.4" ${style('#ffd84a')}/><circle cx="35.5" cy="43.5" r="2.4" ${style('#ffd84a')}/>`,

  zombie: () =>
    `<path d="M15 35 C15 21 45 19 45 35 L44 57 C42 67 18 67 16 57 Z" ${style('#93c278', INK, 1.4)}/>` +
    `<path d="M14.5 34 L17 22 L21.5 28 L25.5 19 L29.5 27 L34 18 L37.5 26.5 L42 20 L45.5 34 C38 29 22 29 14.5 34 Z" ${style('#4a3b2a', INK, 1)}/>` +
    `<circle cx="23.5" cy="42" r="5.2" ${style(PAPER, INK, 1.1)}/><circle cx="24.5" cy="43" r="1.9" ${style(INK)}/>` +
    `<circle cx="36.5" cy="42.5" r="3.4" ${style(PAPER, INK, 1.1)}/><circle cx="36" cy="43" r="1.3" ${style(INK)}/>` +
    `<path d="M38.5 29.5 V36.5 M36.5 31 H40.5 M36.5 33.5 H40.5" ${style('none', DARK, 0.9)}/>` +
    `<path d="M21 55 Q30 50 39 56" ${style('none', INK, 1.4)}/>` +
    `<path d="M25 53.3 V56 M29 52.4 V55.2 M33 52.6 V55.4" ${style('none', INK, 1)}/>`,

  lantern: () =>
    `<path d="M27.5 22 C27 15 32 12 35 13.5 L33 22.5 Z" ${style('#3d8b3d', INK, 1)}/>` +
    `<ellipse cx="30" cy="46" rx="22" ry="20" ${style('#f08a24', INK, 1.4)}/>` +
    `<path d="M30 26 C21 33 21 59 30 66 M30 26 C39 33 39 59 30 66 M30 26 C13 32 12 60 30 66 M30 26 C47 32 48 60 30 66" ${style('none', '#c25f14', 1.3)}/>` +
    `<path d="M17 43 L23.5 34 L28 44 Z M43 43 L36.5 34 L32 44 Z" ${style('#ffd54a', '#7a3b0c', 1)}/>` +
    `<path d="M28 47.5 L30 44.5 L32 47.5 Z" ${style('#ffd54a', '#7a3b0c', 0.8)}/>` +
    `<path d="M16 51 L20.5 55 L24 52 L27 56.5 L30 52.5 L33 56.5 L36 52 L39.5 55 L44 51 C41 62.5 19 62.5 16 51 Z" ${style('#ffd54a', '#7a3b0c', 1)}/>`,

  brew: () =>
    `<path d="M12 47 H48 C50 62 42 70 30 70 C18 70 10 62 12 47 Z" ${style(DARK, INK, 1.3)}/>` +
    `<path d="M17 54 C17 60 21 64 26 65" ${style('none', '#5a5070', 1.4)}/>` +
    `<path d="M18 69.5 L15.5 75 M42 69.5 L44.5 75" ${style('none', INK, 3)}/>` +
    `<rect x="9" y="43" width="42" height="5.5" rx="2.75" ${style(DARK, INK, 1.3)}/>` +
    `<ellipse cx="30" cy="43.5" rx="17" ry="4.5" ${style('#62c944', '#2f7d1f', 1)}/>` +
    `<circle cx="22" cy="35" r="4.2" ${style('#62c944', '#2f7d1f', 1)}/>` +
    `<circle cx="34" cy="30" r="5.6" ${style('#62c944', '#2f7d1f', 1)}/>` +
    `<circle cx="41" cy="37.5" r="3.2" ${style('#62c944', '#2f7d1f', 1)}/>` +
    `<circle cx="27.5" cy="21" r="2.6" ${style('#62c944', '#2f7d1f', 1)}/>`,

  ghost: () =>
    `<path d="M15 46 C10 44 8 39 9.5 35 M45 46 C50 44 52 39 50.5 35" ${style('none', '#7d93b8', 1.8)}/>` +
    `<path d="M15 67 V39 C15 22 45 22 45 39 V67 L40 62 L35 67 L30 62 L25 67 L20 62 Z" ${style(PAPER, '#7d93b8', 1.6)}/>` +
    `<ellipse cx="24.5" cy="39" rx="3.1" ry="4.4" ${style(DARK)}/><ellipse cx="35.5" cy="39" rx="3.1" ry="4.4" ${style(DARK)}/>` +
    `<ellipse cx="30" cy="51" rx="3.2" ry="4.2" ${style(DARK)}/>`,

  nightshade: () =>
    `<path d="M30 73 C30 62 26 52 29 38 C30 32 34 28 38 26" ${style('none', LEAF, 2)}/>` +
    `<path d="M30 60 C22 59 17 53 19 47 C25 48 29 53 30 60 Z M29 47 C36 46 41 41 40 35 C34 36 30 41 29 47 Z" ${style(LEAF)}/>` +
    `<path d="M32 50 L38 55 M32 50 L43 60 M32 50 L36.5 62" ${style('none', LEAF, 1)}/>` +
    `<circle cx="38" cy="55" r="3.4" ${style(DARK, INK, 0.8)}/><circle cx="43" cy="60" r="3.1" ${style(DARK, INK, 0.8)}/><circle cx="36.5" cy="62" r="2.9" ${style(DARK, INK, 0.8)}/>` +
    `<circle cx="37" cy="54" r="0.9" ${style('#fff')}/><circle cx="42" cy="59" r="0.8" ${style('#fff')}/>` +
    `${star(22, 30, 8)} ${style('#7b3fa0', INK, 0.9)}/><circle cx="22" cy="30" r="2" ${style('#f2c94c')}/>` +
    `${star(38, 21, 7)} ${style('#7b3fa0', INK, 0.9)}/><circle cx="38" cy="21" r="1.8" ${style('#f2c94c')}/>`,

  foxglove: () =>
    `<path d="M30 73 V14" ${style('none', LEAF, 2)}/>` +
    [[24, 18], [36, 27], [24, 36], [36, 45], [25, 54]]
      .map(
        ([x, y]) =>
          `<path d="M30 ${y + 1} L${x} ${y}" ${style('none', LEAF, 1.2)}/>` +
          `<path d="M${x} ${y} C${x - 6} ${y + 1} ${x - 7} ${y + 8} ${x - 7} ${y + 10} L${x + 7} ${y + 10} C${x + 7} ${y + 8} ${x + 6} ${y + 1} ${x} ${y} Z" ${style('#c4559a', INK, 0.8)}/>` +
          `<circle cx="${x - 2}" cy="${y + 7}" r="0.9" ${style('#5a1f45')}/><circle cx="${x + 2}" cy="${y + 8}" r="0.9" ${style('#5a1f45')}/>`,
      )
      .join('') +
    `<path d="M30 71 C22 69 18 64 19 59 C25 60 29 65 30 71 Z M30 71 C38 69 42 64 41 59 C35 60 31 65 30 71 Z" ${style(LEAF)}/>`,

  hemlock: () => {
    const ends = [[14, 30], [21, 24], [30, 21], [39, 24], [46, 30]];
    return (
      `<path d="M30 73 V40" ${style('none', LEAF, 2.2)}/>` +
      `<circle cx="30" cy="62" r="1.2" ${style('#8a2f6e')}/><circle cx="30" cy="54" r="1" ${style('#8a2f6e')}/><circle cx="30" cy="47" r="1.1" ${style('#8a2f6e')}/>` +
      `<path d="${ends.map(([x, y]) => `M30 40 L${x} ${y}`).join(' ')}" ${style('none', LEAF, 1.2)}/>` +
      ends
        .map(([x, y]) =>
          [[x - 3, y - 1.5], [x + 3, y - 1.5], [x, y - 4], [x, y + 1]].map(([fx, fy]) => `<circle cx="${fx}" cy="${fy}" r="2" ${style(PAPER, INK, 0.7)}/>`).join(''),
        )
        .join('') +
      `<path d="M30 66 C24 66 19 62 17 57 L21 58 L19 54 L24 56 L23 52 C26 56 29 60 30 66 Z" ${style(LEAF)}/>`
    );
  },

  wolfsbane: () =>
    `<path d="M30 73 V16" ${style('none', LEAF, 2)}/>` +
    [[24, 18], [36, 27], [24, 36], [36, 45]]
      .map(
        ([x, y]) =>
          `<path d="M30 ${y + 4} L${x} ${y + 4}" ${style('none', LEAF, 1.2)}/>` +
          `<path d="M${x} ${y} C${x - 7} ${y} ${x - 8} ${y + 7} ${x - 6} ${y + 10} L${x + 6} ${y + 10} C${x + 8} ${y + 7} ${x + 7} ${y} ${x} ${y} Z" ${style('#4b5fc4', INK, 0.8)}/>` +
          `<path d="M${x - 4} ${y + 10} Q${x} ${y + 13} ${x + 4} ${y + 10}" ${style('#6a7de0', INK, 0.6)}/>`,
      )
      .join('') +
    `<path d="M30 69 C26 62 18 62 16 66 C20 68 24 70 30 69 Z M30 69 C34 62 42 62 44 66 C40 68 36 70 30 69 Z M30 66 C29 60 30 56 32 54 C33 58 32 62 30 66 Z" ${style(LEAF)}/>`,

  'lost-soul': () =>
    `<path d="M12 30 C16 28 16 23 20.5 21 M48 30 C44 28 44 23 39.5 21" ${style('none', '#7fd3ec', 1.3)}/>` +
    `<path d="M30 14 C40 27 47 37 45 50 C43 62 35 69 30 69 C24 69 15 62 15 50 C15 40 23 33 30 14 Z" ${style('#a8ecff', '#3e9ec0', 1.4)}/>` +
    `<path d="M30 33 C36 41 39 50 35 58 C33 62 27 62 25.5 56.5 C24 50.5 27 43.5 30 33 Z" ${style('#eafcff')}/>` +
    `<ellipse cx="25.5" cy="50" rx="2.2" ry="3.2" ${style('#1b4a5c')}/><ellipse cx="34.5" cy="50" rx="2.2" ry="3.2" ${style('#1b4a5c')}/>`,
};
