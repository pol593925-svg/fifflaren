(function(g){
  'use strict';
  const layer=29;
  function create(T){
    const center=new T.Vector3(),edge=new T.Vector3(),lens=new T.Vector3();
    const hot=new T.MeshBasicMaterial({color:0xff6412,depthTest:true,depthWrite:false,fog:false,toneMapped:false});
    hot.onBeforeCompile=shader=>{
      shader.uniforms.heatLens={value:lens};
      shader.fragmentShader='uniform vec3 heatLens;\n'+shader.fragmentShader.replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\nif(distance(gl_FragCoord.xy,heatLens.xy)>heatLens.z)discard;gl_FragColor=vec4(1.0,0.39,0.07,1.0);');
    };
    function aperture(canvas,camera,scoped,glass){
      const w=canvas.width,h=canvas.height;if(!w||!h)return null;
      if(scoped)return lens.set(w/2,h/2,Math.hypot(w,h)*.13);
      if(!glass)return null;
      center.set(0,0,0).applyMatrix4(glass.matrixWorld).project(camera);
      edge.set(glass.geometry.parameters.radius,0,0).applyMatrix4(glass.matrixWorld).project(camera);
      const radius=Math.hypot((edge.x-center.x)*w,(edge.y-center.y)*h)/2;
      if(!Number.isFinite(radius)||radius<1||center.z< -1||center.z>1)return null;
      return lens.set((1+center.x)*w/2,(1+center.y)*h/2,radius);
    }
    function render(renderer,scene,camera,remotes){
      for(const r of remotes.values())for(const mesh of r.heatBody){
        if(r.alive&&r.group.visible)mesh.layers.enable(layer);else mesh.layers.disable(layer);
      }
      const bg=scene.background,mat=scene.overrideMaterial,mask=camera.layers.mask,clear=renderer.autoClear;
      const shadow=renderer.shadowMap,auto=shadow.autoUpdate,dirty=shadow.needsUpdate;
      try{
        // The normal pass has already written wall and weapon depth into this framebuffer.
        renderer.autoClear=false;shadow.autoUpdate=false;shadow.needsUpdate=false;
        scene.background=null;scene.overrideMaterial=hot;camera.layers.set(layer);
        renderer.render(scene,camera);
      }finally{
        camera.layers.mask=mask;scene.overrideMaterial=mat;scene.background=bg;
        renderer.autoClear=clear;shadow.autoUpdate=auto;shadow.needsUpdate=dirty;
      }
    }
    return {aperture,render,dispose:()=>hot.dispose()};
  }
  g.CS16HeatScope={create,layer};
})(window);
