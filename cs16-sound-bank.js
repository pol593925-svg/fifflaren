/* Local CC0 recordings. Loading/decoding happens only in prepare(), never in play(). */
(function (g) {
  'use strict';
  const numbered = (prefix, count, extension = 'ogg') => Array.from({length: count}, (_, i) => `${prefix}${extension === 'ogg' ? String(i).padStart(3, '0') : i}.${extension}`);
  const files = {
    rifleAk: numbered('rifle-ak-', 2, 'wav'), rifleAr: numbered('rifle-ar-', 2, 'wav'),
    pistol: numbered('pistol-', 3, 'wav'), sniper: numbered('sniper-', 3, 'wav'), smg: numbered('smg-', 3, 'wav'),
    // These are filtered AR-15 recordings, not recordings of a real suppressor.
    suppressed: numbered('rifle-ar-', 2, 'wav'),
    suppressedPistol: numbered('pistol-', 3, 'wav'),
    stone: numbered('impactGeneric_light_', 4), wood: numbered('impactWood_heavy_', 4),
    metal: numbered('impactMetal_heavy_', 4), glass: numbered('impactGlass_medium_', 4),
    'step.stone': numbered('footstep_concrete_', 4), 'step.earth': numbered('footstep_grass_', 4),
    'step.grass': numbered('footstep_grass_', 4), 'step.wood': numbered('footstep_wood_', 4),
    'step.metal': numbered('footstep_concrete_', 4),
  };
  const contexts = new WeakMap();
  const base = 'assets/audio/cs16/';
  const timeoutMs = 5000;
  function create(context) {
    let state = contexts.get(context);
    if (!state) {
      state = {buffers: new Map(), pending: new Map(), prepared: new Map(), controllers: new Set(), owners: 0, output: null};
      contexts.set(context, state);
    }
    state.owners++;
    let disposed = false;
    function load(file) {
      if (state.buffers.has(file)) return Promise.resolve(state.buffers.get(file));
      if (state.pending.has(file)) return state.pending.get(file);
      const controller = new AbortController();
      state.controllers.add(controller);
      let timer;
      const work = new Promise((resolve, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('Sound load cancelled or timed out')), {once: true});
        timer = setTimeout(() => controller.abort(), timeoutMs);
        (async () => {
          let bytes;
          // Electron opens index.html with file://; XHR can read bundled local files there.
          if (g.location && g.location.protocol === 'file:' && typeof g.XMLHttpRequest === 'function') {
            bytes = await new Promise((done, fail) => {
              const request = new g.XMLHttpRequest();
              request.open('GET', base + file, true); request.responseType = 'arraybuffer';
              request.onload = () => request.response && (request.status === 0 || request.status < 400) ? done(request.response) : fail(new Error('Missing sound: ' + file));
              request.onerror = request.onabort = () => fail(new Error('Cannot read sound: ' + file));
              controller.signal.addEventListener('abort', () => request.abort(), {once: true});
              request.send();
            });
          } else {
            const response = await g.fetch(base + file, {signal: controller.signal});
            if (!response.ok) throw new Error('Missing sound: ' + file);
            bytes = await response.arrayBuffer();
          }
          if (controller.signal.aborted) return;
          const buffer = await context.decodeAudioData(bytes);
          if (controller.signal.aborted) return;
          state.buffers.set(file, buffer); resolve(buffer);
        })().catch(reject);
      }).catch(() => null).finally(() => {
        clearTimeout(timer); state.controllers.delete(controller);
        if (state.pending.get(file) === work) state.pending.delete(file);
      });
      state.pending.set(file, work);
      return work;
    }
    return {
      get destination() {
        if (disposed) return context.destination;
        if (!state.output) {
          // A shared soft limiter catches simultaneous gunfire + footsteps after spatial mixing.
          // The 0.25 input gain gives the shaper a +/-4 working range; its curve restores unity
          // gain below the knee, preserving ordinary single-shot/footstep transients.
          const input = context.createGain(), limiter = context.createWaveShaper();
          const curve = new Float32Array(8193);
          for (let i = 0; i < curve.length; i++) {
            const x = (i / (curve.length - 1) * 2 - 1) * 4, magnitude = Math.abs(x);
            curve[i] = Math.sign(x) * (magnitude <= .6 ? magnitude : .6 + .3 * Math.tanh((magnitude - .6) / .3));
          }
          input.gain.value = .25; limiter.curve = curve; limiter.oversample = '4x';
          input.connect(limiter); limiter.connect(context.destination);
          state.output = {input, limiter};
        }
        return state.output.input;
      },
      prepare(group = 'battle') {
        if (disposed) return Promise.resolve({loaded: 0, total: 0});
        if (!state.prepared.has(group)) {
          const keys = Object.keys(files).filter(key => group === 'steps' ? key.startsWith('step.') || key === 'metal' : !key.startsWith('step.'));
          const names = [...new Set(keys.flatMap(key => files[key]))];
          const job = Promise.allSettled(names.map(load)).then(results => ({loaded: results.filter(r => r.status === 'fulfilled' && r.value).length, total: names.length}));
          state.prepared.set(group, job);
        }
        return state.prepared.get(group);
      },
      get(type, variant = 0) {
        if (disposed) return null;
        const names = files[type];
        if (!names) return null;
        // If one variant failed, keep using the other recordings of the same type.
        for (let i = 0; i < names.length; i++) {
          const buffer = state.buffers.get(names[(variant + i) % names.length]);
          if (buffer) return buffer;
        }
        return null;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        if (--state.owners === 0) {
          for (const controller of state.controllers) controller.abort();
          state.pending.clear(); state.prepared.clear();
          if (state.output) { state.output.input.disconnect(); state.output.limiter.disconnect(); state.output = null; }
        }
      },
    };
  }
  const api = {create, files, timeoutMs};
  g.CS16SoundBank = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
