import { test, check, equal } from './run.js';
import { HOURS, gameOptions } from '../js/night.js';
import { POINTS, par } from '../js/score.js';
import { Leaderboard, BOARDS, NIGHT, NAME, boardOf, nameProblem, tidy } from '../js/leaderboard.js';

const rot13 = (s) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));

test('a name may be in any language, 16 letters at most, and nothing rude', () => {
  for (const name of ['Sam', 'Zoë', 'Mary-Kate', "Jo O'Neil", 'R2D2', 'Ángel', '小明', 'Cassandra', 'Glass Bass', 'x'.repeat(16)]) {
    equal(nameProblem(name), '', name);
  }
  for (const name of ['', 'x'.repeat(17), '<b>Sam</b>', '-Sam', 'Sam!', `Sir ${rot13('nff')}`, rot13('s h p x')]) {
    check(nameProblem(name), `"${name}" should not do`);
  }
  equal(tidy('  Sam   the  Brave '), 'Sam the Brave', 'tidied');
});

test('every hour has a board, and firestore.rules knows each one as the game does', async () => {
  equal(BOARDS.length, HOURS.length + 1, 'boards');
  equal(new Set(BOARDS).size, BOARDS.length, 'different boards');
  equal(boardOf(6), 'midnight', 'the midnight board');
  const rules = await (await fetch('firestore.rules')).text();
  const listed = Object.fromEntries([...rules.matchAll(/'(\w+)': \[(\d+), (\d+), (\d+)\]/g)].map(([, b, ...n]) => [b, n.map(Number)]));
  let most = 0;
  HOURS.forEach((h, i) => {
    const tiles = h.layout.count;
    const turns = Boolean(gameOptions(i).turnAt);
    const p = par({ layout: h.layout, sides: turns ? [[], []] : [[]] });
    const base = tiles * 5 + POINTS.clear + (turns ? POINTS.clean : 0);
    equal(String(listed[boardOf(i)]), String([tiles, p, base]), `${h.name} in firestore.rules`);
    most += base + POINTS.second * (p - Math.ceil(tiles / 2));
  });
  equal(Number(rules.match(/d\.score <= (\d+);/)[1]), most, 'the most a night can score');
  equal(rules.match(/name\.matches\("([^"]+)"\)/)[1].replace(/\\\\/g, '\\'), NAME.source, 'the rule for names');
  return `${Object.keys(listed).length} hours, and a night of ${most.toLocaleString()} at most`;
});

// A stand-in for Firebase's REST APIs: it answers as they do, and keeps
// every request for the test to look at.
function fakeFirebase() {
  const calls = [];
  let tokens = 0;
  const fetch = async (url, { headers, body }) => {
    const call = { url, headers, body: headers['Content-Type'] === 'application/json' ? JSON.parse(body) : body };
    calls.push(call);
    const json = (status, answer) => ({ ok: status === 200, status, json: async () => answer });
    if (url.includes('accounts:signUp')) return json(200, { idToken: `token${++tokens}`, refreshToken: 'refresh1', expiresIn: '3600', localId: 'me' });
    if (url.includes('securetoken')) return json(200, { id_token: `token${++tokens}`, refresh_token: 'refresh2', expires_in: '3600', user_id: 'me' });
    if (url.endsWith(':batchWrite')) return json(403, { error: { status: 'PERMISSION_DENIED' } }); // as Firestore answers players
    if (url.endsWith(':commit')) {
      const [w] = call.body.writes;
      const refused = w.update && w.update.name.includes('/boards/night/'); // say the rules refuse the night
      return json(refused ? 403 : 200, refused ? { error: { status: 'PERMISSION_DENIED' } } : { writeResults: [{}] });
    }
    if (url.endsWith(':runQuery')) {
      const doc = (id, name, score) => ({ document: { name: `projects/p/databases/(default)/documents/boards/6pm/scores/${id}`, fields: { name: { stringValue: name }, score: { integerValue: String(score) } } } });
      return json(200, [doc('ann', 'Ann', 1200), doc('me', 'Sam', 900), { readTime: 'now' }]);
    }
    if (url.endsWith(':runAggregationQuery')) return json(200, [{ result: { aggregateFields: { n: { integerValue: '4' } } } }]);
    return json(404, { error: { message: 'no such thing' } });
  };
  const kept = new Map();
  const store = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) };
  return { calls, fetch, store };
}

test('the leaderboard signs in once, writes only as the player, and reads the boards', async () => {
  const fake = fakeFirebase();
  const board = new Leaderboard({ apiKey: 'key', projectId: 'p' }, fake);
  check(board.on && board.me === null, 'on, and no one yet');
  const entries = [
    { board: '6pm', name: 'Sam', score: 900, seconds: 300 },
    { board: NIGHT, name: 'Sam', score: 900, hours: 1 },
  ];
  equal((await board.post(entries)).length, 2, 'settled, one taken and one refused');
  equal(board.me, 'me', 'signed in');
  const [signUp, ...writes] = fake.calls;
  check(signUp.url.includes('accounts:signUp?key=key'), 'signed up anonymously');
  check(writes.length === 2 && writes.every((c) => c.url.endsWith(':commit') && c.body.writes.length === 1), 'a commit for each entry');
  equal(writes[0].headers.Authorization, 'Bearer token1', 'written as the player');
  const [hour, night] = writes.map((c) => c.body.writes[0]);
  equal(hour.update.name, 'projects/p/databases/(default)/documents/boards/6pm/scores/me', "the player's own entry");
  equal(hour.update.fields.score.integerValue, '900', 'the score');
  equal(hour.updateTransforms[0].fieldPath, 'at', "stamped with the server's time");
  check(night.update.fields.hours && !night.update.fields.seconds, 'the night has hours');

  await board.post(entries);
  equal(fake.calls.filter((c) => c.url.includes('signUp')).length, 1, 'signed in only once');

  const top = await board.top('6pm');
  equal(JSON.stringify(top[0]), JSON.stringify({ id: 'ann', name: 'Ann', score: 1200 }), 'the first place');
  const query = fake.calls.at(-1);
  check(query.url.endsWith('/documents/boards/6pm:runQuery'), 'the board asked');
  equal(query.headers.Authorization, undefined, 'read by anyone');
  equal(query.body.structuredQuery.orderBy[0].direction, 'DESCENDING', 'highest first');
  equal(await board.rank('6pm', 1000), 5, 'four higher');

  const again = new Leaderboard({ apiKey: 'key', projectId: 'p' }, fake);
  equal(again.me, 'me', 'the same player on the next visit');
  const before = fake.calls.length;
  await again.leave();
  const leaving = fake.calls.slice(before);
  const renewals = leaving.filter((c) => c.url.includes('securetoken'));
  check(renewals.length === 1 && renewals[0].body.includes('refresh_token=refresh1'), 'the sign-in renewed once for all the writes, not made again');
  equal(leaving.filter((c) => c.body.writes && c.body.writes[0].delete.endsWith('/scores/me')).length, BOARDS.length, 'taken off every board');
});

test('with no Firebase project there is no leaderboard', () => {
  equal(new Leaderboard({ apiKey: '', projectId: '' }).on, false, 'off');
});
