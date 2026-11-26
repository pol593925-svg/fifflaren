/* Local playable graphics preview: half-resolution contact shading and restrained HDR bloom. */
(function(g){'use strict';
 const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
 function create(T,renderer){
  const size=new T.Vector2(),quadScene=new T.Scene(),quadCamera=new T.Camera();
  const geometry=new T.PlaneGeometry(2,2),quad=new T.Mesh(geometry);quad.frustumCulled=false;quadScene.add(quad);
  const hdr=renderer.capabilities.isWebGL2&&renderer.extensions.has('EXT_color_buffer_float');
  const target=new T.WebGLRenderTarget(1,1,{type:hdr?T.HalfFloatType:T.UnsignedByteType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true});
  target.texture.name='Illustrated HDR scene';target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
  target.samples=renderer.capabilities.isWebGL2?2:0;
  const aoTarget=new T.WebGLRenderTarget(1,1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false});
  const bloomTarget=new T.WebGLRenderTarget(1,1,{type:hdr?T.HalfFloatType:T.UnsignedByteType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false});
  const depthUniforms={depthMap:{value:target.depthTexture},inverseProjection:{value:new T.Matrix4()},pixel:{value:new T.Vector2(1,1)},cameraNear:{value:.08},cameraFar:{value:1600}};
  const reconstruct=`uniform sampler2D depthMap;uniform mat4 inverseProjection;uniform vec2 pixel;uniform float cameraNear,cameraFar;
    float viewDepth(float z){return (cameraNear*cameraFar)/((cameraFar-cameraNear)*z-cameraFar);}
    vec3 viewPosition(vec2 uv,float d){vec4 p=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}`;
  const aoMaterial=new T.ShaderMaterial({name:'Half-resolution contact shadows',depthTest:false,depthWrite:false,toneMapped:false,vertexShader:vertex,
   uniforms:{...depthUniforms,radius:{value:.7},strength:{value:.42}},fragmentShader:`
    varying vec2 vUv;${reconstruct}uniform float radius,strength;
    float random(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){
      float d=texture2D(depthMap,vUv).x;
      if(d>.99999){gl_FragColor=vec4(1.);return;}
      vec3 p=viewPosition(vUv,d);
      vec3 pr=viewPosition(vUv+vec2(pixel.x,0.),texture2D(depthMap,vUv+vec2(pixel.x,0.)).x);
      vec3 pl=viewPosition(vUv-vec2(pixel.x,0.),texture2D(depthMap,vUv-vec2(pixel.x,0.)).x);
      vec3 pu=viewPosition(vUv+vec2(0.,pixel.y),texture2D(depthMap,vUv+vec2(0.,pixel.y)).x);
      vec3 pb=viewPosition(vUv-vec2(0.,pixel.y),texture2D(depthMap,vUv-vec2(0.,pixel.y)).x);
      vec3 dx=abs(pr.z-p.z)<abs(pl.z-p.z)?pr-p:p-pl;
      vec3 dy=abs(pu.z-p.z)<abs(pb.z-p.z)?pu-p:p-pb;
      vec3 crossNormal=cross(dx,dy);
      vec3 n=crossNormal*inversesqrt(max(dot(crossNormal,crossNormal),1.e-18));
      float angle=random(floor(vUv/pixel*.5))*6.2831853,occ=0.;
      // World-space radius: hands have a smaller contact distance than architecture.
      float r=min(radius,max(.025,-p.z*.10));
      vec2 screenRadius=vec2(r/(max(.05,-p.z)*inverseProjection[0][0]),r/(max(.05,-p.z)*inverseProjection[1][1]))*.5;
      for(int i=0;i<12;i++){
        float t=(float(i)+.5)/12.,a=angle+float(i)*2.399963;
        vec2 uv=vUv+vec2(cos(a),sin(a))*screenRadius*sqrt(t);
        vec3 q=viewPosition(uv,texture2D(depthMap,uv).x),v=q-p;
        float len=length(v),facing=max(0.,dot(n,v/max(len,.00001))-.13);
        occ+=facing*(1.-smoothstep(r*.3,r*1.6,len));
      }
      float ao=clamp(1.-occ*(strength/3.),.57,1.);
      gl_FragColor=vec4(vec3(ao),1.);
    }`});
  const bloomMaterial=new T.ShaderMaterial({name:'Restrained highlights',depthTest:false,depthWrite:false,toneMapped:false,vertexShader:vertex,
   uniforms:{source:{value:target.texture},texel:{value:new T.Vector2(1,1)}},fragmentShader:`
    varying vec2 vUv;uniform sampler2D source;uniform vec2 texel;
    vec3 highlight(vec2 uv){vec3 c=texture2D(source,uv).rgb;float l=max(c.r,max(c.g,c.b));return c*max(0.,l-1.45)/max(.0001,l);}
    void main(){vec3 c=highlight(vUv)*.20;
      for(int i=0;i<8;i++){float a=float(i)*.78539816;c+=highlight(vUv+vec2(cos(a),sin(a))*texel*2.)*.10;}
      gl_FragColor=vec4(c,1.);
    }`});
  const compose=new T.ShaderMaterial({name:'Illustrated final color',depthTest:true,depthWrite:true,depthFunc:T.AlwaysDepth,extensions:{fragDepth:true},toneMapped:true,vertexShader:vertex,
   uniforms:{...depthUniforms,source:{value:target.texture},contact:{value:aoTarget.texture},bloomMap:{value:bloomTarget.texture},aoPixel:{value:new T.Vector2()},bloomPixel:{value:new T.Vector2()},bloomStrength:{value:.12}},fragmentShader:`
    varying vec2 vUv;${reconstruct}
    #include <common>
    #include <dithering_pars_fragment>
    uniform sampler2D source,contact,bloomMap;uniform vec2 aoPixel,bloomPixel;uniform float bloomStrength;
    void main(){
      vec3 color=texture2D(source,vUv).rgb;
      float d=texture2D(depthMap,vUv).x,z=viewDepth(d),ao=0.,weight=0.;
      // Preserve world/viewmodel depth for the scope-only thermal overlay after this pass.
      gl_FragDepthEXT=d;
      for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){
        vec2 uv=vUv+vec2(float(x),float(y))*aoPixel;
        float sz=viewDepth(texture2D(depthMap,uv).x);
        float w=exp(-abs(sz-z)/max(.035,abs(z)*.012));
        ao+=texture2D(contact,uv).r*w;weight+=w;
      }}
      ao=ao/max(weight,.0001);color*=mix(vec3(.97,.985,1.),vec3(1.),ao)*ao;
      vec3 glow=texture2D(bloomMap,vUv).rgb*.2;
      for(int i=0;i<8;i++){float a=float(i)*.78539816;glow+=texture2D(bloomMap,vUv+vec2(cos(a),sin(a))*bloomPixel*3.).rgb*.1;}
      color+=glow*bloomStrength;
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <dithering_fragment>
    }`});
  compose.dithering=true;
  let width=0,height=0,disposed=false,enabled=true;
  function releaseTargets(){
   if(!width&&!height)return;
   // Adaptive low quality must release the previous high-DPR HDR/MSAA buffers,
   // not merely stop drawing them. setSize disposes their allocated GPU storage;
   // retain tiny descriptors so returning to postprocessing can resize lazily.
   target.setSize(1,1);aoTarget.setSize(1,1);bloomTarget.setSize(1,1);
   width=height=0;
  }
  function resize(){renderer.getDrawingBufferSize(size);if(size.x===width&&size.y===height)return;
   width=size.x;height=size.y;target.setSize(width,height);
   aoTarget.setSize(Math.max(1,width>>1),Math.max(1,height>>1));bloomTarget.setSize(Math.max(1,width>>2),Math.max(1,height>>2));
   depthUniforms.pixel.value.set(1/width,1/height);compose.uniforms.aoPixel.value.set(1/aoTarget.width,1/aoTarget.height);
   compose.uniforms.bloomPixel.value.set(1/bloomTarget.width,1/bloomTarget.height);bloomMaterial.uniforms.texel.value.set(1/width,1/height);
  }
  return {render(scene,camera){
   if(disposed){renderer.render(scene,camera);return;}
   if(!enabled||renderer.userData.cs16Quality==='low'||!renderer.capabilities.isWebGL2){releaseTargets();renderer.render(scene,camera);return;}
   resize();depthUniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);depthUniforms.cameraNear.value=camera.near;depthUniforms.cameraFar.value=camera.far;
   const saved=renderer.getRenderTarget(),auto=renderer.info.autoReset;renderer.info.autoReset=false;renderer.info.reset();
   const high=renderer.userData.cs16Quality==='high',samples=high?4:2;if(target.samples!==samples)target.samples=samples;aoMaterial.uniforms.strength.value=high?.60:.38;aoMaterial.uniforms.radius.value=high?.82:.65;compose.uniforms.bloomStrength.value=high?.10:.06;
   try{
    renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);
    quad.material=aoMaterial;renderer.setRenderTarget(aoTarget);renderer.render(quadScene,quadCamera);
    quad.material=bloomMaterial;renderer.setRenderTarget(bloomTarget);renderer.render(quadScene,quadCamera);
    quad.material=compose;renderer.setRenderTarget(saved);renderer.render(quadScene,quadCamera);
   }finally{renderer.setRenderTarget(saved);renderer.info.autoReset=auto;}
  },setEnabled(value){enabled=!!value;},dispose(){if(disposed)return;disposed=true;target.dispose();target.depthTexture.dispose();aoTarget.dispose();bloomTarget.dispose();aoMaterial.dispose();bloomMaterial.dispose();compose.dispose();geometry.dispose();},info:()=>({width,height,hdr,passes:4})};
 }
 g.CS16Cinematic={create};
})(window);
