(function(g,f){const api=f();if(typeof module==='object'&&module.exports)module.exports=api;if(g)g.CS16AdminTools=api;})(typeof window!=='undefined'?window:null,()=>{
  'use strict';
  function aim(origin,yaw,pitch,team,players,visible=()=>true){
    const cp=Math.cos(pitch),forward=[-Math.sin(yaw)*cp,Math.sin(pitch),-Math.cos(yaw)*cp];
    let best=null,bestScore=Math.cos(Math.PI/4);
    for(const r of players){
      if(!r.alive||!r.team||r.team===team)continue;
      const point=[r.x,r.y+1.72*(r.crouched?.72:1),r.z],d=point.map((v,i)=>v-origin[i]),length=Math.hypot(...d);
      if(length<.15||length>200)continue;
      const score=(d[0]*forward[0]+d[1]*forward[1]+d[2]*forward[2])/length;
      if(score<=bestScore||!visible(point,r))continue;
      bestScore=score;best={nick:r.nick,yaw:Math.atan2(-d[0],-d[2]),pitch:Math.atan2(d[1],Math.hypot(d[0],d[2])),point};
    }
    return best;
  }
  function create({T,menu,hud,send}){
    let state={allowed:false,wallhack:false,aimbot:false},pending=false,timer=0,lastDraw=0;
    const panel=document.createElement('section');panel.className='cs16-admin-tools';panel.hidden=true;
    const title=document.createElement('h3');title.textContent='Читы для себя';panel.append(title);
    const note=document.createElement('p');note.textContent='Личный доступ Fifflaren';panel.append(note);
    const buttons={};
    for(const [id,name,detail] of [['wallhack','Wallhack','Противники сквозь стены'],['aimbot','Аим','Захват видимой цели при стрельбе и прицеливании']]){
      const b=document.createElement('button');b.type='button';b.dataset.adminTool=id;
      const strong=document.createElement('strong'),small=document.createElement('small'),status=document.createElement('span');
      strong.textContent=name;small.textContent=detail;status.className='cs16-admin-toggle';b.append(strong,small,status);panel.append(b);
      b.onclick=()=>{
        if(!state.allowed||pending)return;pending=true;drawControls();
        clearTimeout(timer);timer=setTimeout(()=>{pending=false;drawControls();},4000);
        send({wallhack:state.wallhack,aimbot:state.aimbot,[id]:!state[id]});
      };buttons[id]={b,status};
    }
    menu.append(panel);
    const canvas=document.createElement('canvas');canvas.className='cs16-wallhack';canvas.hidden=true;hud.append(canvas);
    const badge=document.createElement('div');badge.className='cs16-admin-active';badge.hidden=true;hud.append(badge);
    const context=canvas.getContext('2d'),head=new T.Vector3(),foot=new T.Vector3();
    function drawControls(){
      panel.hidden=!state.allowed;
      for(const [id,{b,status}] of Object.entries(buttons)){b.disabled=pending;b.setAttribute('aria-pressed',String(state[id]));status.textContent=state[id]?'ВКЛ':'ВЫКЛ';}
      badge.hidden=!state.allowed||(!state.wallhack&&!state.aimbot);
      badge.textContent='FIFFLAREN · '+[state.wallhack?'WH':'',state.aimbot?'AIM':''].filter(Boolean).join(' + ');
      if(!state.allowed||!state.wallhack){canvas.hidden=true;context.clearRect(0,0,canvas.width,canvas.height);}
    }
    function set(data){
      const allowed=data?.allowed===true;
      state={allowed,wallhack:allowed&&data.wallhack===true,aimbot:allowed&&data.aimbot===true};
      pending=false;clearTimeout(timer);drawControls();
    }
    function update(time,camera,players,me,active){
      if(!state.allowed||!state.wallhack||!active||!me.alive){canvas.hidden=true;return;}
      canvas.hidden=false;if(time-lastDraw<50)return;lastDraw=time;
      const w=hud.clientWidth,h=hud.clientHeight;if(!w||!h)return;
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      context.clearRect(0,0,w,h);context.font='600 12px Segoe UI';context.textAlign='center';context.lineWidth=1.5;
      for(const r of players){
        if(!r.alive||!r.team||r.team===me.team)continue;
        const scale=r.crouched?.72:1;
        head.set(r.x,r.y+1.97*scale,r.z).project(camera);
        foot.set(r.x,r.y,r.z).project(camera);
        if(head.z<-1||head.z>1||Math.abs(head.x)>1.25||Math.abs(head.y)>1.4)continue;
        const x=(head.x+1)*w/2,y=(1-head.y)*h/2,bottom=(1-foot.y)*h/2,height=bottom-y;
        if(height<4)continue;
        const width=Math.max(10,height*.38),distance=Math.round(camera.position.distanceTo({x:r.x,y:r.y,z:r.z}));
        context.strokeStyle='#ff9b70';context.fillStyle='#f376421c';context.fillRect(x-width/2,y,width,height);context.strokeRect(x-width/2,y,width,height);
        context.fillStyle='#17252be8';context.fillRect(x-70,y-25,140,20);
        context.fillStyle='#ffe7cc';context.fillText(String(r.nick).slice(0,22)+' · '+distance+' м',x,y-11);
      }
    }
    return {set,update,get state(){return state;},reset:()=>set(null),dispose:()=>{clearTimeout(timer);panel.remove();canvas.remove();badge.remove();}};
  }
  return {aim,create};
});
