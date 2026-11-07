/* Original distant painted trees, generated once. No photographic foliage backdrop. */
(function(g){'use strict';
 g.CS16AnimeNature={atlas(T){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const c=canvas.getContext('2d');let seed=231;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let type=0;type<2;type++){const x=type*256+128;c.fillStyle='#725941';c.beginPath();c.moveTo(x-8,510);c.lineTo(x-3,40);c.lineTo(x+4,40);c.lineTo(x+10,510);c.closePath();c.fill();
   for(let k=0;k<85;k++){const y=40+rand()*355,width=type?Math.max(15,(y-15)*.27):70*Math.sin((y+15)/430*Math.PI)+10,dx=(rand()-.5)*width*2;
    c.strokeStyle='#82664b';c.lineWidth=2.5;c.beginPath();c.moveTo(x,y+38);c.quadraticCurveTo(x+dx*.5,y+14,x+dx,y);c.stroke();
    c.fillStyle=['#50734e','#66874e','#83a45d','#a8be71'][k%4];c.beginPath();c.ellipse(x+dx,y,9+rand()*19,type?5+rand()*9:12+rand()*20,(rand()-.5)*.6,0,Math.PI*2);c.fill();
   }
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
 }};
})(window);
