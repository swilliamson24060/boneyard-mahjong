import { FACES } from '../js/engine/tiles.js';

// Draws a game's tiles plainly, labelled by face, with the free ones
// outlined, for checking layouts by eye. Upper layers sit up and to the
// right, the way the board will stack them.

const INK = {
  eyes: '#1f6fb2',
  bones: '#2f7d3a',
  graves: '#6a4c9c',
  monster: '#b3261e',
  dragon: '#c25e00',
  flower: '#8a2f6e',
  moon: '#4f4f4f',
  soul: '#3f7f99',
};
const MOON = ['○', '◐', '●', '◑'];

function label(f) {
  if (f.group === 'eyes' || f.group === 'bones' || f.group === 'graves') return f.group[0].toUpperCase() + f.index;
  if (f.group === 'moon') return MOON[f.index - 1];
  if (f.group === 'soul') return '✧';
  return f.key[0].toUpperCase() + f.key[1];
}

export function drawBoard(el, game, { w = 32, h = 42, lift = 4 } = {}) {
  const L = game.layout;
  el.replaceChildren();
  el.style.width = `${(L.width / 2) * w + L.depth * lift + 4}px`;
  el.style.height = `${(L.height / 2) * h + L.depth * lift + 4}px`;
  for (let i = 0; i < L.count; i++) {
    if (!game.present[i]) continue;
    const f = FACES[game.face(i)];
    const t = document.createElement('div');
    t.className = game.isFree(i) ? 'tile free' : 'tile';
    t.style.left = `${(L.x[i] / 2) * w + L.z[i] * lift + 4}px`;
    t.style.top = `${(L.y[i] / 2) * h + (L.depth - 1 - L.z[i]) * lift}px`;
    t.style.color = INK[f.group];
    t.textContent = label(f);
    t.title = f.name;
    el.append(t);
  }
}
