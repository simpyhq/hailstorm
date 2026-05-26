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

  /* ---- peripheral ambient readouts (Step 4) ---- */
  function startPeripherals() { /* implemented in Step 4 */ }

  J.sim = { startClock, startSystem, loadQuote, startPeripherals };
})(window.JARVIS = window.JARVIS || {});
