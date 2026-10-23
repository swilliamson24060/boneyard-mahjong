# Boneyard Mah Jong

A Halloween Mah Jong solitaire game for the web. [PLAN.md](PLAN.md) has the design and the schedule.

## Run it locally

ES modules need a web server (opening the files from the file system will not work):

```bash
python3 tools/serve.py
```

Then open http://localhost:8790 to play. `tools/serve.py` serves this folder with caching turned off, so a reload always picks up edited files; `python3 -m http.server` works too. The address keeps the board and the deal, as `#pumpkin-midnight/12345`, so a deal can be had again or shared.

## Playing

- Take two free tiles that match. A tile is free when nothing lies on it and its left or right side is open.
- Undo (U), Hint (H, costs 15 seconds), Shuffle (S, costs 30 seconds), a new deal (N). Arrow keys move between free tiles, and Enter takes one.
- On a board that turns over at midnight, hold the moon button or Space to see the night side, or press and hold one tile to see its own. Pairs that match on both sides are the ones to take before midnight.
- Pairs of jack-o'-lanterns leave treats: a candle shows a match, a skeleton key frees one blocked tile (press the key, then the tile), and a black cat shuffles for free.

## Tests and sheets

- http://localhost:8790/test.html runs the engine tests in the page; the tab's title shows the result. Below the results is a dealt turtle drawn plainly, with its free tiles outlined, for checking layouts by eye.
- http://localhost:8790/faces.html shows every face by day and by night, and small, at the size of a tile on an upright phone.

## Where things live

- `index.html`, `css/game.css` and `js/main.js`: the page, the buttons and keys, the clock and the messages.
- `js/ui/board.js`: the board on the page: the tiles stacked in their layers and sized to fit, selecting and matching, peeking, and the tiles turning over.
- `js/ui/faces.js`: the faces, drawn in code as SVG symbols, one drawing for both sides.
- `js/engine/tiles.js`: the 42 faces, which of them match, and the pairs a deal is made from.
- `js/engine/layout.js`: reading a layout drawn as text, and the free-tile rule. `layouts.js` holds the layouts themselves.
- `js/engine/deal.js`: dealing so that every board can be won, and the safe shuffle.
- `js/engine/solver.js`: finds a winning line, for hints and for checking twists.
- `js/engine/game.js`: one board in play: matching, undo, hints, shuffles, Ghosts float, Treats and the stroke of midnight, when the tiles turn over.
- `js/engine/midnight.js`: which tiles wake as lost souls when the tiles turn over.
- `js/engine/rng.js`: seeded randomness, so a deal can be made again from its seed.
- `tests/`: the engine tests, the small runner behind `test.html`, and the plain board drawing.
