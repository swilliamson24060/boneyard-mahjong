import { test, equal } from './run.js';
import { parseLayout } from '../js/engine/layout.js';
import { TURTLE } from '../js/engine/layouts.js';
import { FACE } from '../js/engine/tiles.js';
import { Game } from '../js/engine/game.js';
import { POINTS, par, scoreOf } from '../js/score.js';

const facesOf = (...keys) => keys.map((key) => FACE[key]);

// Two rows of two: by day each row is a pair.
const rows = () => parseLayout('rows', ['##.##']);
const dayRows = () => facesOf('eyes-1', 'eyes-1', 'eyes-2', 'eyes-2');

test('each pair is worth ten, and a pair taken back takes its points with it', () => {
  const g = new Game(rows(), { faces: dayRows() });
  g.match(0, 1);
  equal(scoreOf(g, 0).total, 10, 'one pair');
  g.undo();
  equal(scoreOf(g, 0).total, 0, 'taken back');
});

test('a cleared board earns its bonus, and two points for each second under par', () => {
  const g = new Game(rows(), { faces: dayRows() });
  g.match(0, 1);
  g.match(2, 3);
  equal(par(g), 20, 'par for four tiles');
  equal(scoreOf(g, 13).total, 2 * 10 + 250 + 7 * 2, 'seven seconds under par');
  equal(scoreOf(g, 25).total, 2 * 10 + 250, 'over par');
});

test('shuffles and hints cost points, and a black cat costs nothing', () => {
  const g = new Game(TURTLE, { seed: 6 });
  g.shuffle();
  g.hint();
  equal(scoreOf(g, 0).total, POINTS.shuffle + POINTS.hint, 'a shuffle and a hint');
  g.treats.cat = 1;
  g.shuffle({ cat: true });
  equal(scoreOf(g, 0).total, POINTS.shuffle + POINTS.hint, 'and then a black cat');
});

test('turning over without a lost soul earns a bonus, and each lost soul costs ten', () => {
  const clean = new Game(rows(), { sides: [dayRows(), facesOf('vampire', 'vampire', 'werewolf', 'werewolf')], turnAt: 1 });
  clean.match(0, 1);
  equal(scoreOf(clean, 0).total, 10 + POINTS.clean, 'no lost souls');
  const lost = new Game(rows(), { sides: [dayRows(), facesOf('vampire', 'werewolf', 'vampire', 'werewolf')], turnAt: 1 });
  lost.match(0, 1);
  equal(scoreOf(lost, 0).total, 10 + 2 * POINTS.soul, 'two lost souls');
  lost.undo();
  equal(scoreOf(lost, 0).total, 0, 'undone, the tiles turned back');
});

test('par is five seconds a tile, six on a board that turns over', () => {
  equal(par(new Game(TURTLE, { seed: 1 })), 720, 'the turtle');
  equal(par(new Game(TURTLE, { seed: 1, turnAt: 36 })), 864, 'the turtle at midnight');
});
