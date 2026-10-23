import { test, check, equal } from './run.js';
import { spot } from '../js/ui/magnifier.js';

// The magnifier's size on a phone, as the page draws it: one side, and two
// with an arrow between them, in a row and in a column.
const ONE = { row: [152, 187], column: [152, 187] };
const TWO = { row: [304, 187], column: [152, 378] };

// How far a point is from a box, [left, top, width, height]: 0 inside it.
function distance(x, y, [left, top, w, h]) {
  const dx = Math.max(left - x, 0, x - (left + w));
  const dy = Math.max(top - y, 0, y - (top + h));
  return Math.hypot(dx, dy);
}

test('the magnifier sits above the finger when there is room', () => {
  const s = spot(TWO, 195, 600, 390, 844);
  equal(s.stacked, false, 'in a row');
  equal(s.scale, 1, 'its scale');
  equal(s.top + 187, 600 - 40, 'its foot');
  equal(s.left, 195 - 304 / 2, 'its left side');
});

test('wherever a phone is held, the magnifier is on the screen, clear of the finger and big', () => {
  let smallest = 1;
  const screens = [[360, 740], [375, 667], [390, 844], [430, 932], [667, 375], [844, 390]];
  for (const [W, H] of screens) {
    for (const sizes of [ONE, TWO]) {
      for (let x = 10; x <= W - 10; x += 5) {
        for (let y = 60; y <= H - 40; y += 5) {
          const s = spot(sizes, x, y, W, H);
          const [w, h] = sizes[s.stacked ? 'column' : 'row'].map((n) => n * s.scale);
          const where = `${W} by ${H}, ${sizes === ONE ? 'one side' : 'two sides'}, finger at ${x}, ${y}`;
          check(s.left >= 8 && s.top >= 8 && s.left + w <= W - 7 && s.top + h <= H - 7, `off the screen: ${where}`);
          check(distance(x, y, [s.left, s.top, w, h]) >= 36, `under the finger: ${where}`);
          check(s.scale >= 0.6, `only ${s.scale.toFixed(2)} of its size: ${where}`);
          smallest = Math.min(smallest, s.scale);
        }
      }
    }
  }
  return `${screens.length} screens, never under ${Math.round(smallest * 100)}% of its size`;
});
