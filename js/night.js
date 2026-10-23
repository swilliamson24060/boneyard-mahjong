import { PUMPKIN, CAT, TOMBSTONE, WEB, BAT, COFFIN, HOUSE, CAULDRON, HAT, SKULL, RAVEN, CRYPT, SUNRISE } from './engine/layouts.js';

// The Long Night: thirteen boards, one an hour from dusk to dawn. Treats
// begin at seven and floating ghosts at eight; from midnight every board
// turns over, after a different number of matches each hour, until at six
// the tiles start on their night side and turn back to day at sunrise.
//
// Each hour: its name; its board; the rules for Game (turn says after what
// share of the matches the tiles turn over); the sky behind it, top and
// bottom, darkening hour by hour and paling toward dawn; and what to tell
// the player before it starts.

const FROM_SEVEN = { treats: true };
const FROM_EIGHT = { treats: true, ghostsFloat: true };

export const HOURS = [
  {
    name: '6 pm',
    layout: PUMPKIN,
    rules: { treats: false, ghostsFloat: false },
    sky: ['#6e2f52', '#1d0f22'],
    title: 'Dusk',
    text: 'Take two free tiles that match. A tile is free when nothing lies on it and its left or right side is open.',
  },
  {
    name: '7 pm',
    layout: CAT,
    rules: { ...FROM_SEVEN, ghostsFloat: false },
    sky: ['#512756', '#170c1f'],
    title: 'Treats',
    text: "A pair of jack-o'-lanterns leaves a treat: a candle shows you a match, a skeleton key frees a blocked tile, a black cat shuffles for free.",
  },
  {
    name: '8 pm',
    layout: TOMBSTONE,
    rules: FROM_EIGHT,
    sky: ['#3a2253', '#120a1b'],
    title: 'Ghosts float',
    text: 'A ghost can be taken even when it is covered or hemmed in: nothing holds a ghost down.',
  },
  {
    name: '9 pm',
    layout: WEB,
    rules: FROM_EIGHT,
    sky: ['#2b2150', '#0e0918'],
    title: "The spider's web",
    text: 'The boards grow from here on. The spider sits in the middle of its web.',
  },
  {
    name: '10 pm',
    layout: BAT,
    rules: FROM_EIGHT,
    sky: ['#221d49', '#0b0815'],
    title: 'The bat',
    text: 'Its body is stacked five tiles high.',
  },
  {
    name: '11 pm',
    layout: COFFIN,
    rules: FROM_EIGHT,
    sky: ['#1b1a43', '#090712'],
    title: 'The coffin',
    text: 'One hour to midnight.',
  },
  {
    name: 'Midnight',
    layout: HOUSE,
    rules: { ...FROM_EIGHT, turn: 1 / 2 },
    sky: ['#15153c', '#06050c'],
    title: 'The stroke of twelve',
    text: 'Halfway through, the clock strikes and every tile turns over. Hold the moon, or Space, to see the night side: before midnight, take pairs that match on both sides. A tile left without a partner wakes as a lost soul, and lost souls match each other.',
  },
  {
    name: '1 am',
    layout: CAULDRON,
    rules: { ...FROM_EIGHT, turn: 2 / 3 },
    sky: ['#11133a', '#04030a'],
    title: 'The cauldron',
    text: 'The bell tolls late this hour: two thirds of the way through.',
  },
  {
    name: '2 am',
    layout: HAT,
    rules: { ...FROM_EIGHT, turn: 1 / 3 },
    sky: ['#0f1136', '#030309'],
    title: "The witch's hat",
    text: 'The bell tolls early: a third of the way through.',
  },
  {
    name: '3 am',
    layout: SKULL,
    rules: { ...FROM_EIGHT, turn: 1 / 2 },
    sky: ['#0d0e31', '#020207'],
    title: 'The witching hour',
    text: 'The bell tolls halfway through.',
  },
  {
    name: '4 am',
    layout: RAVEN,
    rules: { ...FROM_EIGHT, turn: 3 / 4 },
    sky: ['#131640', '#04040c'],
    title: 'The raven',
    text: 'A long day and a short night: the bell tolls three quarters of the way through.',
  },
  {
    name: '5 am',
    layout: CRYPT,
    rules: { ...FROM_EIGHT, turn: 1 / 4 },
    sky: ['#1f2552', '#080a19'],
    title: 'The crypt',
    text: 'A short day and a long night: the bell tolls a quarter of the way through.',
  },
  {
    name: '6 am',
    layout: SUNRISE,
    rules: { ...FROM_EIGHT, turn: 1 / 2, firstSide: 'night' },
    sky: ['#4a3460', '#17142b'],
    dawn: ['#c46f6a', '#33284a'],
    title: 'Dawn',
    text: 'The tiles start on their night side, and halfway through, at sunrise, they turn back to day.',
  },
];

// The options for Game for an hour: its rules, with the turn as a number of matches.
export function gameOptions(hour) {
  const { turn, ...rules } = HOURS[hour].rules;
  const pairs = HOURS[hour].layout.count / 2;
  return turn ? { ...rules, turnAt: Math.round(pairs * turn) } : rules;
}
