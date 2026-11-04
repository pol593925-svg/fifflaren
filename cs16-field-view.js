/* First-person optic rig shared by classic CS and Stone Coast. World aim always passes through screen center. */
(function (g) {
  const supported = new Set([
    'glock','usp','deagle','fiveseven','tec9','elite','famas','awp','scout','aug','sg552','rpg',
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
    // Open machined housing. Both walls of the shell are visible through the lens.
    const profile = [
      [0.034, -0.028],
      [0.039, -0.028],
      [0.043, -0.03],
      [0.044, -0.038],
      [0.042, -0.043],
      [0.042, -0.073],
      [0.045, -0.077],
      [0.045, -0.084],
      [0.039, -0.088],
      [0.034, -0.087],
      [0.034, -0.028],
    ];
    const housing = new T.LatheGeometry(
      profile.map(([r, z]) => new T.Vector2(r, z)),
      36,
    ).rotateX(Math.PI / 2);
    part(housing, metal, 0, 0.144, 0);
    for (const z of [-0.035, -0.077]) part(new T.TorusGeometry(0.04, 0.0058, 7, 28), metal, 0, 0.144, z);
    for (const x of [-0.039, 0.039]) box(metal, x, 0.143, -0.056, 0.008, 0.023, 0.046);
    box(edge, -0.026, 0.069, -0.045, 0.014, 0.018, 0.09);
    box(edge, 0.026, 0.069, -0.045, 0.014, 0.018, 0.09);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      box(edge, 0.053, 0.137 + Math.cos(a) * 0.014, -0.057 + Math.sin(a) * 0.014, 0.007, 0.004, 0.004);
    }
    part(new T.CircleGeometry(0.036, 24), glass, 0, 0.144, -0.071).name='fieldLens';
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
  function mount(gun, template, compact = false) {
    const [x, y, z] = gun.userData.grip.rail,
      sight = template.clone(true);
    const k = compact ? 0.7 : 1;
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
      0.198 * (1 - a) - x * a,
      -0.17 * (1 - a) - (hasOptic ? y + 0.081 : y + 0.012) * a,
      -0.515 + 0.042 * a,
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
