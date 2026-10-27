import { FACES, LOST } from '../engine/tiles.js';
import { symbolId } from './faces.js';

const SVG = 'http://www.w3.org/2000/svg';
const LIFT = 0.11; // how far each layer sits up and to the right, in tile widths
const HOLD = 400; // how long a press must last to hold a tile, in ms
const WINDOW = 42 / 110; // how far down the planchette its window sits

// Players who have asked their device for less motion get no shaking or
// turning waves: things simply change, and a hint glows without pulsing.
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// The planchette that points out a hint: heart-shaped wood with a glass
// window near its point, which comes to rest over a tile.
function planchette() {
  const el = document.createElement('div');
  el.className = 'planchette';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<svg viewBox="0 0 100 110">' +
    '<path d="M50 3 C62 22 96 44 94 70 C92 94 70 107 50 107 C30 107 8 94 6 70 C4 44 38 22 50 3 Z" fill="#c8955a" stroke="#5b3a1a" stroke-width="3"/>' +
    '<path d="M50 15 C60 31 86 50 84 70 C82 89 66 98 50 98 C34 98 18 89 16 70 C14 50 40 31 50 15 Z" fill="none" stroke="#e7c08a" stroke-width="1.5" opacity="0.7"/>' +
    '<circle cx="50" cy="42" r="15" fill="rgba(255,255,240,0.18)" stroke="#5b3a1a" stroke-width="3"/>' +
    '<path d="M42 35 Q46 31 51 31" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.7"/>' +
    '<circle cx="34" cy="76" r="2.4" fill="#5b3a1a"/><circle cx="66" cy="76" r="2.4" fill="#5b3a1a"/><circle cx="50" cy="88" r="2.4" fill="#5b3a1a"/>' +
    '</svg>';
  return el;
}

// The board on the page: one button per tile, stacked so that each layer
// sits up and to the right of the one under it, with the tiles' sides
// showing below and to the left. It draws what the game says, and turns
// clicks, taps and keys into moves. say(text) reports things for the page
// to show, sound, if given, plays a tock for each tile pressed, and
// magnifier, if given, shows a tile held down up close.
export class Board {
  constructor(el, game, { say = () => {}, sound = null, magnifier = null } = {}) {
    this.el = el;
    this.game = game;
    this.say = say;
    this.sound = sound;
    this.selected = -1;
    this.keying = false; // the next tile pressed gets the skeleton key
    this.busy = 0; // while the tiles turn over, presses wait
    this.held = -1; // the tile held down: shown up close, or peeked at
    this.at = [0, 0]; // where the pointer is on the screen
    this.swallowUntil = 0; // the click that ends a long press is not a press
    this.tiles = [];
    this.tileWidth = 0;
    this.build();
    this.setMagnifier(magnifier);
    game.on('match', (m) => this.matched(m));
    game.on('undo', (entry) => this.undone(entry));
    game.on('shuffle', () => this.shuffled());
    game.on('key', () => this.refresh());
  }

  build() {
    const L = this.game.layout;
    const el = this.el;
    el.replaceChildren();
    // In the page in reading order, so Tab goes row by row; the stacking
    // comes from z-index: upper layers over lower, and within a layer each
    // tile over the one above it and the one to its right, whose sides
    // would otherwise show over it.
    const order = [...L.x.keys()].sort((a, b) => L.y[a] - L.y[b] || L.x[a] - L.x[b] || L.z[a] - L.z[b]);
    for (const i of order) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tile';
      button.dataset.i = i;
      button.style.zIndex = L.z[i] * 10000 + L.y[i] * 100 + (99 - L.x[i]);
      const svg = document.createElementNS(SVG, 'svg');
      svg.setAttribute('viewBox', '0 0 60 80');
      svg.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS(SVG, 'use');
      svg.append(use);
      button.append(svg);
      this.tiles[i] = { el: button, use };
      el.append(button);
    }

    el.onclick = (e) => {
      const t = e.target.closest('.tile');
      if (!t || performance.now() < this.swallowUntil) return;
      this.press(Number(t.dataset.i));
    };
    el.oncontextmenu = (e) => e.preventDefault();
    el.onpointerdown = (e) => {
      const t = e.target.closest('.tile');
      if (!t || (!this.magnifier && !this.game.turnAhead)) return;
      this.at = [e.clientX, e.clientY];
      clearTimeout(this.holding);
      this.holding = setTimeout(() => this.hold(Number(t.dataset.i)), HOLD);
    };
    el.onpointermove = (e) => {
      this.at = [e.clientX, e.clientY];
      if (this.held >= 0 && this.magnifier) this.hold(this.held);
    };
    el.onpointerup = el.onpointercancel = el.onpointerleave = () => {
      clearTimeout(this.holding);
      if (this.held < 0) return;
      if (this.magnifier) this.magnifier.hide();
      else this.paint(this.held);
      this.held = -1;
      this.swallowUntil = performance.now() + 250;
    };
    // A finger held on the board to magnify a tile may slide on to others,
    // and the page does not pan under it; two fingers still zoom the page.
    el.ontouchmove = (e) => {
      if (this.magnifier && e.touches.length === 1 && e.cancelable) e.preventDefault();
    };
    el.onkeydown = (e) => {
      if (!e.key.startsWith('Arrow')) return;
      e.preventDefault();
      this.move(e.key);
    };

