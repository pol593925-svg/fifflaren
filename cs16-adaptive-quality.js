(function (g, f) {
  const api = f();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g) g.CS16AdaptiveQuality = api;
})(typeof window !== 'undefined' ? window : null, () => {
  'use strict';
  const levels = ['low', 'balanced', 'high'];
  function create({ apply, mode = 'auto', quality = 'balanced' }) {
    let ms = 0,
      frames = 0,
      slow = 0,
      fast = 0,
      warmup = 4000,
      cooldown = 0,
      fps = 0;
    function reset() {
      ms = frames = slow = fast = 0;
      warmup = 4000;
    }
    return {
      setMode(next) {
        mode = next;
        reset();
        if (next !== 'auto' && levels.includes(next)) {
          quality = next;
          apply(quality);
        } else if (next === 'auto') apply(quality);
      },
      sample(delta, active = true) {
        if (!active || !Number.isFinite(delta) || delta <= 0) {
          reset();
          return;
        }
        delta = Math.min(delta, 500);
        cooldown = Math.max(0, cooldown - delta);
        if (warmup > 0) {
          warmup -= delta;
          return;
        }
        ms += delta;
        frames++;
        if (ms < 4000) return;
        fps = (frames * 1000) / ms;
        ms = frames = 0;
        if (mode !== 'auto') return;
        slow = fps < 42 ? slow + 1 : 0;
        fast = fps > 58 ? fast + 1 : 0;
        const i = levels.indexOf(quality);
        let target = i;
        // Sustained severe overload should not wait two windows or an upgrade cooldown.
        const severe = fps < 27;
        if (severe || slow >= 2) target = Math.max(0, i - 1);
        else if (fast >= 6) target = Math.min(2, i + 1);
        if (target !== i && (!cooldown || severe && target < i)) {
          quality = levels[target];
          cooldown = 24000;
          slow = fast = 0;
          apply(quality);
        }
      },
      get quality() {
        return quality;
      },
      get mode() {
        return mode;
      },
      get fps() {
        return fps;
      },
      reset,
    };
  }
  return { create };
});
