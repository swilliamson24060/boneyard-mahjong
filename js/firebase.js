// Firebase, spoken to through its REST APIs rather than its SDK, so that the
// game stays free of libraries. A player signs in anonymously, which gives
// each browser an id of its own with no account to make, and the leaderboard
// lives in Firestore, where firestore.rules says who may write what.

const SIGN_UP = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp';
const REFRESH = 'https://securetoken.googleapis.com/v1/token';
const KEPT = 'boneyard.firebase'; // the sign-in, kept between visits

export class Firebase {
  constructor({ apiKey, projectId }, { fetch = (...args) => globalThis.fetch(...args), store = globalThis.localStorage } = {}) {
    this.key = apiKey;
    this.root = `projects/${projectId}/databases/(default)/documents`;
    this.base = `https://firestore.googleapis.com/v1/${this.root}`;
    this.fetch = fetch;
    this.store = store;
    this.token = null; // { id, until }
    try {
      this.session = JSON.parse(store.getItem(KEPT));
    } catch {
      this.session = null;
    }
  }

  // The player's id, once they have signed in on this browser.
  get uid() {
    return this.session ? this.session.uid : null;
  }

  // A token that shows Firestore who the player is: signing in the first
  // time, and after that renewing the token, which lasts an hour. Writes
  // made at once share one signing in.
  async idToken() {
    if (this.token && Date.now() < this.token.until) return this.token.id;
    if (!this.signing) this.signing = this.signIn().finally(() => (this.signing = null));
    return this.signing;
  }

  async signIn() {
    let answer = null;
    if (this.session) {
      try {
        const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(this.session.refresh)}`;
        const r = await this.call(`${REFRESH}?key=${this.key}`, body, { form: true });
        answer = { idToken: r.id_token, refreshToken: r.refresh_token, expiresIn: r.expires_in, localId: r.user_id };
      } catch (err) {
        if (!err.status) throw err; // no network: try again another time
        // Otherwise the sign-in is no good (taken down in the console, say), so sign in afresh.
      }
    }
    if (!answer) answer = await this.call(`${SIGN_UP}?key=${this.key}`, { returnSecureToken: true });
    this.session = { uid: answer.localId, refresh: answer.refreshToken };
    try {
      this.store.setItem(KEPT, JSON.stringify(this.session));
    } catch {}
    this.token = { id: answer.idToken, until: Date.now() + (Number(answer.expiresIn) - 60) * 1000 };
    return this.token.id;
  }

  // The documents a structured query finds in a collection, as plain
  // objects with their ids: [{ id, ...fields }].
  async query(collection, query) {
    const [parent, id] = split(collection);
    const rows = await this.call(`${this.base}${parent}:runQuery`, { structuredQuery: { from: [{ collectionId: id }], ...query } });
    return rows.filter((r) => r.document).map((r) => ({ id: r.document.name.split('/').pop(), ...unfields(r.document.fields) }));
  }

  // How many documents a structured query finds in a collection.
  async count(collection, query) {
    const [parent, id] = split(collection);
    const [row] = await this.call(`${this.base}${parent}:runAggregationQuery`, {
      structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: id }], ...query }, aggregations: [{ alias: 'n', count: {} }] },
    });
    return Number(row.result.aggregateFields.n.integerValue);
  }

  // Writes as the player: each write { path, fields } sets a document, its
  // `at` stamped with the server's time, and { path, remove: true } deletes
  // one. Each write is committed on its own, side by side with the others,
  // so that each stands or falls alone (Firestore's batch writes are for
  // servers, and refuse players outright). The answer gives each one's
  // status: 0 if it was taken, 7 if the rules would not have it, or else the
  // HTTP status of whatever went wrong, worth trying again later.
  async write(writes) {
    return Promise.all(
      writes.map(async (w) => {
        const write = w.remove
          ? { delete: `${this.root}/${w.path}` }
          : { update: { name: `${this.root}/${w.path}`, fields: fields(w.fields) }, updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }] };
        try {
          await this.call(`${this.base}:commit`, { writes: [write] }, { auth: true });
          return 0;
        } catch (err) {
          if (!err.status) throw err; // no network: the lot goes again later
          return err.status === 403 ? 7 : err.status;
        }
      }),
    );
  }

  async call(url, body, { auth = false, form = false } = {}) {
    const headers = { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' };
    if (auth) headers.Authorization = `Bearer ${await this.idToken()}`;
    const response = await this.fetch(url, { method: 'POST', headers, body: form ? body : JSON.stringify(body) });
    const answer = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error((answer.error && answer.error.message) || `HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return answer;
  }
}

// A collection's path as the query endpoints want it: the document it hangs
// from, and its own name.
function split(path) {
  const at = path.lastIndexOf('/');
  return at < 0 ? ['', path] : [`/${path.slice(0, at)}`, path.slice(at + 1)];
}

// Values in Firestore's own form, and back: only what the leaderboard keeps.
export function value(v) {
  if (typeof v === 'string') return { stringValue: v };
  if (Number.isInteger(v)) return { integerValue: String(v) };
  return { doubleValue: v };
}

function plain(v) {
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('booleanValue' in v) return v.booleanValue;
  return null;
}

export const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, value(v)]));
export const unfields = (f = {}) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, plain(v)]));