    for (let i = 0; i < L.count; i++) this.paint(i);
    this.refresh();
    this.fit();
  }

  // Sizes the tiles to fill the space the board has, and places them.
  fit() {
    const L = this.game.layout;
    const box = this.el.parentElement.getBoundingClientRect();
    const cols = L.width / 2;
    const rows = L.height / 2;
    const deep = L.depth - 1;
    const pad = 10;
    const across = cols + (deep + 1.6) * LIFT;
    const down = (rows * 4) / 3 + (deep + 1.6) * LIFT;
    const w = Math.max(16, Math.floor(Math.min((box.width - 2 * pad) / across, (box.height - 2 * pad) / down, 84)));
    const h = Math.round((w * 4) / 3);
    const lift = Math.max(2, Math.round(w * LIFT));
    this.tileWidth = w;
    const s = this.el.style;
    s.setProperty('--tile-w', `${w}px`);
    s.setProperty('--tile-h', `${h}px`);
    s.setProperty('--lift', `${lift}px`);
    s.setProperty('--gap', `${Math.max(1, Math.round(w * 0.04))}px`);
    s.width = `${Math.ceil(cols * w + (deep + 1.6) * lift)}px`;
    s.height = `${Math.ceil(rows * h + (deep + 1.6) * lift)}px`;
    for (let i = 0; i < L.count; i++) {
      const t = this.tiles[i].el.style;
      t.left = `${Math.round(1.4 * lift + (L.x[i] / 2) * w + L.z[i] * lift)}px`;
      t.top = `${Math.round((deep - L.z[i]) * lift + (L.y[i] / 2) * h)}px`;
    }
  }

  // Shows one side of a tile: the side up, unless told otherwise.
  paint(i, side = this.game.side) {
    const g = this.game;
    const face = g.sides[side][i];
    const t = this.tiles[i];
    t.use.setAttribute('href', `#${symbolId(face)}`);
    t.el.classList.toggle('night', g.sideNames[side] === 'night');
    t.el.classList.toggle('soul', face === LOST);
    t.el.setAttribute('aria-label', FACES[face].name);
  }

  // Whether holding a tile shows it up close, in the magnifier given, or
  // (with none) turns it over to peek at the side it will turn to.
  setMagnifier(magnifier) {
    this.magnifier = magnifier;
    this.el.classList.toggle('magnifying', Boolean(magnifier));
  }

  // A tile held down. The magnifier shows whichever tile is under the
  // pointer, and follows it as it slides from tile to tile.
  hold(i) {
    if (!this.magnifier) {
      this.held = i;
      this.paint(i, 1);
      return;
    }
    const [x, y] = this.at;
    const under = document.elementFromPoint(x, y)?.closest('.tile');
    this.held = under && this.el.contains(under) ? Number(under.dataset.i) : i;
    this.magnifier.show(this.sidesOf(this.held), this.tileWidth, x, y);
  }

  // A tile's faces as the magnifier shows them, each [face, night]: the side
  // up and, before the tiles turn over, the side they will turn to.
  sidesOf(i) {
    const g = this.game;
    return (g.turnAhead ? [0, 1] : [g.side]).map((s) => [g.sides[s][i], g.sideNames[s] === 'night']);
  }

  // Brings every tile's state up to date: here or gone, free or blocked,
  // chosen.
  refresh() {
    const g = this.game;
    for (let i = 0; i < g.layout.count; i++) {
      const el = this.tiles[i].el;
      const here = g.present[i] === 1;
      const free = here && g.isFree(i);
      el.classList.toggle('gone', !here);
      el.classList.toggle('blocked', here && !free);
      if (!here) el.classList.remove('hint');
      el.classList.toggle('selected', i === this.selected);
      el.classList.toggle('unlocked', here && g.unlocked[i] === 1);
      el.tabIndex = free ? 0 : -1;
      el.setAttribute('aria-disabled', String(!free));
    }
  }

  press(i) {
    const g = this.game;
    if (this.busy || !g.present[i]) return;
    if (this.keying) {
      this.setKeying(false);
      if (!g.useKey(i)) this.say('That tile is free already: the key is still yours.');
      return;
    }
    if (!g.isFree(i)) {
      if (this.sound) this.sound.blocked();
      return this.restart(this.tiles[i].el, 'shake');
    }
    if (this.selected === i) return this.select(-1);
    if (this.selected >= 0 && g.canMatch(this.selected, i)) {
      const a = this.selected;
      this.selected = -1;
      g.match(a, i);
      return;
    }
    if (this.sound) this.sound.select();
    this.select(i);
  }

  select(i) {
    this.selected = i;
    this.refresh();
  }

  setKeying(on) {
    this.keying = on;
    this.el.classList.toggle('keying', on);
  }

  matched({ turned }) {
    if (turned) this.turnOver(0);
    this.refresh();
  }

  undone(entry) {
    this.selected = -1;
    if (entry.type === 'match') {
      this.paint(entry.a);
      this.paint(entry.b);
      if (entry.souls) this.turnOver(1);
    } else this.shuffled();
    this.refresh();
  }

  shuffled() {
    this.selected = -1;
    const g = this.game;
    for (let i = 0; i < g.layout.count; i++) {
      if (!g.present[i]) continue;
      this.restart(this.tiles[i].el, 'jiggle');
      setTimeout(() => this.paint(i), 140);
    }
    this.refresh();
  }

  // The tiles turn over, in a wave from left to right, showing the side
  // they were on until they reach the middle of their turn.
  turnOver(from) {
    const g = this.game;
    const L = g.layout;
    if (still()) {
      for (let i = 0; i < L.count; i++) if (g.present[i]) this.paint(i);
      return;
    }
    this.busy++;
    let last = 0;
    for (let i = 0; i < L.count; i++) {
      if (!g.present[i]) continue;
      this.paint(i, from);
      const delay = Math.round((L.x[i] / L.width) * 900 + L.z[i] * 60);
      last = Math.max(last, delay);
      const el = this.tiles[i].el;
      el.style.animationDelay = `${delay}ms`;
      this.restart(el, 'flip');
      setTimeout(() => this.paint(i), delay + 200);
    }
    setTimeout(() => this.busy--, last + 420);
  }

  // Shows the faces the tiles will turn over to, while the moon is held.
  peek(on) {
    const g = this.game;
    this.el.classList.toggle('peeking', on && g.turnAhead);
    for (let i = 0; i < g.layout.count; i++) if (g.present[i]) this.paint(i, on && g.turnAhead ? 1 : g.side);
  }

  // A hint: the planchette glides to one tile of the pair and then the
  // other, and the two of them glow.
  show(pair) {
    for (const i of pair) this.restart(this.tiles[i].el, 'hint');
    if (!this.planchette) {
      this.planchette = planchette();
      this.el.append(this.planchette);
      this.glide(this.el.offsetWidth / 2, this.el.offsetHeight + this.planchette.offsetHeight);
    }
    const p = this.planchette;
    clearTimeout(this.gliding);
    void p.offsetWidth;
    p.classList.add('on');
    this.glide(...this.centre(pair[0]));
    this.gliding = setTimeout(() => {
      this.glide(...this.centre(pair[1]));
      this.gliding = setTimeout(() => p.classList.remove('on'), 1500);
    }, 700);
  }

  // The middle of a tile on the board, or of the board itself.
  centre(i = -1) {
    if (i < 0) return [this.el.offsetWidth / 2, this.el.offsetHeight / 2];
    const t = this.tiles[i].el;
    return [t.offsetLeft + t.offsetWidth / 2, t.offsetTop + t.offsetHeight / 2];
  }

  // A few words, such as the points a move earned, rising from a tile or
  // the middle of the board and fading away.
  float(text, i = -1, cost = false) {
    const el = document.createElement('div');
    el.className = cost ? 'float cost' : 'float';
    el.textContent = text;
    el.setAttribute('aria-hidden', 'true');
    const [x, y] = this.centre(i);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.el.append(el);
    setTimeout(() => el.remove(), 1300);
  }

  // Moves the planchette so that its window sits over a point on the board.
  glide(x, y) {
    const p = this.planchette;
    p.style.transform = `translate(${x - p.offsetWidth / 2}px, ${y - p.offsetHeight * WINDOW}px)`;
  }

  // Plays an animation on a tile from the start, and takes it off at the end.
  restart(el, name) {
    if (still()) {
      if (name === 'hint') {
        el.classList.add('hint');
        setTimeout(() => el.classList.remove('hint'), 2400);
      }
      return;
    }
    el.classList.remove(name);
    void el.offsetWidth;
    el.classList.add(name);
    el.addEventListener(
      'animationend',
      () => {
        el.classList.remove(name);
        el.style.animationDelay = '';
      },
      { once: true },
    );
  }

  // Moves the keyboard's focus to the nearest free tile in a direction.
  move(key) {
    const g = this.game;
    const L = g.layout;
    const free = g.freeTiles();
    if (!free.length) return;
    const at = document.activeElement && document.activeElement.closest && document.activeElement.closest('.tile');
    if (!at) return this.tiles[free[0]].el.focus();
    const i = Number(at.dataset.i);
    const [dx, dy] = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
    let best = -1;
    let bestScore = Infinity;
    for (const j of free) {
      const vx = L.x[j] - L.x[i];
      const vy = L.y[j] - L.y[i];
      const along = vx * dx + vy * dy;
      if (j === i || along <= 0) continue;
      const score = along + 2 * Math.abs(vx * dy - vy * dx);
      if (score < bestScore) {
        best = j;
        bestScore = score;
      }
    }
    if (best >= 0) this.tiles[best].el.focus();
  }
}
