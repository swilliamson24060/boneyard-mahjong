# Boneyard Mah Jong: plan

A Halloween Mah Jong solitaire game for the web, to be live on Friday 30 October 2026.

The working title comes from the tiles: old Mah Jong sets really were carved from bone and backed with bamboo.

## The game

Classic Mah Jong solitaire. You clear a stacked layout by pairing matching tiles, and you can take a tile only when it's free: nothing on top of it, and its left or right side open. The 144 tiles have Halloween faces, the boards come as a run through one long night, and four twists make it more than a reskin.

## The tiles

| Traditional | Boneyard |
|---|---|
| Dots 1–9 | **Eyes**: the pips are eyeballs; the 1 is a single great staring eye |
| Bamboo 1–9 | **Bones**: the 1 is a crow, as the 1 of bamboo is a bird |
| Characters 1–9 | **Graves**: headstones carved with their numbers |
| Winds | **Monsters**: vampire, werewolf, mummy, zombie |
| Dragons | **Jack-o'-lantern, witch's brew, ghost**: orange, green and white, in place of the red, green and white dragons |
| Flowers | **The poison garden**: nightshade, foxglove, hemlock, wolfsbane; any two match |
| Seasons | **The moons**: new, waxing, full, waning; any two match |

- Every tile keeps a small corner index (3, E and so on), so Mah Jong players can read it at a glance.
- Each suit has its own colour and shape.
- The faces are SVG drawn in code: small, sharp at any size, and easy to recolour.
- The tone is spooky-fun rather than gory, with no jump scares, so it suits all ages.

## The twists

### Ghosts float

Ghost tiles can be taken even when they're covered or hemmed in. After midnight, the tiles that float are the ones showing a ghost.

### Treats

Hints and shuffles are always there but cost you points. Treats are free, and matching a pair of jack-o'-lanterns leaves one:

- a candle shows you a match
- a skeleton key frees one blocked tile
- a black cat knocks the tiles about: a free shuffle that keeps the board winnable

Undo never takes a treat back, and matching the same pair again after an undo doesn't earn a second one.

### Midnight

- **Two faces.** Every tile has a day face and a night face, both from the same 42, so there's no second set of tiles to learn. The night side is drawn glowing on dark tiles.
- **The clock.** It moves on with each match and shows how many matches are left until midnight. When it strikes twelve, every tile turns over, and from then on pairs go by their night faces.
- **Peeking.** Hold the moon button (or Space) to see the whole board's night side, or press and hold one tile. Nothing is hidden, so midnight is something to plan for rather than a trap: pairs that match on both sides are the ones to take before midnight. If four identical tiles are free, a peek shows which two.
- **Lost souls.** What you clear before midnight can leave a night face with no partner. That tile wakes as a lost soul, and lost souls pair with each other, so no tile is ever left with nothing to match.
- **Fair deals.** The deal generator deals both sides at once. It plays a game in reverse: the pairs it takes before midnight match on both sides, and the pairs it takes after match by night, their day faces paired at random. So every deal has a way through the stroke of twelve with no lost souls, and each side on its own is a full, normal set. The black cat and the ordinary shuffle deal both sides again the same way.
- **In trials** on the turtle, turning at the halfway mark: a player who takes pairs matching on both sides whenever there is one meets no lost souls on 143 boards in 150, and wins the night on 149. One who never peeks meets about 15, and can still win the night about as often as an ordinary board after the same number of careless moves.

### The Long Night

Thirteen boards, one an hour from 6 pm to 6 am. The sky behind the board darkens hour by hour and pales toward dawn, but nothing on the board is ever hidden.

| Hour | Board | What's new |
|---|---|---|
| 6 pm | Pumpkin | A small, gentle start |
| 7 pm | Black cat | Treats |
| 8 pm | Tombstone | Ghosts float |
| 9–11 pm | Spider's web, bat, coffin | Bigger, taller boards |
| Midnight | Haunted house | The clock strikes twelve halfway through, with a prompt to peek a few matches before |
| 1–5 am | Cauldron, witch's hat, skull, raven, crypt | Each board turns over partway through, at a different point each hour |
| 6 am | Rising sun | The board starts on its night side and turns back to day at sunrise |

The classic 144-tile turtle is there too, for wider screens.

## Scoring

| | Points |
|---|---|
| Each pair taken | +10 |
| Clearing the board | +250 |
| Speed | +2 for every second under par: 5 seconds a tile, 6 on a board that turns over |
| A shuffle | −100 |
| A hint | −25 |
| A black cat, a candle, a skeleton key | free: treats are the reward for jack-o'-lanterns |
| Undo | free, but a pair taken back takes its points with it |
| Turning over with no lost souls | +150 |
| Each lost soul that wakes | −10 |

- The clock shows real time, and hints and shuffles cost points rather than seconds, so nothing is charged twice.
- The score shows in the top bar and rises in small "+10"s and "−100"s from where they happen; the win card gives it line by line.
- The night's card keeps the best score for each hour, and a night score: those bests added up.
- A leaderboard, in Firebase, lists the best at each hour and the best night scores. Players join under a name of their own the first time they clear a board, and their bests go up as they make them. Each player can write only their own entries, which only get better, and Firestore's rules refuse any score faster than a pair a second could make.
- The score is worked out from what the game already records, so it holds through undo and reloads.
- The numbers are a starting point, to be tuned by playing.
- Later, perhaps: quick hands, a speed mode where pairs found quickly one after another are worth double, then triple.

