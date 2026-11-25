// Ścieżka dźwiękowa filmu: głos Mikołaja + efekty + cicha muzyka (generowana, bez plików i praw autorskich).

export const OUT_RATE = 48000; // 48 kHz pasuje i do AAC, i do Opus
export const PITCH = 0.87;   // < 1 = niższy, cieplejszy i wolniejszy głos
export const INTRO = 3.4;    // sekundy muzyki i dzwonków przed pierwszym słowem
export const OUTRO = 4.5;    // sekundy po ostatnim słowie

// "Cicha noc" (F. X. Gruber, 1818 – domena publiczna). [nuta MIDI, długość w ósemkach]
const MELODY = [
  [67, 3], [69, 1], [67, 2], [64, 6], [67, 3], [69, 1], [67, 2], [64, 6],
  [74, 4], [74, 2], [71, 6], [72, 4], [72, 2], [67, 6],
  [69, 4], [69, 2], [72, 3], [71, 1], [69, 2], [67, 3], [69, 1], [67, 2], [64, 6],
  [69, 4], [69, 2], [72, 3], [71, 1], [69, 2], [67, 3], [69, 1], [67, 2], [64, 6],
  [74, 4], [74, 2], [77, 3], [74, 1], [71, 2], [72, 6], [76, 6],
  [72, 3], [67, 1], [64, 2], [67, 3], [65, 1], [62, 2], [60, 12],
];
// akordy na każdy takt 6/8 (12 taktów)
const CHORDS = [
  [48, 52, 55], [48, 52, 55], [43, 47, 53], [48, 52, 55], [41, 45, 48], [48, 52, 55],
  [41, 45, 48], [48, 52, 55], [43, 47, 53], [48, 52, 55], [48, 52, 55], [48, 52, 55],
];
const EIGHTH = 0.3;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function makeImpulse(ctx, seconds = 1.6, decay = 3.2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      lp = lp * 0.55 + white * 0.45; // łagodniejszy, "drewniany" pogłos
      d[i] = lp * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function noiseBuffer(ctx, seconds = 1) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function musicBoxNote(ctx, dest, t, freq, vel = 1) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22 * vel, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
  g.connect(dest);
  [[1, 1], [2, 0.28], [3.01, 0.08], [4.2, 0.04]].forEach(([mul, amp]) => {
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq * mul;
    og.gain.value = amp;
    o.connect(og).connect(g);
    o.start(t);
    o.stop(t + 2.3);
  });
}

function padChord(ctx, dest, t, dur, notes) {
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.9);
  g.gain.setValueAtTime(0.05, t + dur - 0.2);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.9);
  lp.connect(g).connect(dest);
  for (const n of notes) {
    for (const det of [-4, 4]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = midi(n);
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 1);
    }
  }
}

function sleighBells(ctx, dest, t0, seconds, noise) {
  // potrząsanie dzwoneczkami: krótkie metaliczne impulsy w rytmie
  const step = 0.14;
  for (let t = 0; t < seconds; t += step) {
    const accent = Math.round(t / step) % 4 === 0 ? 1 : 0.55;
    const fade = Math.min(1, t / 0.5, (seconds - t) / 0.8);
    const at = t0 + t + (Math.random() - 0.5) * 0.012;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 7000 + Math.random() * 2000;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.5 * accent * fade + 0.001, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    src.connect(bp).connect(g).connect(dest);
    src.start(at, Math.random() * 0.5, 0.15);
    // metaliczny "dzyń"
    for (const f of [3520, 4700]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.02);
      og.gain.setValueAtTime(0.0001, at);
      og.gain.exponentialRampToValueAtTime(0.035 * accent * fade + 0.0005, at + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
      o.connect(og).connect(dest);
      o.start(at);
      o.stop(at + 0.3);
    }
  }
}

function sparkleGliss(ctx, dest, t0) {
  // magiczny dźwięk przy otwieraniu listu
  const notes = [72, 76, 79, 84, 88, 91, 96];
  notes.forEach((n, i) => musicBoxNote(ctx, dest, t0 + i * 0.07, midi(n), 0.35));
}

/**
 * Składa całą ścieżkę.
 * @param {Array<{audio:Float32Array, pauseAfter:number, section:string, text:string}>} segs
 * @param {number} srcRate częstotliwość próbkowania syntezatora
 */
