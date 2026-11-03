/* Short, cached heel/toe Foley layers. No downloads or per-step PCM allocation. */
(function (global) {
  'use strict';
  const types = ['stone', 'earth', 'grass', 'metal'];
  function normalize(surface) { return types.includes(surface) ? surface : surface === 'tun' ? 'stone' : 'earth'; }
  function samples(surface, variant, rate) {
    surface = normalize(surface);
    let seed = 7919 + types.indexOf(surface) * 1787 + variant * 997;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
    const out = new Float32Array(Math.ceil(rate * .29));
    const hardness = { stone: 1, earth: .5, grass: .28, metal: .85 }[surface];
    let low = 0, mid = 0, previous = 0, peak = 0, sum = 0;
    const toe = .076 + variant * .007;
    const smoothing = 1 - Math.exp(-2 * Math.PI * 170 / rate);
    const midsmoothing = 1 - Math.exp(-2 * Math.PI * 1600 / rate);
    for (let i = 0; i < out.length; i++) {
      const t = i / rate, n = random();
      low += (n - low) * smoothing; mid += (n - mid) * midsmoothing;
      const heelEnv = (1 - Math.exp(-t * 1100)) * Math.exp(-t * 58);
      const u = Math.max(0, t - toe), toeEnv = t > toe ? (1 - Math.exp(-u * 850)) * Math.exp(-u * 45) : 0;
      // Rubber sole compression, gritty contact, then the toe rolls off.
      const impact = (low * 4.2 + (mid - low) * hardness) * (heelEnv + toeEnv * .57);
      const scrapeEnv = Math.sin(Math.min(1, t / .23) * Math.PI) ** 2 * Math.exp(-t * 16);
      const scrape = (n - mid) * scrapeEnv * (surface === 'grass' ? .24 : surface === 'earth' ? .12 : .055);
      const ring = surface === 'metal' ? Math.sin(t * (1420 + variant * 37)) * Math.exp(-t * 48) * .065 : 0;
      // A few quiet grain clicks prevent repeating a single synthetic hiss.
      const grit = Math.abs(n) > .995 ? n * .12 * Math.exp(-t * 18) : 0;
      const sample = impact + scrape + ring + grit;
      out[i] = sample - previous * .94; previous = sample;
      sum += out[i]; peak = Math.max(peak, Math.abs(out[i]));
    }
    const mean = sum / out.length, gain = .66 / Math.max(.01, peak);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - mean) * gain * Math.min(1, (out.length - 1 - i) / (rate * .012));
    return out;
  }
  function create(context) {
    const bank = new Map(), active = new Set(), counters = new Map();
    function play(surface, volume = 1, pan = 0) {
      if (!Number.isFinite(volume) || volume <= 0 || context.state === 'closed') return;
      surface = normalize(surface);
      if (!bank.has(surface)) bank.set(surface, Array.from({length: 4}, (_, v) => {
        const pcm = samples(surface, v, context.sampleRate), buffer = context.createBuffer(1, pcm.length, context.sampleRate);
        buffer.copyToChannel(pcm, 0); return buffer;
      }));
      const index = (counters.get(surface) || 0) % 4; counters.set(surface, index + 1);
      const source = context.createBufferSource(), gain = context.createGain(), panner = context.createStereoPanner();
      source.buffer = bank.get(surface)[index]; source.playbackRate.value = [.98, 1.025, 1.01, .97][index];
      gain.gain.value = Math.min(1, volume) * .28; panner.pan.value = Math.max(-1, Math.min(1, pan || 0));
      source.connect(gain); gain.connect(panner); panner.connect(context.destination);
      const voice = { source, stop() { try { source.stop(); } catch {} source.disconnect(); gain.disconnect(); panner.disconnect(); active.delete(voice); } };
      if (active.size >= 16) active.values().next().value.stop();
      active.add(voice); source.onended = () => voice.stop(); source.start();
    }
    return { play, dispose() { for (const voice of [...active]) voice.stop(); bank.clear(); } };
  }
  const api = { create, samples, normalize };
  global.CS16Footsteps = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
