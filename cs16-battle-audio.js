(function (g) {
  'use strict';
  const shotTypes=new Set(['rifle','pistol','sniper','smg','suppressed']);
  function samples(type,variant,rate){
    const duration=type==='sniper'?.46:type==='whizz'?.16:type==='glass'?.30:.25;
    const out=new Float32Array(Math.ceil(rate*duration));let seed=9127+variant*7919+[...type].reduce((s,c)=>s+c.charCodeAt(0)*127,0);
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1};
    const shot=shotTypes.has(type),heavy=type==='sniper',quiet=type==='suppressed';
    const f=heavy?88:type==='pistol'?142:type==='smg'?157:quiet?126:108;
    const lowAlpha=1-Math.exp(-2*Math.PI*420/rate),midAlpha=1-Math.exp(-2*Math.PI*(quiet?1700:3200)/rate);
    const polish=1-Math.exp(-2*Math.PI*(shot?4200:5200)/rate);
    let low=0,mid=0,polished=0,sum=0,peak=0;
    for(let i=0;i<out.length;i++){
      const t=i/rate,n=random();low+=(n-low)*lowAlpha;mid+=(n-mid)*midAlpha;
      const attack=1-Math.exp(-t*(quiet?650:1000)),tail=Math.exp(-t*(heavy?15:quiet?31:26));
      const core=Math.sin(2*Math.PI*(f*t-24*t*t))*.27;
      const transient=(mid-low)*Math.exp(-t*100)*(quiet?.30:.8);
      let v=((low*1.65+core)*tail+transient)*attack;
      // The mechanical release sits behind the report instead of a sharp white-noise click.
      const u=Math.max(0,t-.042);if(shot&&t>.042)v+=(mid-low)*Math.sin(Math.min(1,u/.035)*Math.PI)**2*Math.exp(-u*48)*.19;
      if(type==='whizz')v=(mid-low)*Math.sin(t/duration*Math.PI)**2*.20;
      if(type==='glass')v=(mid-low)*attack*Math.exp(-t*22)*.28;
      if(type==='metal')v=(low*.8+Math.sin(t*7100)*.035)*attack*Math.exp(-t*33);
      if(type==='wood'||type==='stone')v=low*attack*Math.exp(-t*42)*1.5;
      polished+=(v-polished)*polish;
      out[i]=polished;sum+=polished;peak=Math.max(peak,Math.abs(polished));
    }
    const mean=sum/out.length,gain=(shot?.62:.42)/Math.max(.01,peak);
    for(let i=0;i<out.length;i++)out[i]=(out[i]-mean)*gain*Math.min(1,i/(rate*.002),(out.length-1-i)/(rate*.025));
    return out;
  }
  function create(a, { listener, blocked, indoor }) {
    const buffers = new Map(),
      active = new Set(), voices=[];
    let disposed=false;
    let lastWhizz = 0;const counters=new Map();
    const mix=a.createDynamicsCompressor();mix.threshold.value=-13;mix.knee.value=16;mix.ratio.value=3.5;mix.attack.value=.005;mix.release.value=.12;mix.connect(a.destination);
    const reverb = a.createConvolver(),
      wet = a.createGain();
    wet.gain.value = 0.10;
    reverb.connect(wet);
    wet.connect(mix);
    const impulse = a.createBuffer(2, Math.ceil(a.sampleRate * 0.48), a.sampleRate);
    for (let c = 0; c < 2; c++) {
      const p = impulse.getChannelData(c);
      for (let i = 0; i < p.length; i++)
        p[i] = (Math.random() * 2 - 1) * Math.exp((-i / a.sampleRate) * 12) * 0.35;
    }
    reverb.buffer = impulse;
    function buffer(type,variant=0) {
      const key=type+'/'+variant;if(buffers.has(key))return buffers.get(key);
      const pcm=samples(type,variant,a.sampleRate),b=a.createBuffer(1,pcm.length,a.sampleRate);b.getChannelData(0).set(pcm);
      buffers.set(key, b);
      return b;
    }
    function channel(){
      const filter=a.createBiquadFilter(),volume=a.createGain(),pan=a.createStereoPanner();
      filter.type='lowpass';filter.connect(volume);volume.connect(pan);pan.connect(mix);
      const voice={filter,volume,pan,source:null,wet:false,stop(){
        const src=voice.source;if(!src)return;voice.source=null;active.delete(voice);
        src.onended=null;try{src.stop();}catch{}src.disconnect();
      }};
      voices.push(voice);return voice;
    }
    function sound(type, pos, gain = 0.65) {
      if(disposed)return;
      const l = listener(),
        d = Math.hypot(pos[0] - l.x, pos[1] - l.y, pos[2] - l.z);
      if (d > 150) return;
      const muffled = d > 2 && blocked([l.x, l.y, l.z], pos),
        voice=voices.find(v=>!v.source)||(voices.length<28?channel():active.values().next().value);
      voice.stop();
      const src = a.createBufferSource(),{filter,volume,pan}=voice;
      voice.source=src;
      const variant=(counters.get(type)||0)%4;counters.set(type,variant+1);src.buffer = buffer(type,variant);
      src.playbackRate.value = 0.97 + Math.random() * 0.06;
      filter.frequency.value = muffled ? 700 : Math.max(1400, 6800 - d * 45);
      volume.gain.value = (gain / (1 + (d * d) / 85)) * (muffled ? 0.36 : 1);
      pan.pan.value = Math.max(
        -1,
        Math.min(1, ((pos[0] - l.x) * Math.cos(l.yaw) - (pos[2] - l.z) * Math.sin(l.yaw)) / Math.max(2, d)),
      );
      src.connect(filter);
      const room=!!(indoor(pos)||indoor([l.x,l.y,l.z]));
      if(room!==voice.wet){if(room)pan.connect(reverb);else pan.disconnect(reverb);voice.wet=room;}
      active.add(voice);
      // A delayed ended event from a stolen voice must never stop its replacement.
      src.onended = ()=>{if(voice.source===src){voice.source=null;active.delete(voice);src.disconnect();}};
      src.start();
    }
    return {
      async prepare() {
        // Generate sample buffers behind the loading screen, not during the first firefight.
        for(const type of ['rifle','pistol','sniper','smg','suppressed','whizz','glass','wood','stone','metal']){
          if(disposed)return;for(let i=0;i<4;i++)buffer(type,i);await new Promise(resolve=>setTimeout(resolve,0));
        }
        while(!disposed&&voices.length<28){for(let i=0;i<4&&voices.length<28;i++)channel();await new Promise(resolve=>setTimeout(resolve,0));}
      },
      shot(id, pos, gain=1) {
        const type=['awp','scout'].includes(id)?'sniper':['m4a1','usp'].includes(id)?'suppressed':['mp5','p90','ump45'].includes(id)?'smg':['glock','deagle','fiveseven','elite','tec9'].includes(id)?'pistol':'rifle';
        sound(type,pos,({sniper:.55,rifle:.48,pistol:.43,smg:.39,suppressed:.36}[type])*gain);
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
        if(disposed)return;disposed=true;
        for (const v of [...active]) v.stop();
        for(const v of voices){v.filter.disconnect();v.volume.disconnect();v.pan.disconnect();}voices.length=0;
        reverb.disconnect();
        wet.disconnect();
        mix.disconnect();
        buffers.clear();
      },
    };
  }
  g.CS16BattleAudio = { create, samples };
})(window);
