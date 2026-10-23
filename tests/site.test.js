import { test, check } from './run.js';

const text = async (path) => (await fetch(path)).text();

// Paths as sw.js lists them: from the folder the game is served from, which
// may be the root of the site or, on GitHub Pages, /boneyard-mahjong/.
const base = new URL('.', location.href).href;
const relative = (url) => (url.href.startsWith(base) ? url.href.slice(base.length) : url.href);

test('the service worker keeps every file the game loads', async () => {
  const listed = new Set([...(await text('sw.js')).matchAll(/^ {2}'([^']+)',$/gm)].map((m) => m[1]));
  // Every module, following the imports from main.js.
  const modules = new Set();
  const follow = async (path) => {
    if (modules.has(path)) return;
    modules.add(path);
    for (const [, spec] of (await text(path)).matchAll(/from '(\.[^']+)'/g)) {
      await follow(relative(new URL(spec, new URL(path, base))));
    }
  };
  await follow('js/main.js');
  for (const path of modules) check(listed.has(path), `${path} is not in sw.js`);
  // And everything index.html links to on this site.
  for (const [, href] of (await text('index.html')).matchAll(/(?:href|src)="([^"#:]+)"/g)) {
    check(listed.has(href), `${href} is not in sw.js`);
  }
  for (const path of listed) check((await fetch(path)).ok, `${path}, in sw.js, is not there`);
  return `${modules.size} modules, ${listed.size} files`;
});

test('every button in the bars has an icon and a word', async () => {
  const page = new DOMParser().parseFromString(await text('index.html'), 'text/html');
  const buttons = [...page.querySelectorAll('.bar button')];
  for (const b of buttons) {
    check(b.querySelector('.icon')?.textContent.trim(), `#${b.id} has no icon`);
    check(b.querySelector('.label')?.textContent.trim(), `#${b.id} has no word`);
  }
  return `${buttons.length} buttons`;
});
