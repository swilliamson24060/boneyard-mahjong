// The sounds, made as they play with Web Audio, so there are no files to
// fetch: a wooden tock for a tile, a pipe organ that plays the opening of
// Bach's Toccata and Fugue in D minor a note for each match, the clock
// striking twelve at midnight, chimes at sunrise and for treats, and a
// rustle for a shuffle. Browsers let sound start only after a tap or a key,
// so nothing is made until then.

// The opening, a note for each match: the mordent on A and its run down to
// D, three times, an octave lower each time.
const TOCCATA = [81, 79, 81, 79, 77, 76, 74, 73, 74, 69, 67, 69, 64, 65, 61, 62, 57, 55, 57, 55, 53, 52, 50, 49, 50];

// The opening as it is played, for a cleared board: [note, beats], 0 a rest.
const OPENING = [
  [81, 0.25], [79, 0.25], [81, 1.5], [0, 0.5],
  [79, 0.25], [77, 0.25], [76, 0.25], [74, 0.25], [73, 0.75], [74, 1.5], [0, 0.5],
  [69, 0.25], [67, 0.25], [69, 1.5], [0, 0.5],
  [64, 0.25], [65, 0.25], [61, 0.75], [62, 1.5], [0, 0.5],
  [57, 0.25], [55, 0.25], [57, 1.5], [0, 0.5],
  [55, 0.25], [53, 0.25], [52, 0.25], [50, 0.25], [49, 0.75], [50, 1],
];

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.next = 0; // the next note of the Toccata
    try {
      this.muted = localStorage.getItem('boneyard.sound') === 'off';
    } catch {
      this.muted = false;
    }
    const wake = () => this.start();
    addEventListener('pointerdown', wake, { once: true, capture: true });
    addEventListener('keydown', wake, { once: true, capture: true });
  }

  start() {
    if (this.ctx) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);
    // A stone room for the organ and the bells to ring in.
    this.room = ctx.createConvolver();
    this.room.buffer = this.echo(2.8, 3.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.room.connect(wet).connect(this.master);
    this.bus = ctx.createGain();
    this.bus.connect(this.master);
    this.bus.connect(this.room);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      localStorage.setItem('boneyard.sound', muted ? 'off' : 'on');
    } catch {}
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  // A room's echo: noise dying away, a little different in each ear.
  echo(seconds, fall) {
    const rate = this.ctx.sampleRate;
    const n = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, n, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** fall;
    }
    return buf;
  }

  // Can sound be made now? Not before the first tap, nor while muted.
  get on() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return Boolean(this.ctx) && !this.muted;
  }

  get now() {
    return this.ctx.currentTime;
  }

  // A tone that dies away: the building block of most of what follows.
  ping(f, at, { type = 'sine', gain = 0.2, attack = 0.004, fall = 0.4, into = this.bus } = {}) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + fall);
    o.connect(g).connect(into);
    o.start(at);
    o.stop(at + attack + fall + 0.05);
  }

  // A note on a pipe organ: a few pipes sounding together, held, then let go.
  organ(midi, at, length, gain = 0.16) {
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0, at);
    out.gain.linearRampToValueAtTime(gain, at + 0.03);
    out.gain.setValueAtTime(gain, at + length);
    out.gain.exponentialRampToValueAtTime(0.0001, at + length + 0.4);
    out.connect(this.bus);
    for (const [k, a] of [[1, 1], [2, 0.55], [3, 0.3], [4, 0.22], [6, 0.1], [8, 0.07]]) {
      const o = this.ctx.createOscillator();
      o.frequency.value = hz(midi) * k;
      const g = this.ctx.createGain();
      g.gain.value = a / 2.3;
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + length + 0.45);
    }
  }

  // A bell: partials that are not quite in tune with each other, ringing long.
  bell(f, at, gain = 0.2, ring = 3) {
    for (const [k, a] of [[0.5, 0.5], [1, 1], [1.19, 0.45], [1.56, 0.35], [2, 0.3], [2.51, 0.2], [2.66, 0.18], [3.01, 0.12]]) {
      this.ping(f * k, at, { gain: gain * a, attack: 0.002, fall: ring / Math.sqrt(k) });
    }
  }

  // Noise through a moving filter: a rustle or a swish.
  rustle(at, length = 0.35, from = 800, to = 3000, gain = 0.12) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, at);
    f.frequency.exponentialRampToValueAtTime(to, at + length);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + length * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(f).connect(g).connect(this.master);
    src.start(at);
    src.stop(at + length + 0.05);
  }

  // ------------------------------------------------- what the game asks for

  select() {
    if (this.on) this.ping(720, this.now, { type: 'triangle', gain: 0.1, fall: 0.06, into: this.master });
  }

  blocked() {
    if (this.on) this.ping(150, this.now, { type: 'sine', gain: 0.18, fall: 0.12, into: this.master });
  }

  match() {
    if (!this.on) return;
    this.organ(TOCCATA[this.next % TOCCATA.length], this.now, 0.38);
    this.next++;
  }

  undo() {
    if (this.on) this.rustle(this.now, 0.22, 2400, 700, 0.08);
  }

  shuffle() {
    if (!this.on) return;
    for (let k = 0; k < 3; k++) this.rustle(this.now + k * 0.09, 0.3, 600, 3200, 0.1);
  }

  hint() {
    if (!this.on) return;
    this.ping(1318.5, this.now, { gain: 0.06, fall: 0.5 });
    this.ping(1975.5, this.now + 0.09, { gain: 0.05, fall: 0.6 });
  }

  treat() {
    if (!this.on) return;
    [1318.5, 1661.2, 1975.5, 2637].forEach((f, k) => this.ping(f, this.now + k * 0.07, { gain: 0.08, fall: 0.5 }));
  }

  // The clock strikes twelve.
  midnight() {
    if (!this.on) return;
    for (let k = 0; k < 12; k++) this.bell(196, this.now + k * 0.42, 0.13, 2.4);
  }

  sunrise() {
    if (!this.on) return;
    [587.3, 740, 880, 1174.7].forEach((f, k) => this.bell(f, this.now + k * 0.16, 0.08, 2));
  }

  stuck() {
    if (!this.on) return;
    this.organ(38, this.now, 1.2, 0.1);
    this.organ(45, this.now, 1.2, 0.08);
  }

  // A cleared board: the whole opening, then a chord to end on.
  win() {
    if (!this.on) return;
    const beat = 0.32;
    let at = this.now + 0.1;
    for (const [note, beats] of OPENING) {
      if (note) this.organ(note, at, beats * beat * 0.92, 0.14);
      at += beats * beat;
    }
    for (const note of [38, 50, 53, 57, 62]) this.organ(note, at, 2.2, 0.09);
    this.next = 0;
  }
}
