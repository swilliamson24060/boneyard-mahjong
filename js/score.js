// The score for a board, worked out from what the game already records, so
// it holds through undo and reloads. Each pair taken is worth points, and a
// cleared board more, with a bonus for every second under par. Shuffles and
// hints cost points. When the tiles turn over, a board that wakes no lost
// souls earns a bonus, and each lost soul costs a little. Treats are free,
// and so is undo, though a pair taken back takes its points with it.

export const POINTS = {
  pair: 10,
  clear: 250,
  second: 2, // for each second under par
  shuffle: -100,
  hint: -25,
  clean: 150, // turning over without one lost soul
  soul: -10, // each lost soul that wakes
};

// Par: five seconds a tile, or six on a board that turns over, as that wants planning.
export const par = (game) => game.layout.count * (game.sides.length > 1 ? 6 : 5);

// The score so far, as { total, rows }, each row [what, how, points]. The
// clearing and the speed bonus come in once the board is clear.
export function scoreOf(game, seconds) {
  const times = (n, each) => `${n} × ${Math.abs(each)}`;
  const pairs = (game.layout.count - game.left) / 2;
  const rows = [['Pairs', times(pairs, POINTS.pair), pairs * POINTS.pair]];
  const turn = game.history.find((e) => e.souls);
  if (turn) {
    const n = turn.souls.length;
    const when = game.sideNames[1] === 'night' ? 'Midnight' : 'Sunrise';
    rows.push(n ? ['Lost souls', times(n, POINTS.soul), n * POINTS.soul] : [`${when} with no lost souls`, '', POINTS.clean]);
  }
  if (game.shuffles) rows.push(['Shuffles', times(game.shuffles, POINTS.shuffle), game.shuffles * POINTS.shuffle]);
  if (game.hints) rows.push(['Hints', times(game.hints, POINTS.hint), game.hints * POINTS.hint]);
  if (game.won) {
    const under = Math.max(0, Math.floor(par(game) - seconds));
    rows.push(['Board cleared', '', POINTS.clear]);
    rows.push(['Speed', under ? `${under} s under par` : 'not under par', under * POINTS.second]);
  }
  return { total: rows.reduce((sum, row) => sum + row[2], 0), rows };
}