export async function buildSoundtrack(segs, srcRate, { fps = 25 } = {}) {
  // oś czasu
  let t = INTRO;
  const timeline = segs.map((s) => {
    const dur = s.audio.length / srcRate / PITCH;
    const item = { start: t, end: t + dur, section: s.section, text: s.text };
    t = item.end + s.pauseAfter;
    return item;
  });
  const lastEnd = timeline.length ? timeline[timeline.length - 1].end : INTRO;
  const duration = lastEnd + OUTRO;

  const ctx = new OfflineAudioContext(2, Math.ceil(duration * OUT_RATE), OUT_RATE);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.1;
  master.connect(limiter).connect(ctx.destination);

  // --- głos ---
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70;
  const warm = ctx.createBiquadFilter(); warm.type = 'lowshelf'; warm.frequency.value = 230; warm.gain.value = 4;
  const presence = ctx.createBiquadFilter(); presence.type = 'peaking'; presence.frequency.value = 3200; presence.Q.value = 0.9; presence.gain.value = 2.5;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -22; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
  const voiceGain = ctx.createGain(); voiceGain.gain.value = 1.5;
  const reverb = ctx.createConvolver(); reverb.buffer = makeImpulse(ctx);
  const wet = ctx.createGain(); wet.gain.value = 0.16;
  hp.connect(warm).connect(presence).connect(comp).connect(voiceGain);
  voiceGain.connect(master);
  voiceGain.connect(reverb).connect(wet).connect(master);

  segs.forEach((s, i) => {
    if (!s.audio.length) return;
    const b = ctx.createBuffer(1, s.audio.length, srcRate);
    b.copyToChannel(s.audio, 0);
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = PITCH;
    src.connect(hp);
    src.start(timeline[i].start);
  });

  // --- muzyka ---
  const music = ctx.createGain();
  const musicLp = ctx.createBiquadFilter(); musicLp.type = 'lowpass'; musicLp.frequency.value = 5200;
  const musicVerb = ctx.createConvolver(); musicVerb.buffer = makeImpulse(ctx, 2.4, 2.5);
  const musicWet = ctx.createGain(); musicWet.gain.value = 0.35;
  music.connect(musicLp).connect(master);
  musicLp.connect(musicVerb).connect(musicWet).connect(master);

  const FULL = 0.55, DUCK = 0.13;
  music.gain.setValueAtTime(0.0001, 0);
  music.gain.linearRampToValueAtTime(FULL, 1.2);
  timeline.forEach((it, i) => {
    music.gain.setTargetAtTime(DUCK, Math.max(0, it.start - 0.35), 0.15);
    const next = timeline[i + 1];
    if (!next || next.start - it.end > 1.2) music.gain.setTargetAtTime(FULL * 0.7, it.end + 0.15, 0.3);
  });
  music.gain.setTargetAtTime(FULL, lastEnd + 0.3, 0.4);
  music.gain.setValueAtTime(FULL, duration - 2.2);
  music.gain.linearRampToValueAtTime(0.0001, duration - 0.05);

  const loopLen = MELODY.reduce((a, [, d]) => a + d, 0) * EIGHTH;
  for (let start = 0.2; start < duration; start += loopLen + EIGHTH * 6) {
    let tt = start;
    for (const [n, d] of MELODY) {
      if (tt > duration) break;
      musicBoxNote(ctx, music, tt, midi(n), 0.9);
      tt += d * EIGHTH;
    }
    CHORDS.forEach((ch, bar) => {
      const at = start + bar * 6 * EIGHTH;
      if (at < duration) padChord(ctx, music, at, 6 * EIGHTH, ch);
    });
  }

  // --- efekty ---
  const fx = ctx.createGain(); fx.gain.value = 0.5; fx.connect(master);
  const noise = noiseBuffer(ctx, 1);
  sleighBells(ctx, fx, 0.1, 3.0, noise);
  sleighBells(ctx, fx, Math.max(0, lastEnd + 0.2), 3.4, noise);
  const firstLetter = timeline.find((x) => x.section === 'letter');
  if (firstLetter) sparkleGliss(ctx, fx, Math.max(0, firstLetter.start - 1.0));

  const buffer = await ctx.startRendering();

  // obwiednia głosu do ruchu ust (wartość 0..1 na klatkę)
  const frames = Math.ceil(duration * fps);
  const env = new Float32Array(frames);
  const win = Math.floor((srcRate * PITCH) / fps);
  segs.forEach((s, i) => {
    const it = timeline[i];
    const f0 = Math.floor(it.start * fps), f1 = Math.ceil(it.end * fps);
    for (let f = f0; f < f1 && f < frames; f++) {
      const pos = Math.floor((f / fps - it.start) * srcRate * PITCH);
      let e = 0, n = 0;
      for (let k = Math.max(0, pos - win); k < Math.min(s.audio.length, pos + win); k++) { e += s.audio[k] * s.audio[k]; n++; }
      env[f] = n ? Math.sqrt(e / n) : 0;
    }
  });
  const sorted = Array.from(env).filter((x) => x > 0.005).sort((a, b) => a - b);
  const ref = sorted.length ? sorted[Math.floor(sorted.length * 0.92)] : 1;
  for (let f = 0; f < frames; f++) env[f] = Math.min(1, env[f] / ref);
  // wygładzenie
  for (let f = 1; f < frames; f++) env[f] = Math.max(env[f], env[f - 1] * 0.55);

  return { buffer, timeline, envelope: env, duration, fps };
}
