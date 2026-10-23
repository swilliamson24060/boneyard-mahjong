# Boneyard Mah Jong

A Halloween Mah Jong solitaire game for the web. [PLAN.md](PLAN.md) has the design and the schedule.

## Run it locally

ES modules need a web server (opening the files from the file system will not work):

```bash
python3 tools/serve.py
```

Then open http://localhost:8790 to play. `tools/serve.py` serves this folder with caching turned off, so a reload always picks up edited files; `python3 -m http.server` works too.

## Playing

- The Long Night is thirteen boards, one an hour from 6 pm to 6 am. Each hour says what is new before it starts, and every hour reached can be played again from the night's card (☾). The board in play is kept as you go, so closing the page loses nothing.
- Take two free tiles that match. A tile is free when nothing lies on it and its left or right side is open.
- Undo (U), Hint (H, costs 15 seconds), Shuffle (S, costs 30 seconds), sound on and off (M). Arrow keys move between free tiles, and Enter takes one.
- From midnight the tiles turn over partway through each board. Hold the moon button or Space to see the night side, or press and hold one tile to see its own. Pairs that match on both sides are the ones to take before midnight.
- Pairs of jack-o'-lanterns leave treats: a candle shows a match, a skeleton key frees one blocked tile (press the key, then the tile), and a black cat shuffles for free.
- Any board can also be played freely by address: `#play/turtle` for the classic turtle, or `#play/raven/12345/40` for the raven, dealt from seed 12345, turning over after 40 matches. A new deal (N) deals it again.

## Offline, and on a phone's home screen

Once loaded, the game plays offline: `sw.js`, a service worker, keeps every file it needs, and the font. While there is a network it still fetches each file fresh, so a new version shows at once. A file added to the game must also be added to `FILES` in `sw.js`, with a new name for `CACHE`; the test page checks that nothing is missing. `manifest.webmanifest` lets a phone install it from the browser (Share, then Add to Home Screen, on an iPhone), with its own icon. `tools/icons.py` draws the icon in plain Python and writes `icons/`: `python3 tools/icons.py`.

## Tests and sheets

- http://localhost:8790/test.html runs the engine tests in the page; the tab's title shows the result. Below the results is a dealt turtle drawn plainly, with its free tiles outlined, for checking layouts by eye.
- http://localhost:8790/faces.html shows every face by day and by night, and small, at the size of a tile on an upright phone. Its switch shows them as each kind of colour blindness sees them, or with no colour at all (`faces.html?vision=achromatopsia`): every face reads by its shape alone.
- http://localhost:8790/boards.html shows the thirteen boards of the Long Night, dealt as they will be played.

## Where things live

- `index.html`, `css/game.css` and `js/main.js`: the page, the buttons and keys, the cards, the clock, the sky, and keeping the night between visits.
- `sw.js`, `manifest.webmanifest` and `icons/`: offline play, and installing the game as an app.
- `js/night.js`: the Long Night's thirteen hours: each one's board, rules, sky and the words before it.
- `js/ui/sound.js`: the sounds, made with Web Audio as they play: the tiles, the organ, the bells.
- `js/ui/board.js`: the board on the page: the tiles stacked in their layers and sized to fit, selecting and matching, peeking, the tiles turning over, and the planchette that points out a hint. Players who have asked their device for less motion get no shaking or turning waves.
- `js/ui/faces.js`: the faces, drawn in code as SVG symbols, one drawing for both sides.
- `js/engine/tiles.js`: the 42 faces, which of them match, and the pairs a deal is made from.
- `js/engine/layout.js`: reading a layout drawn as text, and the free-tile rule. `layouts.js` holds the layouts themselves.
- `js/engine/deal.js`: dealing so that every board can be won, and the safe shuffle.
- `js/engine/solver.js`: finds a winning line, for hints and for checking twists.
- `js/engine/game.js`: one board in play: matching, undo, hints, shuffles, Ghosts float, Treats and the stroke of midnight, when the tiles turn over.
- `js/engine/midnight.js`: which tiles wake as lost souls when the tiles turn over.
- `js/engine/rng.js`: seeded randomness, so a deal can be made again from its seed.
- `tests/`: the engine tests, the small runner behind `test.html`, and the plain board drawing.
