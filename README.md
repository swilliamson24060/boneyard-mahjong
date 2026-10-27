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
- The menu (☾) goes from the Long Night to the turtle and back: Play the turtle, and Back to the Long Night. The board in play in each is kept, so going to one never loses the other. Give up this board deals the board in play again, and anything that would throw away a board with moves on it asks first; choosing the hour you are playing just goes back to it.
- Take two free tiles that match. A tile is free when nothing lies on it and its left or right side is open. The blocked tiles are dimmed, so that only the free ones need looking over (the switch for it is on the night's card), and each tile's number or letter is printed big in its corner, to read without counting eyes or bones.
- Hold a tile to see it up close, above your finger, and slide to look at the tiles around it. On a phone this is on from the start; the switch on the night's card (☾) turns it on or off on any screen.
- Pause (P) stops the clock and hides the board until you come back, and the game pauses by itself when you leave it for another app or tab. Whenever the clock is stopped on a board not yet cleared, behind the menu or an hour's first card as well, the board is hidden, so that no one can study it for nothing.
- Undo (U), Hint (H), Shuffle (S), Pause (P), sound on and off (M). Arrow keys move between free tiles, and Enter takes one. Every button has a word as well as its icon: beside it on a wide screen, under it on a phone.
- Each pair is worth 10 points and a cleared board 250, with 2 more for every second under par. A shuffle costs 100 and a hint 25; treats and undo are free. Turning over at midnight without a lost soul earns 150, and each lost soul costs 10. `js/score.js` holds the numbers, and PLAN.md the reasons.
- From midnight the tiles turn over partway through each board. Hold the moon button or Space to see the night side. A tile held up close shows its night side beside it, or with the magnifier off, turns over while you hold it. Pairs that match on both sides are the ones to take before midnight.
- Pairs of jack-o'-lanterns leave treats, whose buttons say what they do: a candle is a free hint, a skeleton key unlocks one blocked tile (press Unlock, then the tile), and a black cat is a free shuffle. A treat you have none of says what it does when you tap it.
- Any board can also be played freely by address: `#play/turtle` for the classic turtle, or `#play/raven/12345/40` for the raven, dealt from seed 12345, turning over after 40 matches. A new deal (N) deals it again. The board played freely is kept like the night's, so a reload goes on with it.
- The leaderboard, on the night's card, lists the best scores at each hour of the Long Night, and for the whole night: each player's bests added up. The first time you clear a board, its card offers to put you on it under a name of your choosing, and from then on your bests go up as you make them. Your name can be changed, or taken off with your scores, from the leaderboard's card. Free play doesn't count.

## The leaderboard

The leaderboard lives in [Firebase](https://firebase.google.com): players sign in anonymously, which gives each browser an id of its own and no account to make, and the scores are kept in Firestore, at `boards/{board}/scores/{player}`, one entry a player on each board, holding their best. The game speaks to both through their REST APIs (`js/firebase.js`), so it needs no Firebase library.

[firestore.rules](firestore.rules) says what players may do: anyone may read the boards, and each player may write only their own entries, which can only get better. A score must also be one its board could give at the fastest a hand could clear it, a pair a second, so the rules hold each board's tiles and par; test.html checks them against the game's own, and they need publishing again if the boards change. That stops impossible scores, not every made-up one: anything that shouldn't be there can be deleted in the Firebase console, under Firestore Database, Data.

`js/firebase-config.js` names the project, `boneyard-mahjong`; without one, the game shows no leaderboard. Setting one up again, in the [Firebase console](https://console.firebase.google.com), takes five steps. The console's menus move about, but within a project its address is `console.firebase.google.com/project/<project id>/...`, and the pages below can be reached by changing the end of it:

1. Create a project. Google Analytics isn't needed, and the free plan is plenty.
2. Authentication (`authentication/providers`): Get started, then under Sign-in method turn on Anonymous. Leave its automatic clean-up off: a player whose anonymous account had been deleted could no longer change their own entries.
3. Firestore Database (`firestore`): Create database, keeping the id `(default)` and the Standard edition, in a location near your players, in production mode.
4. In Firestore Database, under Rules: replace what's there with the whole of `firestore.rules`, and Publish.
5. Project settings (`settings/general`), Your apps: add a Web app (no Firebase Hosting; npm or a script tag, it doesn't matter, as the game uses neither) and copy its `apiKey` and `projectId` into `js/firebase-config.js`. Neither is a secret: every web app sends them from the browser, and the rules decide what anyone can do.

## Online

The game lives at https://swilliamson24060.github.io/boneyard-mahjong/, served by GitHub Pages from the `main` branch of this repository, as it is: `.nojekyll` keeps GitHub from processing it. Pushing `main` puts a new version online within a minute or two, and players get it the next time they load the game with a network.

## On itch.io

`python3 tools/itch.py` bundles the game for itch.io as `dist/boneyard-mahjong.zip`: `index.html` at its root, every file the game loads (the list in `sw.js`, with `sw.js` itself) and nothing else. The zip is built, not kept in git, so build it again after a change. On itch.io:

1. Create a new project, with Kind of project set to HTML.
2. Under Uploads, upload the zip, and tick This file will be played in the browser.
3. Under Embed options, a viewport of 960 by 640 suits it, though the game fits whatever size it is given; tick Mobile friendly, and Fullscreen button.
4. Save, and view the page.

`python3 tools/shots.py` makes the page's pictures in `dist/itch/`, from the game as it is, in a few seconds: the cover, 630 by 500 as itch.io asks, and five screenshots, three from a computer and two from a phone. `tools/cover.html` draws the cover from the game's own tiles and lettering, and `tools/stage.html` sets up each screenshot's scene with moves from the game's own winning line, so they come out the same each time, and anew after a change. It needs Google Chrome, which draws the pictures headless (or the `CHROME` variable saying where a Chrome is), and macOS's `sips`, to cut out the phone pictures.

There the game plays in a frame in itch.io's page, so it leaves out its service worker: playing offline is for the game at its own address. Its leaderboard is the same one, but its players are new there, as a browser keeps a game's saved night, and its place on the leaderboard, apart for each site.

## Offline, and on a phone's home screen

Once loaded, the game plays offline: `sw.js`, a service worker, keeps every file it needs, and the font. While there is a network it still asks the server for each file, rather than trusting the browser's ten-minute copy, so a new version shows on the next load. A file added to the game must also be added to `FILES` in `sw.js`, with a new name for `CACHE`; the test page checks that nothing is missing. `manifest.webmanifest` lets a phone install it from the browser (Share, then Add to Home Screen, on an iPhone), with its own icon. `tools/icons.py` draws the icon in plain Python and writes `icons/`: `python3 tools/icons.py`.

## Tests and sheets

- http://localhost:8790/test.html runs the engine tests in the page; the tab's title shows the result. Below the results is a dealt turtle drawn plainly, with its free tiles outlined, for checking layouts by eye.
- http://localhost:8790/faces.html shows every face by day and by night, and small, at the size of a tile on an upright phone. Its switch shows them as each kind of colour blindness sees them, or with no colour at all (`faces.html?vision=achromatopsia`): every face reads by its shape alone.
- http://localhost:8790/boards.html shows the thirteen boards of the Long Night, dealt as they will be played.

## Where things live

- `index.html`, `css/game.css` and `js/main.js`: the page, the buttons and keys, the cards, the clock, the sky, and keeping the night between visits.
- `sw.js`, `manifest.webmanifest` and `icons/`: offline play, and installing the game as an app.
- `tools/itch.py`: the zip for itch.io, and `tools/shots.py`, with `tools/cover.html` and `tools/stage.html`, its cover and screenshots.
- `js/night.js`: the Long Night's thirteen hours: each one's board, rules, sky and the words before it.
- `js/score.js`: the score for a board, worked out from what the game records.
- `js/leaderboard.js`: the leaderboard's boards, the names it takes, and posting and reading scores; `js/firebase.js` speaks to Firebase, and `js/firebase-config.js` says which project. `firestore.rules` is what Firestore lets players do.
- `js/ui/sound.js`: the sounds, made with Web Audio as they play: the tiles, the organ, the bells.
- `js/ui/board.js`: the board on the page: the tiles stacked in their layers and sized to fit, selecting and matching, peeking, the tiles turning over, and the planchette that points out a hint. Players who have asked their device for less motion get no shaking or turning waves.
- `js/ui/faces.js`: the faces, drawn in code as SVG symbols, one drawing for both sides.
- `js/ui/magnifier.js`: a held tile up close, above the finger that would hide it, with the side it will turn to.
- `js/engine/tiles.js`: the 42 faces, which of them match, and the pairs a deal is made from.
- `js/engine/layout.js`: reading a layout drawn as text, and the free-tile rule. `layouts.js` holds the layouts themselves.
- `js/engine/deal.js`: dealing so that every board can be won, and the safe shuffle.
- `js/engine/solver.js`: finds a winning line, for hints and for checking twists.
- `js/engine/game.js`: one board in play: matching, undo, hints, shuffles, Ghosts float, Treats and the stroke of midnight, when the tiles turn over.
- `js/engine/midnight.js`: which tiles wake as lost souls when the tiles turn over.
- `js/engine/rng.js`: seeded randomness, so a deal can be made again from its seed.
- `tests/`: the engine tests, the small runner behind `test.html`, and the plain board drawing.
