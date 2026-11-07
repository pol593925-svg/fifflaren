/* First-person optic rig shared by classic CS and Stone Coast. World aim always passes through screen center. */
(function (g) {
  const supported = new Set([
    'glock','usp','deagle','fiveseven','tec9','elite','famas','aug','sg552',
    'mp5',
    'ump45',
    'p90',
    'ak47',
    'm4a1',
    'galil',
    'mp7',
    'bizon',
    'vector',
    'm249',
  ]);
  function optic(T) {
    const root = new T.Group(),
      owned = new Set(),
      metal = new T.MeshStandardMaterial({ color: 0xc9c5b8, metalness: 0.30, roughness: 0.48 }),
      edge = new T.MeshStandardMaterial({ color: 0x405d6b, metalness: 0.45, roughness: 0.43 }),
      brass = new T.MeshStandardMaterial({color:0xb69a65,metalness:.6,roughness:.36}),
      glass = new T.MeshBasicMaterial({
        color: 0x6d9695,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        side: T.DoubleSide,
        forceSinglePass: true,
      }),
      dot = new T.MeshBasicMaterial({ color: 0xff6342, toneMapped: false });
    function part(geo, m, x, y, z) {
      owned.add(geo);
      const o = new T.Mesh(geo, m);
      o.position.set(x, y, z);
      root.add(o);
      return o;
    }
    function box(m, x, y, z, w, h, d) {
      const bevel=Math.min(.0015,w*.12,h*.12,d*.12);
      const outline=rounded(w-bevel*2,h-bevel*2,Math.min(w,h)*.16);
      const geometry=new T.ExtrudeGeometry(outline,{depth:d-bevel*2,steps:1,curveSegments:3,
        bevelEnabled:true,bevelSegments:2,bevelSize:bevel,bevelThickness:bevel});
      return part(geometry,m,x,y,z-d/2+bevel);
    }
    box(metal, 0, 0.071, -0.05, 0.061, 0.014, 0.100);
    box(edge, 0, 0.087, -0.057, 0.046, 0.026, 0.075);
    // Beveled rectangular holographic hood with a real open aperture, not a solid tube.
    function rounded(w,h,r) {
      const s=new T.Shape(),x=-w/2,y=-h/2;
      s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
      s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
      s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
      s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
    }
    function arch(w,h) {
      const s=new T.Shape(),x=w/2,y=h/2;
      s.moveTo(-x*.80,-y);s.lineTo(x*.80,-y);
      s.quadraticCurveTo(x,-y,x,-y*.65);s.lineTo(x*.93,y*.23);
      s.quadraticCurveTo(x*.88,y*.86,x*.48,y);
      s.quadraticCurveTo(0,y*1.15,-x*.48,y);
      s.quadraticCurveTo(-x*.88,y*.86,-x*.93,y*.23);s.lineTo(-x,-y*.65);
      s.quadraticCurveTo(-x,-y,-x*.80,-y);return s;
    }
    const hood=arch(.108,.094),opening=arch(.080,.068);
    hood.holes.push(new T.Path(opening.getPoints(12).reverse()));
    const housing=new T.ExtrudeGeometry(hood,{depth:.047,steps:1,curveSegments:12,bevelEnabled:true,bevelSegments:3,bevelSize:.0015,bevelThickness:.0015});
    part(housing,edge,0,.144,-.085);
    const rim=arch(.101,.087);rim.holes.push(new T.Path(arch(.090,.077).getPoints(12).reverse()));
    part(new T.ExtrudeGeometry(rim,{depth:.001,curveSegments:12,bevelEnabled:false}),brass,0,.144,-.035);
    for (const x of [-.045,.045]) {
      box(metal,x,.103,-.057,.013,.018,.080);
      for(const z of [-.034,-.079])part(new T.CylinderGeometry(.003,.003,.002,8).rotateZ(Math.PI/2),edge,x*1.17,.107,z);
    }
    box(edge, -0.026, 0.069, -0.045, 0.014, 0.018, 0.09);
    box(edge, 0.026, 0.069, -0.045, 0.014, 0.018, 0.09);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      box(edge, 0.053, 0.137 + Math.cos(a) * 0.014, -0.057 + Math.sin(a) * 0.014, 0.007, 0.004, 0.004);
    }
    part(new T.ShapeGeometry(opening,6), glass, 0, 0.144, -0.071).name='fieldLens';
    part(new T.CylinderGeometry(0.016, 0.016, 0.012, 12).rotateZ(Math.PI / 2), edge, 0.048, 0.137, -0.057);
    const reticle = part(new T.CircleGeometry(0.00125, 10), dot, 0, 0.144, -0.031);
    reticle.name = 'fieldReticle';
    reticle.visible = false;
    root.name = 'Field reflex optic';
    // All static housings and screws share three batches. Keep lens/dot separate
    // because thermal clipping and ADS use their transforms and visibility.
    for(const material of [metal,edge,brass]){
      const pieces=root.children.filter(o=>o.isMesh&&o.material===material),positions=[],normals=[],uvs=[];
      for(const piece of pieces){
        piece.updateMatrix();const geo=piece.geometry.index?piece.geometry.toNonIndexed():piece.geometry.clone();
        geo.applyMatrix4(piece.matrix);
        for(const value of geo.attributes.position.array)positions.push(value);
        for(const value of geo.attributes.normal.array)normals.push(value);
        if(geo.attributes.uv)for(const value of geo.attributes.uv.array)uvs.push(value);
        else for(let i=0;i<geo.attributes.position.count*2;i++)uvs.push(0);
        geo.dispose();piece.removeFromParent();
      }
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
      geo.computeBoundingSphere();part(geo,material,0,0,0);
    }
    return {
      root,
      dispose() {
        for (const geo of owned) geo.dispose();
        for (const m of [metal, edge, brass, glass, dot]) m.dispose();
      },
    };
  }
  function mount(gun, template, compact = false) {
    const [x, y, z] = gun.userData.grip.rail,
      sight = template.clone(true);
    const k = compact ? 0.48 : 0.70;
    sight.scale.setScalar(k);
    sight.position.set(x, y - 0.063*k, z + 0.05*k);
    gun.add(sight);
    return sight.getObjectByName('fieldReticle');
  }
  // Offset the viewmodel in camera space after sway and recoil. The dot stays on the firing ray.
  function align(gun, dot, amount, point) {
    if (!dot || amount <= 0) return;
    dot.updateMatrix(); dot.parent.updateMatrix(); gun.updateMatrix();
    point.setFromMatrixPosition(dot.matrix).applyMatrix4(dot.parent.matrix).applyMatrix4(gun.matrix);
    gun.position.x -= point.x * amount;
    gun.position.y -= point.y * amount;
  }
  function frame(right, aim, hasOptic, grip) {
    const a = Math.min(1, Math.max(0, aim));
    const rail = grip?.rail,
      x = rail?.[0] || 0,
      y = rail?.[1] ?? 0.063;
    right.set(
      0.19 * (1 - a) - x * a,
      -0.235 * (1 - a) - (hasOptic ? y + 0.081 : y + 0.012) * a,
      -0.48 - 0.053 * a,
    );
  }
  function bearing(yaw) {
    const deg = ((Math.round((-yaw * 180) / Math.PI) % 360) + 360) % 360;
    return (
      ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'][Math.round(deg / 45) % 8] +
      '   ' +
      String(deg).padStart(3, '0') +
      '°'
    );
  }
  g.CS16FieldView = { optic, mount, frame, align, bearing, supported: (id) => supported.has(id) };
})(window);
