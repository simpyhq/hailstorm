/* boot.js — startup sequence overlay. Calls onComplete the moment the app
   fades in (so data/animation start exactly at reveal). */
(function (J) {
  'use strict';

  const CHECKS = [
    { t: 'ok',   txt: 'NEURAL CORE INITIALIZED' },
    { t: 'ok',   txt: 'NETWORK LINK ESTABLISHED' },
    { t: 'ok',   txt: 'MARKET DATA STREAM CONNECTED' },
    { t: 'ok',   txt: 'ATMOSPHERIC SENSORS ONLINE' },
    { t: 'ok',   txt: 'ARC REACTOR STABLE — 3.2 GW' },
    { t: 'ok',   txt: 'OPENROUTER GATEWAY CONNECTED' },
    { t: 'ok',   txt: 'SECURITY PROTOCOLS ACTIVE' },
    { t: 'warn', txt: 'COMMS API PENDING AUTHORIZATION' },
  ];

  function run(onComplete) {
    const title = J.$('boot-title');
    const prog  = J.$('boot-progress');
    const fill  = J.$('boot-fill');
    const list  = J.$('boot-list');
    const welc  = J.$('boot-welcome');
    const flash = J.$('boot-flash');
    const bootEl = J.$('boot');
    const app   = J.$('app');

    let fc = 0;
    const flicker = setInterval(() => {
      title.style.opacity = fc % 2 === 0 ? '0.92' : '0.04';
      if (++fc > 10) { clearInterval(flicker); title.style.opacity = '1'; }
    }, 65);

    setTimeout(() => {
      prog.style.opacity = '1';
      let pct = 0;
      const fi = setInterval(() => {
        pct += 1.6 + Math.random() * 2.8;
        if (pct >= 100) { pct = 100; clearInterval(fi); }
        fill.style.width = pct + '%';
      }, 55);
    }, 450);

    setTimeout(() => {
      list.style.opacity = '1';
      CHECKS.forEach((ck, i) => {
        setTimeout(() => {
          const d = document.createElement('div');
          d.className = 'boot-check';
          const lbl = ck.t === 'ok'
            ? `<span class="bok">[ OK ]</span>&nbsp; `
            : `<span class="bwarn">[WARN]</span>&nbsp; `;
          d.innerHTML = lbl + ck.txt;
          list.appendChild(d);
          requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('show')));
        }, i * 215);
      });
    }, 750);

    setTimeout(() => { welc.style.opacity = '1'; }, 2900);

    setTimeout(() => {
      flash.style.opacity = '1';
      setTimeout(() => {
        flash.style.opacity = '0';
        bootEl.style.transition = 'opacity 0.5s ease';
        bootEl.style.opacity = '0';
        app.style.opacity = '1';
        if (onComplete) onComplete();
        setTimeout(() => { bootEl.style.display = 'none'; }, 600);
      }, 200);
    }, 3650);
  }

  J.boot = { run };
})(window.JARVIS = window.JARVIS || {});
