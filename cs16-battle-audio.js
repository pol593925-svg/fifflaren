(function (g) {
  'use strict';
  function create(a, { listener, blocked, indoor }) {
    const buffers = new Map(),
      active = new Set();
    let lastWhizz = 0;
    const reverb = a.createConvolver(),
      wet = a.createGain();
    wet.gain.value = 0.18;
    reverb.connect(wet);
    wet.connect(a.destination);
    const impulse = a.createBuffer(2, Math.ceil(a.sampleRate * 0.48), a.sampleRate);
    for (let c = 0; c < 2; c++) {
      const p = impulse.getChannelData(c);
      for (let i = 0; i < p.length; i++)
        p[i] = (Math.random() * 2 - 1) * Math.exp((-i / a.sampleRate) * 12) * 0.35;
    }
    reverb.buffer = impulse;
    function buffer(type) {
      if (buffers.has(type)) return buffers.get(type);
      const duration = type === 'sniper' ? 0.62 : type === 'whizz' ? 0.16 : type === 'glass' ? 0.35 : 0.28,
        b = a.createBuffer(1, Math.ceil(a.sampleRate * duration), a.sampleRate),
        p = b.getChannelData(0);
      let low = 0,
        previous = 0;
      const f = type === 'sniper' ? 80 : type === 'pistol' ? 150 : type === 'metal' ? 1700 : 115;
      for (let i = 0; i < p.length; i++) {
        const t = i / a.sampleRate,
          n = Math.random() * 2 - 1;
        low += (n - low) * 0.12;
        const attack = 1 - Math.exp(-t * 2000),
          tail = Math.exp(-t * (type === 'sniper' ? 13 : 24));
        let v = (low * 1.6 + n * 0.32 + Math.sin(t * f * 6.283) * 0.18) * attack * tail;
        if (type === 'whizz') v = (n - low) * Math.sin((t / duration) * Math.PI) * 0.19;
        if (type === 'glass') v = (n - previous) * Math.exp(-t * 17) * 0.22;
        if (type === 'wood' || type === 'stone') v = low * Math.exp(-t * 38) * 1.5;
        p[i] = Math.max(-0.85, Math.min(0.85, v));
        previous = n;
      }
      buffers.set(type, b);
      return b;
    }
    function sound(type, pos, gain = 0.65) {
      const l = listener(),
        d = Math.hypot(pos[0] - l.x, pos[1] - l.y, pos[2] - l.z);
      if (d > 150) return;
      const muffled = d > 2 && blocked([l.x, l.y, l.z], pos),
        src = a.createBufferSource(),
        filter = a.createBiquadFilter(),
        volume = a.createGain(),
        pan = a.createStereoPanner();
      src.buffer = buffer(type);
      src.playbackRate.value = 0.97 + Math.random() * 0.06;
      filter.type = 'lowpass';
      filter.frequency.value = muffled ? 750 : Math.max(1500, 12000 - d * 65);
      volume.gain.value = (gain / (1 + (d * d) / 85)) * (muffled ? 0.36 : 1);
      pan.pan.value = Math.max(
        -1,
        Math.min(1, ((pos[0] - l.x) * Math.cos(l.yaw) - (pos[2] - l.z) * Math.sin(l.yaw)) / Math.max(2, d)),
      );
      src.connect(filter);
      filter.connect(volume);
      volume.connect(pan);
      pan.connect(a.destination);
      if (indoor(pos) || indoor([l.x, l.y, l.z])) pan.connect(reverb);
      const voice = {
        stop() {
          try {
            src.stop();
          } catch {}
          src.disconnect();
          filter.disconnect();
          volume.disconnect();
          pan.disconnect();
          active.delete(voice);
        },
      };
      if (active.size >= 28) active.values().next().value.stop();
      active.add(voice);
      src.onended = voice.stop;
      src.start();
    }
    return {
      shot(id, pos) {
        sound(
          ['awp', 'scout', 'tankgun'].includes(id)
            ? 'sniper'
            : ['glock', 'usp', 'deagle', 'fiveseven', 'elite', 'tec9'].includes(id)
              ? 'pistol'
              : 'rifle',
          pos,
          0.65,
        );
      },
      impact(kind, pos) {
        sound(
          kind === 'rail' || kind === 'steel'
            ? 'metal'
            : kind === 'wood'
              ? 'wood'
              : kind === 'glass'
                ? 'glass'
                : 'stone',
          pos,
          0.24,
        );
      },
      whizz(o, d, length) {
        const l = listener(),
          t = (l.x - o[0]) * d[0] + (l.y - o[1]) * d[1] + (l.z - o[2]) * d[2];
        if (t < 2 || t > length || performance.now() - lastWhizz < 500) return;
        const p = o.map((v, i) => v + d[i] * t);
        if (Math.hypot(p[0] - l.x, p[1] - l.y, p[2] - l.z) < 1.8 && !blocked(p, [l.x, l.y, l.z])) {
          lastWhizz = performance.now();
          sound('whizz', p, 0.25);
        }
      },
      dispose() {
        for (const v of [...active]) v.stop();
        reverb.disconnect();
        wet.disconnect();
        buffers.clear();
      },
    };
  }
  g.CS16BattleAudio = { create };
})(window);