## How it's built

- Plain HTML, CSS and ES modules: no build step and no libraries, served from any static host (GitHub Pages works). A small service worker makes it installable and playable offline.
- **The engine** (`js/engine/`) is plain JavaScript that never touches the page:
  - layouts on a half-tile grid with layers, and the free-tile rule
  - deals made by playing a game in reverse, so every deal has at least one way to win
  - match, undo and hints
  - a safe shuffle that deals the remaining tiles out again the same way, so the board can still be won
  - a solver that finds a winning line, for hints and for checking twists
  - seeded deals, so a board can be replayed or shared
- **The board**: each tile is an HTML button with its SVG face, stacked with offsets and shadows for the classic raised-tile look. Buttons give mouse, touch and keyboard play almost for free. Particles draw on a canvas over the board.
- **Sound**: synthesised with Web Audio (clicks, chimes, a pipe organ), so there are no sound files to host.
- **Saving**: settings, progress and best times in `localStorage`.
- **Tests**: `test.html` runs the engine tests in the browser.

## Milestones

| When | Milestone | Done when |
|---|---|---|
| Thu 22 Oct | Decisions | Twists chosen; title and tone still open |
| Fri 23 – Sat 24 | Engine | Free-tile rule, winnable deals, match, undo, hints, shuffle, Ghosts float and Treats, with the test page passing |
| Sun 25 | Midnight | Two-sided tiles, the stroke of twelve and lost souls; 1,000 Midnight deals all winnable |
| Mon 26 – Tue 27 | Board and tiles | 42 faces in day and night styles, the turning-over animation and peeking, played on desktop and on a phone |
| Wed 28 | The Long Night | All 13 boards, the clock, sound, the win screen, saved progress |
| Thu 29 | Polish | Smooth on phones; No Frights; colour-blind check; offline play; icons |
| Fri 30 | Ship | Live on a static host; Saturday stays spare |

**Fri 23 Oct:** shipped, eight days before Halloween: the game is live at https://swilliamson24060.github.io/boneyard-mahjong/. Then scoring, updates that reach players on their next load, a magnifier for small tiles and tired eyes, a word on every button, a leaderboard, in Firebase, the menu's plain ways between the Long Night and the turtle, or to give a board up, and a pause that hides the board.

**Thu 22 Oct:** everything up to shipping is done, seven days ahead. The Long Night's thirteen boards play from dusk to dawn, kept as you go, with sound. Once loaded the game plays offline and installs as an app with its own icon. Hints come by planchette, and the faces read by shape alone, with no colour. Players who ask their device for less motion get none. The game has only been tried at phone sizes in a desktop browser, so how smoothly it runs on a real phone is still to be seen. Shipping is next.

## Risks

- **Nine days.** The scope is fixed: four twists and thirteen boards. Everything else waits until November.
- **Midnight is the hardest piece.** Both sides have to be dealt fairly, and it has to be learnable in a single board. It gets its own engine day and its own tests, and the midnight board teaches it before the night boards lean on it.
- **If the schedule slips,** the 1–6 am boards wait for November. Midnight itself stays, on the midnight board.
- **Twists that make a board unwinnable.** A twist either only adds freedom, or the solver checks the board can still be won before it acts; if it can't, the safe shuffle steps in.
- **Phones held upright.** The classic layout is 15 tiles wide, too small to read comfortably on an upright phone, so the Long Night's boards stay about nine tiles across.
- **Telling 42 faces apart.** Playtest that early in the board milestone, not at the end.
- **Names.** Mah Jong solitaire itself is free to make, but trademarked names aren't: a hint can be a planchette without calling anything a Ouija board, which is Hasbro's trademark.

## Small touches

- A hint is a planchette gliding across the board to rest on a pair.
- A pause stops the clock and hides the board, and leaving the game for another app pauses it. The board is hidden whenever the clock stops on a board not yet cleared, so that a card over it is no way to study it for free.
- The night's board in play and the turtle's are both kept, so the menu goes from one to the other without losing either. A board can be given up and dealt again, and nothing that would throw away a board with moves on it happens without asking.
- Every button has a word as well as its icon, and on phones the icons are bigger, with the words under them, as in a phone's own apps. The treats' words say what they do (Free hint, Unlock, Free shuffle), and a treat with none in hand says what it does when tapped.
- Holding a tile shows it up close, above the finger that would otherwise hide it, with its night side beside it until the tiles turn over. It is on from the start on phones, whose tiles are small, and a switch on the night's card turns it on or off anywhere.
- Each match plays the next notes of Bach's Toccata and Fugue in D minor on a pipe organ, and clearing a board plays the whole opening. The music is long out of copyright.

## Parked for later

- **Spreading curse**: a curse creeps from tile to tile until you clear a pair beside it.
- **Masquerade**: tiles in costume show another tile's face until they're free and you touch them.
- **Night of the Living Tiles**: endless; tiles climb out of the graveyard in pairs.
- **Duel**: you and a ghost take turns on the same board.
- **Daily deal**: one deal a day, the same for everyone, with a result line to share.
- **Candlelight** was turned down: a dark board would irritate more than it scares.
