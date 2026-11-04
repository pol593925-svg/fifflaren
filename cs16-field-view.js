/* First-person optic rig shared by classic CS and Stone Coast. World aim always passes through screen center. */
(function (g) {
  const supported = new Set([
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
      metal = new T.MeshStandardMaterial({ color: 0x343a38, metalness: 0.63, roughness: 0.4 }),
      edge = new T.MeshStandardMaterial({ color: 0x606761, metalness: 0.58, roughness: 0.38 }),
      glass = new T.MeshBasicMaterial({
        color: 0x6d9695,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        side: T.DoubleSide,
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
      return part(new T.BoxGeometry(w, h, d), m, x, y, z);
    }
    box(metal, 0, 0.075, -0.05, 0.072, 0.024, 0.125);
    box(edge, 0, 0.096, -0.057, 0.046, 0.023, 0.075);
    for (const z of [-0.035, -0.077]) part(new T.TorusGeometry(0.04, 0.0058, 7, 28), metal, 0, 0.144, z);
    for (const x of [-0.039, 0.039]) box(metal, x, 0.143, -0.056, 0.008, 0.023, 0.046);
    part(new T.CircleGeometry(0.036, 24), glass, 0, 0.144, -0.071);
    part(new T.CylinderGeometry(0.016, 0.016, 0.012, 12).rotateZ(Math.PI / 2), edge, 0.048, 0.137, -0.057);
    const reticle = part(new T.CircleGeometry(0.00125, 10), dot, 0, 0.144, -0.031);
    reticle.name = 'fieldReticle';
    reticle.visible = false;
    root.name = 'Field reflex optic';
    return {
      root,
      dispose() {
        for (const geo of owned) geo.dispose();
        for (const m of [metal, edge, glass, dot]) m.dispose();
      },
    };
  }
  function frame(right, aim, hasOptic) {
    const a = Math.min(1, Math.max(0, aim));
    right.set(0.216 * (1 - a), -0.197 * (1 - a) - (hasOptic ? 0.144 : 0.058) * a, -0.6 + 0.085 * a);
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
  g.CS16FieldView = { optic, frame, bearing, supported: (id) => supported.has(id) };
})(window);
