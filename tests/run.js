// A small test runner for the browser. test() adds a test; run() runs them in
// order, lists the results in the page and puts the count in the tab's
// title, so a glance at the tab says whether everything passed. A test may
// return a short note, shown after its name.

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function check(ok, message) {
  if (!ok) throw new Error(message);
}

export function equal(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

export function throws(fn, pattern) {
  try {
    fn();
  } catch (err) {
    if (pattern.test(err.message)) return;
    throw new Error(`threw "${err.message}", not ${pattern}`);
  }
  throw new Error(`did not throw ${pattern}`);
}

export async function run(list, summary) {
  const results = [];
  for (const { name, fn } of tests) {
    const li = document.createElement('li');
    const t0 = performance.now();
    try {
      const note = await fn();
      results.push({ name, ok: true, note });
      li.className = 'pass';
      li.textContent = `✔ ${name}${note ? `: ${note}` : ''}`;
    } catch (err) {
      results.push({ name, ok: false, error: err.message });
      li.className = 'fail';
      li.textContent = `✘ ${name}: ${err.message}`;
      console.error(name, err);
    }
    const ms = document.createElement('span');
    ms.className = 'ms';
    ms.textContent = ` ${Math.round(performance.now() - t0)} ms`;
    li.append(ms);
    list.append(li);
    await new Promise((done) => setTimeout(done)); // let the page show each result as it comes
  }
  const failed = results.filter((r) => !r.ok).length;
  summary.textContent = failed ? `${failed} of ${results.length} failed` : `All ${results.length} passed`;
  document.title = `${failed ? '✘' : '✔'} ${summary.textContent} · Boneyard tests`;
  window.testResults = results;
  return results;
}
