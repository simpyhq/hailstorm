/* sim.js — clock, simulated host metrics, daily quote.
   (Peripheral ambient readouts get added here in Step 4.) */
(function (J) {
  'use strict';

  /* ---- clock ---- */
  function tick() {
    const n = new Date();
    const pad = (v) => String(v).padStart(2, '0');
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    J.setTxt('tb-clock',
      `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())} // ${days[n.getDay()]} ${pad(n.getMonth() + 1)}.${pad(n.getDate())}.${n.getFullYear()}`);
  }
  function startClock() { tick(); setInterval(tick, 1000); }

  /* ---- host metrics (synthetic — no agent yet) ---- */
  let cpu = 44, ram = 61, disk = 37;
  const rflux = (v, r) => Math.max(0, Math.min(100, v + (Math.random() - 0.5) * r));
  function sysUpdate() {
    cpu = rflux(cpu, 5); ram = rflux(ram, 2.5); disk = rflux(disk, 0.7);
    const c = cpu.toFixed(0) + '%', r = ram.toFixed(0) + '%', d = disk.toFixed(0) + '%';
    J.setTxt('s-cpu', c); J.setTxt('s-ram', r); J.setTxt('s-disk', d);
    J.setTxt('gp-cpu', c); J.setTxt('gp-ram', r); J.setTxt('gp-disk', d);
    J.setWidth('gp-cpub', cpu); J.setWidth('gp-ramb', ram); J.setWidth('gp-diskb', disk);
  }
  function startSystem() { sysUpdate(); setInterval(sysUpdate, 2600); }

  /* ---- daily quote ---- */
  const QTS = [
    ['"The measure of intelligence is the ability to change."', 'Einstein'],
    ['"Risk comes from not knowing what you\'re doing."', 'Buffett'],
    ['"An investment in knowledge pays the best interest."', 'Franklin'],
    ['"In the middle of every difficulty lies opportunity."', 'Einstein'],
  ];
  function loadQuote() {
    const q = QTS[Math.floor(Math.random() * QTS.length)];
    const short = q[0].length > 80 ? q[0].slice(0, 78) + '…' : q[0];
    J.setTxt('cc-quote', short + ' — ' + q[1]);
    J.setTxt('gp-quote', q[0]);
  }

  /* ---- peripheral ambient readouts ----
     Tactical telemetry rail. Values are synthetic but structured so a real
     source (ClarixHost agent, OpenRouter usage) can swap straight in. Numbers
     stay specific (never round) and drift constantly. */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function startPeripherals() {
    let baro = 1013.2, pkt = 0.31, gpu = 63.4, up = 312.6, core = 47.8,
        lat = 12.4, tok = 41287, pwr = 3.21, sig = 98.7, net = 12.4;

    function step() {
      baro = clamp(baro + (Math.random() - 0.5) * 0.6, 995, 1035);
      pkt  = clamp(pkt + (Math.random() - 0.5) * 0.2, 0, 3);
      gpu  = clamp(gpu + (Math.random() - 0.5) * 6, 8, 99);
      up   = clamp(up + (Math.random() - 0.5) * 42, 40, 940);
      core = clamp(core + (Math.random() - 0.5) * 1.2, 38, 72);
      lat  = clamp(lat + (Math.random() - 0.5) * 3, 4, 60);
      tok += Math.floor(Math.random() * 220);
      pwr  = clamp(pwr + (Math.random() - 0.5) * 0.04, 3.05, 3.40);
      sig  = clamp(sig + (Math.random() - 0.5) * 0.5, 95, 99.9);
      net  = clamp(net + (Math.random() - 0.5) * 1.4, 6, 40);

      J.setTxt('tm-baro', baro.toFixed(1) + ' hPa');
      J.setTxt('tm-pkt', pkt.toFixed(2) + '%');
      J.setTxt('tm-gpu', gpu.toFixed(1) + '%');
      J.setTxt('tm-up', up.toFixed(1) + ' Mb/s');
      J.setTxt('tm-core', core.toFixed(1) + '°C');
      J.setTxt('tm-lat', lat.toFixed(1) + ' ms');
      J.setTxt('tm-tok', tok.toLocaleString());
      J.setTxt('tb-pwr', 'PWR ' + pwr.toFixed(2) + ' GW');
      J.setTxt('tb-sig', 'SIG ' + sig.toFixed(1) + '%');
      J.setTxt('s-net', net.toFixed(1) + ' MB/s');
    }
    step();
    setInterval(step, 1500);

    // occasional hologram glitch on a random telemetry row
    if (!J.reducedMotion) {
      setInterval(() => {
        const rows = document.querySelectorAll('#telemetry .tm-row');
        if (!rows.length) return;
        const r = rows[Math.floor(Math.random() * rows.length)];
        r.classList.add('glitch');
        setTimeout(() => r.classList.remove('glitch'), 340);
      }, 7000);
    }
  }

  J.sim = { startClock, startSystem, loadQuote, startPeripherals };
})(window.JARVIS = window.JARVIS || {});
