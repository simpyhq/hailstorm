/* orb3d.js — Three.js arc-reactor orb (true 3D depth).
   Overrides the canvas J.orb only when Three.js + WebGL are available;
   otherwise the canvas orb (orb.js) stays as the fallback so file:// review
   keeps working offline. Same contract as the canvas orb:
     - writes the master --glow dimmer to :root every frame
     - J.orb.pulse(state, ms) / setState(s) drive ring speed + core intensity
   Parallax tips the actual geometry via J.state.px / J.state.py. */
(function (J) {
  'use strict';

  if (!window.THREE) return;                 // lib missing -> keep canvas orb
  const THREE = window.THREE;

  // bail early if WebGL is unavailable, leaving the canvas fallback in place
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl') || probe.getContext('experimental-webgl'))) return;
  } catch (e) { return; }

  const SIZE = 620;
  let renderer, scene, camera, tilt, spin, coreGlow;
  let rings = [];
  let points;
  let frame = 0, started = false, pulseTO;

  function getBreathe() {
    const s = J.state.orbState;
    if (s === 'processing') return 0.90 + Math.sin(frame * 0.09) * 0.30;
    if (s === 'speaking')   return 0.88 + Math.sin(frame * 0.13) * 0.34;
    return 0.80 + Math.sin(frame * 0.016) * 0.20;
  }

  function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0,    'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(190,243,255,0.92)');
    grd.addColorStop(0.45, 'rgba(0,212,255,0.34)');
    grd.addColorStop(1,    'rgba(0,212,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.Texture(c);
    t.needsUpdate = true;
    return t;
  }

  function build() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    tilt = new THREE.Group(); scene.add(tilt);   // parallax tip
    spin = new THREE.Group(); tilt.add(spin);    // continuous rotation

    // volumetric core glow (additive sprite, always faces camera)
    coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0x9fe8ff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    coreGlow.scale.set(3.2, 3.2, 1);
    tilt.add(coreGlow);

    // hot core + additive halo
    spin.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xeafdff })
    ));
    spin.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })
    ));

    // gyroscope rings — full tori on independent axes & speeds
    const ringDefs = [
      { r: 2.35, tube: 0.013, ax: [0.30, 0.00, 0.00], spd:  0.0040, op: 0.80 },
      { r: 2.05, tube: 0.010, ax: [0.80, 0.40, 0.00], spd: -0.0030, op: 0.60 },
      { r: 1.75, tube: 0.017, ax: [0.20, 0.90, 0.00], spd:  0.0060, op: 0.85 },
      { r: 1.45, tube: 0.010, ax: [1.00, 0.20, 0.30], spd: -0.0072, op: 0.50 },
      { r: 1.15, tube: 0.009, ax: [0.50, 0.60, 0.20], spd:  0.0090, op: 0.45 },
    ];
    ringDefs.forEach((d) => {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(d.r, d.tube, 8, 96),
        new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: d.op, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      m.rotation.set(d.ax[0] * Math.PI, d.ax[1] * Math.PI, d.ax[2] * Math.PI);
      m.userData = { spd: d.spd, baseOp: d.op };
      spin.add(m); rings.push(m);
    });

    // segmented reactor arcs (partial tori)
    [{ r: 2.5, arc: 0.9, rot: 0 }, { r: 2.5, arc: 0.6, rot: 2.4 }, { r: 1.95, arc: 1.2, rot: 1.0 }].forEach((d) => {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(d.r, 0.022, 8, 64, d.arc),
        new THREE.MeshBasicMaterial({ color: 0x6fe0ff, transparent: true, opacity: 0.70, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      m.rotation.z = d.rot;
      m.userData = { spd: 0.0015, baseOp: 0.70 };
      spin.add(m); rings.push(m);
    });

    // orbiting particle cloud (depth-sorted by the renderer)
    const N = 440;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const rr = 1.2 + Math.random() * 1.5;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3]     = rr * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = rr * Math.cos(ph);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    points = new THREE.Points(pg, new THREE.PointsMaterial({
      color: 0x4fd6ff, size: 0.03, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    spin.add(points);
  }

  function loop() {
    const br = getBreathe();
    document.documentElement.style.setProperty('--glow', br.toFixed(3));

    const spinBase = J.state.orbState === 'idle' ? 0.0016 : 0.0045;
    spin.rotation.y += spinBase;
    points.rotation.y -= 0.0008;
    points.rotation.x += 0.0004;
    rings.forEach((m) => { m.rotation.z += m.userData.spd; m.material.opacity = m.userData.baseOp * br; });

    coreGlow.scale.setScalar(2.8 + br * 0.9);
    coreGlow.material.opacity = 0.5 + br * 0.5;

    // parallax tips the actual geometry (smoothed toward the engine's offset)
    const px = J.state.px || 0, py = J.state.py || 0;
    tilt.rotation.y += ((px * 0.32) - tilt.rotation.y) * 0.10;
    tilt.rotation.x += ((-py * 0.32) - tilt.rotation.x) * 0.10;

    renderer.render(scene, camera);
    frame++;
    requestAnimationFrame(loop);
  }

  function start() {
    if (started) return;
    const canvas = J.$('orb-canvas');
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (e) { return; }
    started = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(SIZE, SIZE, false);
    canvas.style.width = SIZE + 'px';
    canvas.style.height = SIZE + 'px';
    build();
    loop();
  }

  function setState(s) { J.state.orbState = s; }
  function pulse(state, ms) {
    J.state.orbState = state;
    clearTimeout(pulseTO);
    pulseTO = setTimeout(() => { J.state.orbState = 'idle'; }, ms);
  }

  // take over from the canvas orb
  J.orb = { start, pulse, setState, is3D: true };
})(window.JARVIS = window.JARVIS || {});
