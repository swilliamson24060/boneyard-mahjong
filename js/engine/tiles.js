// The 144 tiles of a Boneyard set: 42 faces, and which of them match.
//
// Eyes, bones and graves stand in for dots, bamboo and characters, and the
// monsters for the four winds. The jack-o'-lantern, witch's brew and ghost
// take the places of the red, green and white dragons, the poison garden the
// flowers' and the moons the seasons'. Any two flowers match, and any two
// moons; every other face matches only itself.

const NUMBERS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const SUITS = [
  ['eyes', 'Eyes'],
  ['bones', 'Bones'],
  ['graves', 'Graves'],
];
const MONSTERS = [
  ['vampire', 'Vampire', 'E'],
  ['werewolf', 'Werewolf', 'S'],
  ['mummy', 'Mummy', 'W'],
  ['zombie', 'Zombie', 'N'],
];
const DRAGONS = [
  ['lantern', "Jack-o'-lantern"],
  ['brew', "Witch's brew"],
  ['ghost', 'Ghost'],
];
const FLOWERS = [
  ['nightshade', 'Nightshade'],
  ['foxglove', 'Foxglove'],
  ['hemlock', 'Hemlock'],
  ['wolfsbane', 'Wolfsbane'],
];
const MOONS = [
  ['new-moon', 'New moon'],
  ['waxing-moon', 'Waxing moon'],
  ['full-moon', 'Full moon'],
  ['waning-moon', 'Waning moon'],
];

// Each face has an id, a key, a name, its group, the small index printed in
// its corner, and its kind: faces of one kind match each other.
export const FACES = [];
export const KINDS = [];

function kind(key, name) {
  const k = { id: KINDS.length, key, name, faces: [] };
  KINDS.push(k);
  return k;
}

function face(k, key, name, group, index) {
  const f = { id: FACES.length, key, name, group, index, kind: k.id };
  FACES.push(f);
  k.faces.push(f.id);
}

for (const [suit, title] of SUITS) {
  NUMBERS.forEach((number, n) => {
    const key = `${suit}-${n + 1}`;
    const name = `${number} of ${title}`;
    face(kind(key, name), key, name, suit, String(n + 1));
  });
}
for (const [key, name, index] of MONSTERS) face(kind(key, name), key, name, 'monster', index);
for (const [key, name] of DRAGONS) face(kind(key, name), key, name, 'dragon', '');
const flower = kind('flower', 'Flower');
FLOWERS.forEach(([key, name], n) => face(flower, key, name, 'flower', String(n + 1)));
const moon = kind('moon', 'Moon');
MOONS.forEach(([key, name], n) => face(moon, key, name, 'moon', String(n + 1)));

export const FACE = Object.fromEntries(FACES.map((f) => [f.key, f.id]));
export const MATCH = Int8Array.from(FACES, (f) => f.kind);
export const GHOST = FACE.ghost;
export const LANTERN = FACE.lantern;

// The pairs a deal is made from: n of the 72 pairs in a full set. A board of
// fewer than 144 tiles takes one pair of every kind before any kind twice, so
// a small board still shows the whole set.
export function dealPairs(r, n) {
  if (n > 72) throw new Error(`A set has 72 pairs, not ${n}`);
  const first = [];
  const second = [];
  for (const k of KINDS) {
    if (k.faces.length === 1) {
      const f = k.faces[0];
      first.push([f, f]);
      second.push([f, f]);
    } else {
      const [a, b, c, d] = r.shuffle(k.faces.slice());
      first.push([a, b]);
      second.push([c, d]);
    }
  }
  return r.shuffle(first).concat(r.shuffle(second)).slice(0, n);
}
