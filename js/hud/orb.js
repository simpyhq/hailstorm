/* orb.js — arc-reactor canvas render loop, breathing light, pulse API.
   Writes the master --glow dimmer to :root every frame so the whole scene
   breathes with the orb. */
(function (J) {
  'use strict';

  let canvas, ctx, SZ, CX, CY;
  let frame = 0;
  let started = false;
  let pulseTO;

  const RINGS = [
    { r: 228, segs: 5, seg: 54, gap: 18, spd:  0.0017, lw: 2.0, a: 0.80 },
    { r: 200, segs: 3, seg: 92, gap: 28, spd: -0.0012, lw: 1.5, a: 0.62 },
    { r: 170, segs: 8, seg: 35, gap: 10, spd:  0.0030, lw: 2.5, a: 0.85 },
    { r: 142, segs: 4, seg: 68, gap: 22, spd: -0.0035, lw: 1.5, a: 0.52 },
    { r: 112, segs: 6, seg: 44, gap: 16, spd:  0.0050, lw: 1.2, a: 0.42 },
  ];

  const GYRO = [
    { r: 210, pitch: 0.40, yaw: 0,           rs:  0.00090, a: 0.30 },
    { r: 186, pitch: 0.65, yaw: Math.PI / 2.6, rs: -0.00065, a: 0.26 },
    { r: 158, pitch: 0.52, yaw: Math.PI / 4.8, rs:  0.00105, a: 0.22 },
    { r: 128, pitch: 0.78, yaw: Math.PI / 3.2, rs: -0.00140, a: 0.18 },
  ];

  const PARTS = [];

  function getBreathe() {
    const s = J.state.orbState;
    if (s === 'listening')  return 0.86 + Math.sin(frame * 0.12) * 0.22;   // alert hover
    if (s === 'processing') return 0.90 + Math.sin(frame * 0.09) * 0.30;
    if (s === 'speaking')   return 0.88 + Math.sin(frame * 0.13) * 0.34;
    return 0.80 + Math.sin(frame * 0.016) * 0.20;
  }

  function drawOrb() {
    ctx.clearRect(0, 0, SZ, SZ);
    const br = getBreathe();
    document.documentElement.style.setProperty('--glow', br.toFixed(3));

    ctx.globalCompositeOperation = 'source-over';
    const bg = ctx.createRadialGradient(CX, CY, 0, CX, CY, 300);
    bg.addColorStop(0,    `rgba(60,210,255,${0.10 * br})`);
    bg.addColorStop(0.38, `rgba(0,120,180,${0.04 * br})`);
    bg.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SZ, SZ);

    ctx.globalCompositeOperation = 'lighter';

    GYRO.forEach((b) => {
      b.rot += b.rs;
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(b.yaw + b.rot);
      ctx.scale(1, Math.cos(b.pitch));
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,212,255,${b.a * br})`;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00d4ff';
      ctx.stroke();
      ctx.restore();
    });

    ctx.shadowBlur = 0;

    RINGS.forEach((rng) => {
      rng.rot += rng.spd;
      const step = (rng.seg + rng.gap) * (Math.PI / 180);
      const arc  = rng.seg * (Math.PI / 180);
      ctx.lineWidth = rng.lw;
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#00d4ff';
      for (let s = 0; s < rng.segs; s++) {
        const a0 = rng.rot + s * step;
        ctx.beginPath();
        ctx.arc(CX, CY, rng.r, a0, a0 + arc);
        ctx.strokeStyle = `rgba(0,212,255,${rng.a * br})`;
        ctx.stroke();
      }
    });

    ctx.shadowBlur = 0;

    PARTS.forEach((p) => {
      p.angle += p.spd;
      const px = CX + Math.cos(p.angle) * p.r;
      const py = CY + Math.sin(p.angle) * p.r * Math.cos(p.tilt);
      const vis = (Math.sin(p.angle - p.ph) * 0.5 + 0.5) * 0.75 + 0.25;
      ctx.beginPath();
      ctx.arc(px, py, p.sz, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,212,255,${p.a * vis * br})`;
      ctx.fill();
    });

    const sn = J.state.orbState === 'idle' ? 5 : 10;
    for (let i = 0; i < sn; i++) {
      const sy = CY + (Math.random() - 0.5) * 58;
      const sw = 10 + Math.random() * 88;
      const sa = (0.05 + Math.random() * 0.30) * br;
      const sg = ctx.createLinearGradient(CX - sw / 2, sy, CX + sw / 2, sy);
      sg.addColorStop(0,   'rgba(0,212,255,0)');
      sg.addColorStop(0.3, `rgba(80,224,255,${sa * 0.6})`);
      sg.addColorStop(0.5, `rgba(225,250,255,${sa})`);
      sg.addColorStop(0.7, `rgba(80,224,255,${sa * 0.6})`);
      sg.addColorStop(1,   'rgba(0,212,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(CX - sw / 2, sy - 0.75, sw, 1.5);
    }

    const layers = [
      { r: 82, a: 0.07 }, { r: 52, a: 0.15 }, { r: 30, a: 0.30 }, { r: 15, a: 0.56 }, { r: 6, a: 1.0 },
    ];
    layers.forEach(({ r, a }) => {
      const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, r);
      g.addColorStop(0,    `rgba(255,255,255,${a * br})`);
      g.addColorStop(0.38, `rgba(180,242,255,${a * 0.48 * br})`);
      g.addColorStop(1,    'rgba(0,212,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(CX, CY, r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalCompositeOperation = 'source-over';
    frame++;
  }

  function loop() { drawOrb(); requestAnimationFrame(loop); }

  function start() {
    if (started) return;
    started = true;
    canvas = J.$('orb-canvas');
    ctx = canvas.getContext('2d');
    SZ = 580;
    canvas.width = canvas.height = SZ;
    CX = SZ / 2; CY = SZ / 2;

    RINGS.forEach((r) => { r.rot = Math.random() * Math.PI * 2; });
    GYRO.forEach((b) => { b.rot = Math.random() * Math.PI * 2; });
    for (let i = 0; i < 300; i++) {
      const ri = RINGS[i % RINGS.length];
      PARTS.push({
        r: ri.r + (Math.random() - 0.5) * 28,
        angle: Math.random() * Math.PI * 2,
        spd: (0.0007 + Math.random() * 0.0042) * (Math.random() > 0.44 ? 1 : -1),
        sz: 0.4 + Math.random() * 1.5,
        a: 0.22 + Math.random() * 0.65,
        tilt: 0.15 + Math.random() * 0.7,
        ph: Math.random() * Math.PI * 2,
      });
    }
    loop();
  }

  function setState(s) { J.state.orbState = s; }

  // pulse to a state for `ms`, then fall back to idle (used on data refresh)
  function pulse(state, ms) {
    J.state.orbState = state;
    clearTimeout(pulseTO);
    pulseTO = setTimeout(() => { J.state.orbState = 'idle'; }, ms);
  }

  J.orb = { start, pulse, setState };
})(window.JARVIS = window.JARVIS || {});
