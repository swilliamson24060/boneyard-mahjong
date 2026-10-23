import { LOST } from '../engine/tiles.js';
import { symbolId } from './faces.js';

const SVG = 'http://www.w3.org/2000/svg';
const CLEAR = 40; // how far the magnifier keeps above the fingertip, in px
const BESIDE = 48; // and to either side of it, a finger being wide
const EDGE = 8; // and from the edges of the screen

// The magnifier: a held tile shown up close, three times the size of the
// board's tiles, so that tired eyes need not peer at a small one. It sits
// above the finger, which would otherwise hide the tile, or beside it near
// the top of the screen, a little smaller if it must be to fit. Before the
// tiles turn over it shows, after an arrow, the side the tile will turn to.
export class Magnifier {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'magnifier';
    this.el.setAttribute('aria-hidden', 'true');
    document.body.append(this.el);
    this.showing = '';
    this.sizes = null;
  }

  // Shows a tile's sides, each [face, night], for a board whose tiles are
  // `width` pixels wide, near the point (x, y) on the screen.
  show(sides, width, x, y) {
    const key = `${sides.join(' ')} ${width}`;
    if (key !== this.showing) {
      this.showing = key;
      this.draw(sides, width);
    }
    const { left, top, stacked, scale } = spot(this.sizes, x, y, innerWidth, innerHeight);
    this.el.classList.toggle('stacked', stacked);
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    this.el.style.transform = scale < 1 ? `scale(${scale.toFixed(3)})` : '';
    this.el.classList.add('on');
  }

  hide() {
    this.el.classList.remove('on');
    this.showing = '';
  }

  draw(sides, width) {
    // Three times the board's tiles, though never so small as to be hard
    // to read, nor so big that two side by side are wider than the screen.
    const w = Math.round(Math.min(Math.max(width * 3, 112), 160, innerWidth / 2 - 50));
    const s = this.el.style;
    s.setProperty('--tile-w', `${w}px`);
    s.setProperty('--tile-h', `${Math.round((w * 4) / 3)}px`);
    s.setProperty('--lift', `${Math.round(w * 0.09)}px`);
    const parts = [];
    sides.forEach(([face, night], k) => {
      if (k) parts.push(arrow());
      parts.push(tile(face, night));
    });
    this.el.replaceChildren(...parts);
    // Its size in a row and in a column, for spot() to choose between.
    this.sizes = {};
    for (const stacked of [false, true]) {
      this.el.classList.toggle('stacked', stacked);
      this.sizes[stacked ? 'column' : 'row'] = [this.el.offsetWidth, this.el.offsetHeight];
    }
  }
}

// Where the magnifier goes, and at what scale, given its size in a row and
// in a column, for a finger at (x, y) on a screen W by H. Each place shrinks
// it as much as it must to fit there, and the place that shows it biggest
// wins, though above the finger is worth more than beside it, in a row or
// a column, and below it, where the hand is, least of all.
export function spot(sizes, x, y, W, H) {
  const clamp = (v, low, high) => Math.min(Math.max(v, low), high);
  let best = { left: EDGE, top: EDGE, stacked: false, scale: 0.5, worth: 0 };
  const consider = (layout, where, weight) => {
    const [w, h] = sizes[layout];
    const [roomW, roomH] = {
      above: [W - 2 * EDGE, y - CLEAR - EDGE],
      left: [x - BESIDE - EDGE, H - 2 * EDGE],
      right: [W - EDGE - x - BESIDE, H - 2 * EDGE],
      below: [W - 2 * EDGE, H - EDGE - y - 2 * CLEAR],
    }[where];
    const scale = Math.min(1, roomW / w, roomH / h);
    if (scale * weight <= best.worth) return;
    const sw = w * scale;
    const sh = h * scale;
    const across = clamp(x - sw / 2, EDGE, W - sw - EDGE);
    const down = clamp(y - sh / 2, EDGE, H - sh - EDGE);
    const [left, top] = {
      above: [across, y - CLEAR - sh],
      left: [x - BESIDE - sw, down],
      right: [x + BESIDE, down],
      below: [across, y + 2 * CLEAR],
    }[where];
    best = { left: Math.round(left), top: Math.round(top), stacked: layout === 'column', scale, worth: scale * weight };
  };
  consider('row', 'above', 1);
  for (const where of ['left', 'right']) {
    consider('column', where, 0.9);
    consider('row', where, 0.9);
  }
  consider('row', 'below', 0.6);
  return best;
}

function tile(face, night) {
  const el = document.createElement('div');
  el.className = `tile${night ? ' night' : ''}${face === LOST ? ' soul' : ''}`;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 60 80');
  const use = document.createElementNS(SVG, 'use');
  use.setAttribute('href', `#${symbolId(face)}`);
  svg.append(use);
  el.append(svg);
  return el;
}

function arrow() {
  const el = document.createElement('span');
  el.className = 'arrow';
  return el;
}
