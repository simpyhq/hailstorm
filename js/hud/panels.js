/* panels.js — sidebar/tab + glass-panel behavior, morning brief cards, night mode. */
(function (J) {
  'use strict';

  let panel;

  function swTab(pane) {
    document.querySelectorAll('.gp-tab').forEach((t) => t.classList.toggle('active', t.dataset.pane === pane));
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.toggle('active', p.id === 'pane-' + pane));
  }

  function initPanelControls() {
    panel = J.$('glass-panel');

    document.querySelectorAll('.sb-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        const isOpen = panel.classList.contains('open');
        const cur = document.querySelector('.gp-tab.active')?.dataset.pane;
        document.querySelectorAll('.sb-btn').forEach((b) => b.classList.remove('active'));
        if (isOpen && cur === tab) {
          panel.classList.remove('open');
        } else {
          panel.classList.add('open');
          btn.classList.add('active');
          swTab(tab);
        }
      });
    });

    document.querySelectorAll('.gp-tab').forEach((t) => {
      t.addEventListener('click', () => swTab(t.dataset.pane));
    });
  }

  /* ---- morning brief ---- */
  const BCS = ['bc-atm', 'bc-mail', 'bc-qt'];
  let briefTO;
  function closeBc(id) { const e = J.$(id); if (e) e.classList.remove('show'); }
  function showBrief() {
    BCS.forEach((id, i) => setTimeout(() => { const e = J.$(id); if (e) e.classList.add('show'); }, i * 320));
    clearTimeout(briefTO);
    briefTO = setTimeout(() => BCS.forEach(closeBc), 9200);
  }

  /* ---- night mode ---- */
  function initNM() {
    let nmOn = false;
    const btn = J.$('nm-btn');
    btn.addEventListener('click', function () {
      nmOn = !nmOn;
      document.body.style.filter = nmOn ? 'brightness(0.42) saturate(0.28)' : '';
      this.style.color = nmOn ? 'var(--amber)' : '';
    });
  }

  /* corner clusters open the panel pane that matches their content */
  function initClusters() {
    const map = { tl: 'intel', tr: 'markets', bl: 'intel', br: 'life' };
    Object.entries(map).forEach(([pos, pane]) => {
      const el = document.querySelector('.cc.' + pos);
      if (!el) return;
      el.addEventListener('click', () => {
        document.querySelector('.sb-btn[data-tab="' + pane + '"]')?.click();
      });
    });
  }

  /* clicking the quote rotates to the next one */
  function initQuoteClick() {
    ['cc-quote', 'gp-quote'].forEach((id) => {
      const el = J.$(id);
      if (el) el.addEventListener('click', () => J.sim && J.sim.loadQuote && J.sim.loadQuote());
    });
  }

  function init() {
    initPanelControls();
    initNM();
    initClusters();
    initQuoteClick();
    J.$('brief-btn').addEventListener('click', showBrief);
    window.closeBc = closeBc; // compat for inline onclick on brief cards
  }

  J.panels = { init, showBrief, closeBc };
})(window.JARVIS = window.JARVIS || {});
