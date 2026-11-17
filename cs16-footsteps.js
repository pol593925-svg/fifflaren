/* Cached surface Foley recordings; procedural heel/toe fallback if an asset cannot decode. */
(function (global) {
  'use strict';
  const types = ['stone', 'earth', 'grass', 'metal', 'wood'];
  function normalize(surface) { return types.includes(surface) ? surface : surface === 'tun' ? 'stone' : 'earth'; }
  function samples(surface, variant, rate) {
    surface = normalize(surface);
    let seed = 7919 + types.indexOf(surface) * 1787 + variant * 997;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
    const out = new Float32Array(Math.ceil(rate * .29));
    const hardness = { stone: .58, earth: .34, grass: .20, metal: .52, wood: .42 }[surface];
    let low = 0, mid = 0, previous = 0, peak = 0, sum = 0;
    const toe = .076 + variant * .007;
    const smoothing = 1 - Math.exp(-2 * Math.PI * 190 / rate);
    const midsmoothing = 1 - Math.exp(-2 * Math.PI * 1100 / rate);
    const polish = 1 - Math.exp(-2 * Math.PI * 2200 / rate);
    for (let i = 0; i < out.length; i++) {
      const t = i / rate, n = random();
      low += (n - low) * smoothing; mid += (n - mid) * midsmoothing;
      const heelEnv = (1 - Math.exp(-t * 260)) * Math.exp(-t * 42);
      const u = Math.max(0, t - toe), toeEnv = t > toe ? (1 - Math.exp(-u * 220)) * Math.exp(-u * 38) : 0;
      // Rubber sole compression, gritty contact, then the toe rolls off.
      const impact = (low * 4.2 + (mid - low) * hardness) * (heelEnv + toeEnv * .57);
      const scrapeEnv = Math.sin(Math.min(1, t / .23) * Math.PI) ** 2 * Math.exp(-t * 16);
      const scrape = (mid - low) * scrapeEnv * (surface === 'grass' ? .36 : surface === 'earth' ? .22 : .07);
      const ring = surface === 'metal' ? Math.sin(t * (1420 + variant * 37)) * heelEnv * .035 : surface === 'wood' ? Math.sin(t*(760+variant*23))*heelEnv*.09 : 0;
      const sole=Math.sin(t*(590+variant*13))*heelEnv*.10;
      const sample = impact + scrape + ring + sole;
      // Keep the warm sole/body component; the old differentiation exaggerated hiss.
      previous+=(sample-previous)*polish;out[i]=previous;
      sum += out[i]; peak = Math.max(peak, Math.abs(out[i]));
    }
    const mean = sum / out.length, gain = .48 / Math.max(.01, peak);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - mean) * gain * Math.min(1,i/(rate*.004),(out.length-1-i)/(rate*.02));
    return out;
  }
  function create(context) {
    const bank = new Map(), active = new Set(), counters = new Map();
    const recordings = global.CS16SoundBank ? global.CS16SoundBank.create(context) : null;
    const voices = [];
    let disposed = false;
    function buffer(surface, variant) {
      const recording = recordings && recordings.get('step.' + surface, variant);
      if (!recording) {
        const pcm = samples(surface, variant, context.sampleRate), fallback = context.createBuffer(1, pcm.length, context.sampleRate);
        fallback.copyToChannel(pcm, 0); return fallback;
      }
      // Metal flooring is a recorded sole contact plus a quiet recorded plate resonance.
      const ring = surface === 'metal' ? recordings.get('metal', variant) : null;
      const result = context.createBuffer(1, Math.max(recording.length, ring ? ring.length : 0), context.sampleRate);
      const pcm = result.getChannelData(0);
      function add(source, amount) {
        for (let channel = 0; channel < source.numberOfChannels; channel++) {
          const input = source.getChannelData(channel);
          for (let i = 0; i < input.length; i++) pcm[i] += input[i] * amount / source.numberOfChannels;
        }
      }
      add(recording, 1); if (ring) add(ring, .22);
      let peak = 0; for (const value of pcm) peak = Math.max(peak, Math.abs(value));
      if (peak > 0) for (let i = 0; i < pcm.length; i++) pcm[i] *= .56 / peak;
      return result;
    }
    function surfaceBank(surface) {
      if (!bank.has(surface)) bank.set(surface, Array.from({length: 4}, (_, i) => buffer(surface, i)));
      return bank.get(surface);
    }
    function channel() {
      const filter = context.createBiquadFilter(), gain = context.createGain(), pan = context.createStereoPanner();
      filter.type = 'lowpass'; filter.connect(gain); gain.connect(pan); pan.connect(recordings?.destination || context.destination);
      const voice = {filter, gain, pan, source: null, stop() {
        const source = voice.source; if (!source) return;
        voice.source = null; source.onended = null;
        try { source.stop(); } catch {} source.disconnect(); active.delete(voice);
      }};
      voices.push(voice); return voice;
    }
    function play(surface, volume = 1, pan = 0) {
      if (disposed || !Number.isFinite(volume) || volume <= 0 || context.state === 'closed') return;
      surface = normalize(surface);
      const index = (counters.get(surface) || 0) % 4; counters.set(surface, index + 1);
      const voice = voices.find(v => !v.source) || (voices.length < 8 ? channel() : active.values().next().value);
      voice.stop();
      const source = context.createBufferSource(); voice.source = source;
      source.buffer = surfaceBank(surface)[index]; source.playbackRate.value = [.99, 1.015, 1.005, .985][index];
      voice.filter.frequency.value = surface === 'earth' ? 1800 : surface === 'grass' ? 4700 : surface === 'metal' ? 7000 : 5800;
      voice.gain.gain.value = Math.min(1, volume) * .28; voice.pan.pan.value = Math.max(-1, Math.min(1, pan || 0));
      source.connect(voice.filter); active.add(voice);
      source.onended = () => { if (voice.source === source) { voice.source = null; active.delete(voice); source.disconnect(); } };
      source.start();
    }
    return {
      play,
      async prepare() {
        if (disposed) return;
        if (recordings) await recordings.prepare('steps');
        if (disposed) return;
        bank.clear();
        for (const surface of types) { surfaceBank(surface); await new Promise(resolve => setTimeout(resolve, 0)); if (disposed) return; }
        while (voices.length < 8) channel();
      },
      dispose() {
        if (disposed) return; disposed = true;
        for (const voice of [...active]) voice.stop();
        for (const voice of voices) { voice.filter.disconnect(); voice.gain.disconnect(); voice.pan.disconnect(); }
        voices.length = 0; bank.clear(); if (recordings) recordings.dispose();
      },
    };
  }
  const api = { create, samples, normalize };
  global.CS16Footsteps = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
