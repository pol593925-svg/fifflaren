(function (g, f) {
  const api = f();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g) g.CS16WeaponAnimation = api;
})(typeof window !== 'undefined' ? window : null, () => {
  'use strict';
  const types = {
    glock:'pistol', usp:'pistol', deagle:'pistol', fiveseven:'pistol', tec9:'pistol', elite:'pistol',
    p90:'top', m249:'box', awp:'bolt', scout:'bolt', famas:'bullpup', aug:'bullpup',
    ak47:'curved', galil:'curved', mp5:'smg', ump45:'smg', mp7:'smg', vector:'smg', bizon:'helical', rpg:'launcher',
  };
  const reloadPath = {
    rifle:[-.27,.025,.12], curved:[-.27,.07,.60], pistol:[-.18,.025,.12], box:[-.23,.09,.21],
    smg:[-.22,-.025,.08], bolt:[-.15,.04,.09], top:[.22,.025,-.20], bullpup:[-.24,.16,.12],
    launcher:[.055,-.32,-.07], helical:[-.08,-.23,-.18],
  };
  function family(id) { return types[id] || 'rifle'; }
  const smooth = (x) => {
    x = Math.max(0, Math.min(1, x));
    return x * x * (3 - 2 * x);
  };
  // Fast mechanical opening, a readable hold, then a soft return. Never moves aim.
  function shot(id,age){
    const kind=family(id),a=Math.max(0,age),pistol=kind==='pistol',boltAction=kind==='bolt';
    const cycle=boltAction?smooth((a-.12)/.11)*(1-smooth((a-.34)/.20)):smooth(a/.012)*(1-smooth((a-.026)/.065));
    return {cycle,trigger:(1-smooth(a/.105))*.14,flashSize:boltAction?.30:pistol?.17:kind==='box'?.25:.22,flashLife:boltAction?78:pistol?60:48};
  }
  function pose(id, progress, shotAge, inspect = 0) {
    const kind = family(id),
      active = progress >= 0 && progress < 1,
      p = active ? progress : 0,
      out = active ? smooth((p - 0.12) / 0.16) * (1 - smooth((p - 0.56) / 0.18)) : 0,
      bolt = active
        ? Math.sin(smooth((p - 0.76) / 0.18) * Math.PI)
        : shot(id,shotAge).cycle,
      show = Math.sin(Math.max(0, Math.min(1, inspect)) * Math.PI);
    return {
      magY: out * reloadPath[kind][0],
      magZ: out * reloadPath[kind][1],
      magAngle: out * reloadPath[kind][2],
      boltZ: bolt * (kind === 'bolt' ? 0.09 : 0.035),
      slideZ: kind === 'pistol' ? bolt * 0.04 : 0,
      tilt: active ? Math.sin(p * Math.PI) * -0.4 : 0,
      inspectYaw: -show * 0.9,
      inspectRoll: show * 0.45,
      inspectX: -show * 0.13,
      kind,
      active,
    };
  }
  function bind(model) {
    const nodes = {};
    for (const name of ['magazine', 'bolt', 'slide', 'trigger', 'leftHand', 'rightHand']) {
      const n = model.getObjectByName(name);
      if (n) nodes[name] = { n, pos: n.position.clone(), rotation: n.rotation.clone(), visible: n.visible };
    }
    const left=nodes.leftHand,mag=nodes.magazine;
    if(left?.n.userData.magazineContact && mag){
      const contact=model.position.clone().fromArray(left.n.userData.magazineContact);contact.x-=.020;
      left.magContact=mag.n.worldToLocal(model.localToWorld(contact));
      left.target=left.magContact.clone();
    }
    return nodes;
  }
  function update(nodes, model, id, progress, shotAge, inspect) {
    const p = pose(id, progress, shotAge, inspect);
    for (const { n, pos, rotation, visible } of Object.values(nodes)) {
      n.position.copy(pos);
      n.rotation.copy(rotation);
      n.visible = visible;
    }
    if (nodes.magazine) {
      const n = nodes.magazine.n;
      n.position.y += p.magY;
      n.position.z += p.magZ;
      n.rotation.x += p.magAngle;
    }
    if (nodes.bolt) nodes.bolt.n.position.z += p.boltZ;
    if (nodes.slide) nodes.slide.n.position.z += p.slideZ;
    if (nodes.trigger) nodes.trigger.n.rotation.x -= shot(id,shotAge).trigger;
    if (nodes.leftHand && p.active) {
      const n = nodes.leftHand.n;
      n.visible = true;
      if(nodes.leftHand.magContact){
        const blend=smooth(progress/.18)*(1-smooth((progress-.72)/.21));
        const target=nodes.leftHand.target.copy(nodes.leftHand.magContact);
        n.position.lerp(model.worldToLocal(nodes.magazine.n.localToWorld(target)),blend);
        n.rotation.x+=p.magAngle*blend;
      }else{
        n.position.y+=p.magY*.75;n.position.z+=p.magZ+.06;n.rotation.x+=p.magAngle*.4;
      }
    }
    model.rotation.x += p.tilt;
    model.rotation.y += p.inspectYaw;
    model.rotation.z += p.inspectRoll;
    model.position.x += p.inspectX;
    return p;
  }
  return { family, shot, pose, bind, update };
});
