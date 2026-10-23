import { HOURS } from './night.js';
import { Firebase, value } from './firebase.js';
import { FIREBASE } from './firebase-config.js';

// The leaderboard: a board for each hour of the Long Night, listing each
// player's best score there, and one for the whole night, where a player's
// bests at every hour are added up. Players choose a name to be listed
// under, and their bests go up as they make them. firestore.rules keeps each
// player to their own entries, which can only get better.

export const NIGHT = 'night';
export const boardOf = (hour) => HOURS[hour].name.toLowerCase().replace(/ /g, '');
export const BOARDS = [NIGHT, ...HOURS.map((h, i) => boardOf(i))];
export const nameOf = (board) => (board === NIGHT ? 'Night' : HOURS[BOARDS.indexOf(board) - 1].name);

// A name as the leaderboard takes it: letters and digits from any language,
// with spaces, dots, apostrophes, hyphens and underscores after the first,
// and 16 in all at most. firestore.rules holds the same rule.
export const NAME = /^[\p{L}\p{N}][\p{L}\p{N} .'_-]{0,15}$/u;

// Words no name may hold, kept in rot13 so that the source does not spell
// them out: each checked as a word, and the worst also run together. The
// list is short, and the Firebase console can take down what it misses.
const rot13 = (s) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
const RUDE = new Set(
  'shpx fuvg phag ovgpu qvpx pbpx chffl juber fyhg gjng jnax jnaxre cevpx onfgneq nffubyr nefr nff cvff avttre avttn snttbg snt ergneq encr encvfg anmv uvgyre cravf intvan cbea frk obbo obbof gvgf phz wvmm qvyqb xvxr fcvp puvax'
    .split(' ')
    .map(rot13),
);
const WORST = 'shpx phag avttre avttn snttbg'.split(' ').map(rot13);

function rude(name) {
  const lower = name.toLowerCase();
  const squashed = lower.replace(/[^\p{L}]/gu, '');
  return lower.split(/[^\p{L}]+/u).some((w) => RUDE.has(w)) || WORST.some((w) => squashed.includes(w));
}

// A name as typed, with its spaces tidied.
export const tidy = (name) => name.trim().replace(/\s+/g, ' ');

// What is wrong with a name, or '' if nothing.
export function nameProblem(name) {
  if (!name) return 'Your name needs a letter or two.';
  if ([...name].length > 16) return 'That name is too long: 16 letters at most.';
  if (!NAME.test(name)) return 'Letters, numbers and spaces only, please, beginning with a letter or a number.';
  if (rude(name)) return 'Please choose another name.';
  return '';
}

export class Leaderboard {
  constructor(config = FIREBASE, options = {}) {
    this.on = Boolean(config.apiKey && config.projectId);
    this.firebase = this.on ? new Firebase(config, options) : null;
  }

  // The player's id on the leaderboard, once they have posted from here.
  get me() {
    return this.firebase ? this.firebase.uid : null;
  }

  // The best on a board, highest first: [{ id, name, score }].
  top(board, n = 10) {
    return this.firebase.query(`boards/${board}/scores`, {
      orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }],
      limit: n,
    });
  }

  // Where a score stands on a board: first, after any that are higher.
  async rank(board, score) {
    const higher = { fieldFilter: { field: { fieldPath: 'score' }, op: 'GREATER_THAN', value: value(score) } };
    return 1 + (await this.firebase.count(`boards/${board}/scores`, { where: higher }));
  }

  // Posts the player's bests, each { board, name, score } with `seconds` for
  // an hour and `hours` for the night. Answers with the ones that are
  // settled: taken, or refused by the rules, so not worth sending again.
  async post(entries) {
    await this.firebase.idToken(); // signed in, so that the paths can name the player
    const uid = this.me;
    const codes = await this.firebase.write(entries.map(({ board, ...entry }) => ({ path: `boards/${board}/scores/${uid}`, fields: entry })));
    return entries.filter((e, k) => codes[k] === 0 || codes[k] === 7);
  }

  // Takes the player's entries down from every board.
  async leave() {
    if (!this.me) return;
    const uid = this.me;
    await this.firebase.write(BOARDS.map((board) => ({ path: `boards/${board}/scores/${uid}`, remove: true })));
  }
}
