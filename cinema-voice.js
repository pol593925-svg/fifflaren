(function(g){
  'use strict';
  // This function is loaded in the AudioWorklet thread, not on the renderer's UI thread.
  function registerMicrophone(){
    class CinemaMicrophone extends AudioWorkletProcessor{
      constructor(){super();this.samples=new Int16Array(640);this.offset=0;this.peak=0;this.tail=0;}
      process(inputs){
        const channel=inputs[0]?.[0];if(!channel)return true;
        for(const value of channel){
          this.peak=Math.max(this.peak,Math.abs(value));
          this.samples[this.offset++]=Math.round(Math.max(-1,Math.min(1,value))*32767);
          if(this.offset===640){
            if(this.peak>.003)this.tail=8;
            if(this.tail>0){this.tail--;this.port.postMessage(this.samples.buffer,[this.samples.buffer]);this.samples=new Int16Array(640);}
            this.offset=0;this.peak=0;
          }
        }
        return true;
      }
    }
    registerProcessor('cinema-mic',CinemaMicrophone);
  }
  function create(socket,ui,notify){
    let call=null,roster=[];
    function draw(){
      ui.join.hidden=!!call;ui.leave.hidden=!call;ui.mute.hidden=!call?.joined;
      ui.mute.textContent=call?.muted?'Включить микрофон':'Выключить микрофон';
      ui.mute.setAttribute('aria-pressed',String(!!call?.muted));ui.join.disabled=!socket.connected;
      ui.people.textContent=roster.length?'В звонке: '+roster.map(x=>x.nick+(x.muted?' (микрофон выкл.)':'')).join(', '):'В звонке пока никого';
    }
    function leave(){
      const old=call;call=null;
      if(old){
        if(socket.connected)socket.emit('voice_leave');old.mic?.getTracks().forEach(t=>t.stop());
        old.input?.disconnect();if(old.node){old.node.port.onmessage=null;old.node.disconnect();}old.silent?.disconnect();
        for(const src of old.playback){try{src.stop();}catch{}}
        if(old.ctx&&old.ctx.state!=='closed')old.ctx.close().catch(()=>{});
      }
      draw();
    }
    async function join(){
      if(call||!socket.connected)return;
      const current={joined:false,muted:false,next:new Map(),playback:new Set()};call=current;draw();
      try{
        current.ctx=new AudioContext({sampleRate:16000,latencyHint:'interactive'});await current.ctx.resume();
        if(call!==current)return;
        const mic=await navigator.mediaDevices.getUserMedia({video:false,audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
        if(call!==current){mic.getTracks().forEach(t=>t.stop());return;}
        current.mic=mic;const ctx=current.ctx;
        const url=URL.createObjectURL(new Blob(['('+registerMicrophone.toString()+')()'],{type:'text/javascript'}));
        try{await ctx.audioWorklet.addModule(url);}finally{URL.revokeObjectURL(url);}
        if(call!==current)return;
        current.node=new AudioWorkletNode(ctx,'cinema-mic',{channelCount:1,channelCountMode:'explicit'});
        current.input=ctx.createMediaStreamSource(mic);current.silent=ctx.createGain();current.silent.gain.value=0;
        current.input.connect(current.node);current.node.connect(current.silent).connect(ctx.destination);
        current.node.port.onmessage=e=>{if(call===current&&current.joined&&!current.muted&&socket.connected)socket.volatile.emit('voice_pcm',e.data);};
        const answer=await socket.timeout(6000).emitWithAck('voice_join');if(call!==current)return;if(!answer?.ok)throw Error('Звонок недоступен.');
        current.joined=true;mic.getAudioTracks()[0].onended=()=>{if(call===current){leave();notify('Микрофон отключён.');}};draw();notify('');
      }catch(e){if(call===current){leave();notify(e.name==='NotAllowedError'?'Доступ к микрофону не разрешён. Проверь настройки микрофона.':'Не удалось подключить голос: '+e.message);}}
    }
    function audio(id,data){
      const current=call;if(!current?.joined||current.ctx.state!=='running'||data?.byteLength!==1280)return;
      const ctx=current.ctx,now=ctx.currentTime,queued=current.next.get(id)||0;
      if(queued>now+.24)return;
      const packet=data instanceof ArrayBuffer?new Int16Array(data):new Int16Array(data.buffer,data.byteOffset,640);
      const buf=ctx.createBuffer(1,640,16000),out=buf.getChannelData(0);
      for(let i=0;i<640;i++)out[i]=packet[i]/32768;
      const t=queued>now+.01?queued:now+.055,source=ctx.createBufferSource();
      source.buffer=buf;source.connect(ctx.destination);current.playback.add(source);
      source.onended=()=>{current.playback.delete(source);source.disconnect();};source.start(t);current.next.set(id,t+buf.duration);
    }
    const list=rows=>{roster=rows;if(call)for(const id of call.next.keys())if(!rows.some(row=>row.id===id))call.next.delete(id);draw();};
    const offline=()=>{roster=[];leave();};
    ui.join.onclick=join;ui.leave.onclick=leave;ui.mute.onclick=()=>{
      if(!call?.joined)return;call.muted=!call.muted;
      call.mic.getAudioTracks().forEach(t=>{t.enabled=!call.muted;});socket.emit('voice_mute',call.muted);draw();
    };
    socket.on('voice_roster',list);socket.on('voice_audio',audio);socket.on('disconnect',offline);socket.on('connect',draw);draw();
    return {close(){leave();socket.off('voice_roster',list);socket.off('voice_audio',audio);socket.off('disconnect',offline);socket.off('connect',draw);}};
  }
  g.HubCinemaVoice={create};
})(window);
