/* ============================================================
   live.js — real-time data for the J.A.R.V.I.S. homepage
   ------------------------------------------------------------
   Plain script (no module). Populates the HUD element IDs in
   index.html with live data and pulses the reactive orb light
   on each refresh.

   Feeds:
     weather   Open-Meteo            (keyless, direct)
     stocks    Yahoo via /api/yahoo  (keyless proxy)
     macro     Treasury 10Y + Yahoo  (DXY / VIX)
     sports    ESPN                  (keyless, direct)
     news      rss2json              (keyless, direct) -> ticker
     polymkt   /api/polymarket       (keyless proxy)
     canvas    /api/canvas-events    (token in Vercel env)
     email     /api/simplyhq         (password in Vercel env)
     spotify   Spotify Web API       (PKCE, in-browser auth)

   NOTE: the /api/* proxies only work when deployed to Vercel
   (or `vercel dev`). Opening index.html as a file:// will only
   light up the direct feeds (weather, sports, news, 10Y, Spotify).

   Namespaced module: exposes J.live.start(); main.js calls it. Orb pulses go
   through J.orb instead of a window global.
============================================================ */
(function (J) {
  'use strict';

  /* ---------- tiny DOM helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const setTxt = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  const setHtml = (id, v) => { const e = $(id); if (e) e.innerHTML = v; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function pulse(state, ms) {
    if (J.orb && J.orb.pulse) J.orb.pulse(state, ms);
  }

  function chgHtml(pct) {
    if (!Number.isFinite(pct)) return '<span style="opacity:.5">--</span>';
    const up = pct >= 0;
    return `<span style="color:${up ? 'var(--green)' : 'var(--red)'}">${up ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%</span>`;
  }

  function fmtPrice(sym, price) {
    if (!Number.isFinite(price)) return '$--';
    if (price >= 1000) return '$' + Math.round(price).toLocaleString();
    return '$' + price.toFixed(2);
  }

  function timeoutSignal(ms) {
    const c = new AbortController();
    const id = setTimeout(() => c.abort(), ms);
    return { signal: c.signal, clear: () => clearTimeout(id) };
  }

  /* shared snapshot used to build the live ticker */
  const ticker = { mkt: {}, news: [] };
  function renderTicker() {
    const m = ticker.mkt;
    const parts = [];
    if (m.spy) parts.push(`SPY ${m.spy}`);
    if (m.qqq) parts.push(`QQQ ${m.qqq}`);
    if (m.btc) parts.push(`BTC ${m.btc}`);
    if (m.ten) parts.push(`10Y ${m.ten}`);
    if (m.vix) parts.push(`VIX ${m.vix}`);
    const news = ticker.news.length ? ticker.news : ['SYSTEM NOMINAL'];
    const sep = ' &nbsp;//&nbsp; ';
    setHtml('ticker-inner', parts.join(sep) + (parts.length ? sep : '') + news.map(esc).join(sep));
  }

  /* ============================================================
     WEATHER — Open-Meteo (Norman, OK)
  ============================================================ */
  const WEATHER_URL =
    'https://api.open-meteo.com/v1/forecast?latitude=35.2226&longitude=-97.4395' +
    '&current=temperature_2m,weathercode,windspeed_10m' +
    '&daily=temperature_2m_max,temperature_2m_min' +
    '&temperature_unit=fahrenheit&timezone=America%2FChicago&forecast_days=1';

  function wxText(code) {
    if (code === 0) return 'Clear';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 48) return 'Foggy';
    if (code <= 57) return 'Drizzle';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 82) return 'Showers';
    if (code === 95) return 'Thunderstorm';
    return 'Unknown';
  }

  async function updateWeather() {
    try {
      const r = await fetch(WEATHER_URL);
      if (!r.ok) return;
      const p = await r.json();
      const cur = p.current, daily = p.daily;
      const t = cur.temperature_2m;
      const wind = cur.windspeed_10m ?? cur.wind_speed_10m;
      const code = cur.weathercode ?? cur.weather_code;
      const hi = daily.temperature_2m_max[0];
      const lo = daily.temperature_2m_min[0];
      if (![t, wind, code, hi, lo].every(Number.isFinite)) return;

      const cond = wxText(code).toUpperCase();
      const W = Math.round(wind), T = Math.round(t), HI = Math.round(hi), LO = Math.round(lo);
      setTxt('cc-temp', `${T}°F`); setTxt('cc-cond', cond);
      setTxt('cc-hi', `${HI}°`); setTxt('cc-lo', `${LO}°`); setTxt('cc-wind', `${W} MPH`);
      setTxt('gp-temp', `${T}°F`); setTxt('gp-cond', cond);
      setTxt('gp-hl', `HI ${HI}° / LO ${LO}°`); setTxt('gp-wind', `WIND ${W} MPH`);
      setTxt('br-temp', `${T}°F`);
      setTxt('br-sub', `${cond}\nHI ${HI}° / LO ${LO}°\nWIND ${W} MPH`);
    } catch (_) { /* keep last values */ }
  }

  /* ============================================================
     STOCKS + MACRO — Yahoo proxy + Treasury
  ============================================================ */
  const WATCH = [
    ['SPY', 'gp-spy'], ['QQQ', 'gp-qqq'], ['NVDA', 'gp-nvda'], ['TSLA', 'gp-tsla'],
    ['AAPL', 'gp-aapl'], ['AMD', 'gp-amd'], ['AMZN', 'gp-amzn'], ['META', 'gp-meta'],
    ['MSFT', 'gp-msft'],
  ];

  async function yahoo(sym) {
    const reqSym = sym === 'VIX' ? '^VIX' : sym;
    const r = await fetch(`/api/yahoo?symbol=${encodeURIComponent(reqSym)}`);
    if (!r.ok) throw new Error('yahoo ' + sym);
    const p = await r.json();
    const meta = p?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice ?? meta?.previousClose;
    const prev = meta?.chartPreviousClose ?? meta?.previousClose;
    if (!Number.isFinite(price) || !Number.isFinite(prev) || prev === 0) throw new Error('parse ' + sym);
    return { price, pct: ((price - prev) / prev) * 100 };
  }

  async function updateStocks() {
    pulse('processing', 1000);

    // watchlist
    await Promise.allSettled(WATCH.map(async ([sym, id]) => {
      try {
        const { price, pct } = await yahoo(sym);
        setHtml(id, `${fmtPrice(sym, price)} ${chgHtml(pct)}`);
        if (sym === 'SPY') ticker.mkt.spy = chgHtml(pct);
        if (sym === 'QQQ') ticker.mkt.qqq = chgHtml(pct);
      } catch (_) {}
    }));

    // corner cluster (SPY / QQQ / BTC)
    await Promise.allSettled([
      yahoo('SPY').then(({ pct }) => setHtml('m-spy', chgHtml(pct))).catch(() => {}),
      yahoo('QQQ').then(({ pct }) => setHtml('m-qqq', chgHtml(pct))).catch(() => {}),
      yahoo('BTC-USD').then(({ price, pct }) => {
        setHtml('m-btc', chgHtml(pct));
        setTxt('gp-btc', fmtPrice('BTC-USD', price));
        ticker.mkt.btc = fmtPrice('BTC-USD', price);
      }).catch(() => {}),
      yahoo('DX-Y.NYB').then(({ price }) => setTxt('gp-dxy', price.toFixed(1))).catch(() => {}),
      yahoo('VIX').then(({ price }) => { setTxt('gp-vix', price.toFixed(1)); ticker.mkt.vix = price.toFixed(1); }).catch(() => {}),
    ]);

    renderTicker();
  }

  async function updateTenYear() {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${ym}`;
    const { signal, clear } = timeoutSignal(8000);
    try {
      const r = await fetch(url, { signal });
      if (!r.ok) return;
      const xml = new DOMParser().parseFromString(await r.text(), 'application/xml');
      if (xml.querySelector('parsererror')) return;
      const entries = Array.from(xml.querySelectorAll('entry'));
      for (let i = entries.length - 1; i >= 0; i--) {
        const node = Array.from(entries[i].querySelectorAll('*')).find((n) => n.nodeName.endsWith('BC_10YEAR'));
        const v = node ? Number.parseFloat(node.textContent) : NaN;
        if (Number.isFinite(v)) {
          setTxt('gp-10y', `${v.toFixed(2)}%`);
          setTxt('m-10y', `${v.toFixed(2)}%`);
          ticker.mkt.ten = `${v.toFixed(2)}%`;
          renderTicker();
          return;
        }
      }
    } catch (_) {} finally { clear(); }
  }

  /* ============================================================
     SPORTS — ESPN (Dallas teams)
  ============================================================ */
  const TEAMS = [
    { id: 'sp-rangers', team: '13', url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/13/schedule' },
    { id: 'sp-mavs', team: '6', url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/6/schedule' },
    { id: 'sp-cowboys', team: '6', url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/6/schedule' },
  ];

  function competitor(ev, teamId) {
    const cs = ev?.competitions?.[0]?.competitors;
    if (!Array.isArray(cs)) return null;
    const team = cs.find((c) => String(c?.team?.id) === String(teamId));
    const opp = cs.find((c) => String(c?.team?.id) !== String(teamId));
    return team && opp ? { team, opp } : null;
  }
  const oppAbbr = (o) => o?.team?.abbreviation ?? o?.team?.shortDisplayName ?? 'TBD';
  const prefix = (t) => (t?.homeAway === 'home' ? 'vs' : '@');

  function fmtDate(ds) {
    const d = new Date(ds);
    if (Number.isNaN(d.getTime())) return 'TBD';
    const n = new Date();
    if (d.toDateString() === n.toDateString()) {
      return 'Tonight ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  async function teamSummary(cfg) {
    try {
      const r = await fetch(cfg.url);
      if (!r.ok) return 'N/A';
      const evs = (await r.json())?.events;
      if (!Array.isArray(evs) || !evs.length) return 'Offseason';
      const upcoming = evs.filter((e) => e?.status?.type?.completed === false)
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
      if (upcoming) {
        const i = competitor(upcoming, cfg.team);
        return i ? `${prefix(i.team)} ${oppAbbr(i.opp)} — ${fmtDate(upcoming.date)}` : 'N/A';
      }
      const done = evs.filter((e) => e?.status?.type?.completed === true)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      if (done) {
        const i = competitor(done, cfg.team);
        if (!i) return 'N/A';
        const ts = parseInt(i.team?.score, 10), os = parseInt(i.opp?.score, 10);
        if (!Number.isFinite(ts) || !Number.isFinite(os)) return 'N/A';
        return `${ts > os ? 'W' : 'L'} ${ts}-${os} ${prefix(i.team)} ${oppAbbr(i.opp)}`;
      }
      return 'N/A';
    } catch (_) { return 'N/A'; }
  }

  async function updateSports() {
    await Promise.allSettled(TEAMS.map(async (cfg) => setTxt(cfg.id, await teamSummary(cfg))));
  }

  /* ============================================================
     NEWS — rss2json -> ticker
  ============================================================ */
  const FEEDS = [
    'https%3A%2F%2Ffeeds.foxbusiness.com%2Ffoxbusiness%2Flatest',
    'https%3A%2F%2Ffeeds.a.dj.com%2Frss%2FRSSMarketsMain.xml',
    'https%3A%2F%2Fnypost.com%2Fbusiness%2Ffeed%2F',
    'https%3A%2F%2Fwww.espn.com%2Fespn%2Frss%2Fnfl%2Fnews',
  ].map((u) => 'https://api.rss2json.com/v1/api.json?rss_url=' + u);
  const FEED_SRC = ['FOX', 'WSJ', 'NYP', 'ESPN'];

  async function updateNews() {
    const results = await Promise.allSettled(FEEDS.map((u) => fetch(u).then((r) => r.ok ? r.json() : Promise.reject())));
    const heads = [];
    results.forEach((res, i) => {
      if (res.status === 'fulfilled' && res.value?.status === 'ok' && Array.isArray(res.value.items)) {
        res.value.items.slice(0, 4).forEach((it) => {
          const t = (it?.title || '').replace(/\s+/g, ' ').trim();
          if (t) heads.push(`${FEED_SRC[i]}: ${t}`);
        });
      }
    });
    if (heads.length) { ticker.news = heads; renderTicker(); }
  }

  /* ============================================================
     POLYMARKET — /api/polymarket
  ============================================================ */
  function jsonArr(v) {
    if (Array.isArray(v)) return v;
    if (typeof v !== 'string') return [];
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch (_) { return []; }
  }
  function probColor(v) { return v > 60 ? 'var(--green)' : v < 40 ? 'var(--red)' : 'var(--gold)'; }

  async function updatePolymarket() {
    const el = $('gp-poly');
    if (!el) return;
    try {
      const r = await fetch('/api/polymarket');
      if (!r.ok) throw 0;
      const data = await r.json();
      if (!Array.isArray(data)) throw 0;
      const rows = data.slice(0, 5).map((m) => {
        const prices = jsonArr(m?.outcomePrices), outs = jsonArr(m?.outcomes);
        const yi = outs.findIndex((o) => String(o).toLowerCase() === 'yes');
        const prob = Math.max(0, Math.min(100, parseFloat(prices[yi >= 0 ? yi : 0]) * 100));
        let q = (m?.question || 'N/A').trim();
        if (q.length > 42) q = q.slice(0, 39) + '...';
        return `<div class="fi"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
          <span style="opacity:.72;">${esc(q)}</span>
          <span style="color:${probColor(prob)};font-family:'Orbitron',sans-serif;">${Math.round(prob)}%</span></div></div>`;
      }).join('');
      el.innerHTML = rows || `<div class="fi"><div style="opacity:.4">N/A</div></div>`;
    } catch (_) {
      el.innerHTML = `<div class="fi"><div style="opacity:.4">Unavailable</div></div>`;
    }
  }

  /* ============================================================
     CANVAS — /api/canvas-events
  ============================================================ */
  async function updateCanvas() {
    const el = $('gp-canvas');
    if (!el) return;
    try {
      const r = await fetch('/api/canvas-events');
      if (!r.ok) throw 0;
      const events = await r.json();
      const now = Date.now();
      const rows = (Array.isArray(events) ? events : [])
        .filter((e) => e?.title && e?.start_at)
        .map((e) => ({ ...e, ms: new Date(e.start_at).getTime() }))
        .filter((e) => Number.isFinite(e.ms) && e.ms >= now)
        .sort((a, b) => a.ms - b.ms)
        .slice(0, 5)
        .map((e) => {
          const due = new Date(e.start_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const urgent = e.ms - now <= 24 * 3600 * 1000;
          let t = e.title; if (t.length > 32) t = t.slice(0, 29) + '...';
          return `<div class="fi"><div class="ft"${urgent ? ' style="color:var(--amber)"' : ''}>${esc(due)}</div><div>${esc(t)}</div></div>`;
        }).join('');
      el.innerHTML = rows || `<div class="fi"><div style="opacity:.4">No upcoming events</div></div>`;
    } catch (_) {
      el.innerHTML = `<div class="fi"><div style="opacity:.4">Unavailable</div></div>`;
    }
  }

  /* ============================================================
     EMAIL — /api/simplyhq
  ============================================================ */
  async function updateEmail() {
    const el = $('gp-email');
    if (!el) return;
    try {
      const r = await fetch('/api/simplyhq?resource=emails');
      if (!r.ok) throw 0;
      const data = await r.json();
      const emails = Array.isArray(data) ? data : [];
      if (!emails.length) { el.innerHTML = `<div class="fi"><div style="opacity:.4">No new email</div></div>`; return; }
      el.innerHTML = emails.slice(0, 4).map((e) => `
        <div class="fi"><div class="ft">${e.unread ? 'UNREAD' : 'READ'}</div>
        <div style="opacity:${e.unread ? 0.82 : 0.52};">${esc(e.from || '')}</div>
        <div style="opacity:0.38;font-size:7.5px;">${esc(e.subject || '(no subject)')}</div></div>`).join('');
      // mirror the top message into the Comms corner
      const top = emails[0];
      setTxt('cc-mailfrom', top.from || '—');
      setTxt('cc-mailsub', top.subject || '');
    } catch (_) {
      el.innerHTML = `<div class="fi"><div style="opacity:.4">Connect portal</div></div>`;
    }
  }

  /* ============================================================
     SPOTIFY — Web API (PKCE, in-browser)
  ============================================================ */
  const SP = {
    clientId: '2515168d1cf64febbb4d8cd21a1fc6cf',
    redirect: window.location.origin + '/',
    scopes: 'user-read-currently-playing user-read-playback-state user-modify-playback-state',
  };
  let spPlaying = false;
  let spPoll = null;

  const spGetToken = () => {
    const t = localStorage.getItem('spotify_token');
    const exp = Number(localStorage.getItem('spotify_token_expiry'));
    return (!t || Date.now() > exp - 30000) ? null : t;
  };
  function spSave(d) {
    localStorage.setItem('spotify_token', d.access_token);
    localStorage.setItem('spotify_token_expiry', Date.now() + d.expires_in * 1000);
    if (d.refresh_token) localStorage.setItem('spotify_refresh', d.refresh_token);
  }
  async function spRefresh() {
    const rt = localStorage.getItem('spotify_refresh');
    if (!rt) return null;
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: SP.clientId, grant_type: 'refresh_token', refresh_token: rt }),
    });
    if (!res.ok) return null;
    const d = await res.json(); spSave(d); return d.access_token;
  }
  const spValid = async () => spGetToken() || (await spRefresh());

  async function spChallenge(v) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
    return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function spAuth() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const arr = new Uint8Array(64); crypto.getRandomValues(arr);
    const verifier = Array.from(arr, (b) => chars[b % chars.length]).join('');
    sessionStorage.setItem('spotify_verifier', verifier);
    const params = new URLSearchParams({
      client_id: SP.clientId, response_type: 'code', redirect_uri: SP.redirect,
      code_challenge_method: 'S256', code_challenge: await spChallenge(verifier), scope: SP.scopes,
    });
    window.location.href = 'https://accounts.spotify.com/authorize?' + params;
  }
  async function spExchange(code) {
    const verifier = sessionStorage.getItem('spotify_verifier');
    if (!verifier) return null;
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: SP.clientId, grant_type: 'authorization_code', code, redirect_uri: SP.redirect, code_verifier: verifier }),
    });
    return res.ok ? res.json() : null;
  }

  function spUI({ track, artist, art, pct, playing }) {
    setTxt('spotify-track', track || '--');
    setTxt('spotify-artist', artist || '--');
    const prog = $('spotify-progress'); if (prog) prog.style.width = (pct || 0) + '%';
    spPlaying = !!playing;
    setTxt('spotify-play', playing ? '⏸' : '▶');
    const img = $('spotify-art');
    if (img && art) { img.src = art; img.style.opacity = '1'; }
  }

  async function spNowPlaying() {
    const token = await spValid();
    if (!token) { setTxt('spotify-track', 'Click to connect'); return; }
    const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', { headers: { Authorization: 'Bearer ' + token } });
    if (res.status === 204 || res.status === 404) { spUI({ track: 'Nothing playing', artist: '--', pct: 0, playing: false }); return; }
    if (!res.ok) return;
    const d = await res.json();
    spUI({
      track: d?.item?.name,
      artist: (d?.item?.artists || []).map((a) => a.name).join(', '),
      art: d?.item?.album?.images?.[1]?.url || d?.item?.album?.images?.[0]?.url,
      pct: Math.round(((d?.progress_ms || 0) / (d?.item?.duration_ms || 1)) * 100),
      playing: d?.is_playing,
    });
  }

  async function spControl(action) {
    const token = await spValid(); if (!token) return;
    const map = {
      play: ['PUT', 'play'], pause: ['PUT', 'pause'], next: ['POST', 'next'], prev: ['POST', 'previous'],
    };
    const [method, path] = map[action] || [];
    if (!method) return;
    await fetch('https://api.spotify.com/v1/me/player/' + path, { method, headers: { Authorization: 'Bearer ' + token } });
    setTimeout(spNowPlaying, 400);
  }

  async function initSpotify() {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      const d = await spExchange(code);
      if (d) { spSave(d); sessionStorage.removeItem('spotify_verifier'); }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    $('spotify-play')?.addEventListener('click', async () => {
      if (!(await spValid())) { spAuth(); return; }
      spControl(spPlaying ? 'pause' : 'play');
    });
    $('spotify-next')?.addEventListener('click', () => spControl('next'));
    $('spotify-prev')?.addEventListener('click', () => spControl('prev'));
    $('spotify-track')?.addEventListener('click', async () => { if (!spGetToken()) spAuth(); });

    if (await spValid()) {
      spNowPlaying();
      spPoll = setInterval(spNowPlaying, 5000);
    } else {
      setTxt('spotify-track', 'Click to connect');
    }
  }

  /* ============================================================
     ORCHESTRATION
  ============================================================ */
  function start() {
    // initial pull
    updateWeather();
    updateStocks();
    updateTenYear();
    updateSports();
    updateNews();
    updatePolymarket();
    updateCanvas();
    updateEmail();
    initSpotify();

    // refresh cadences
    setInterval(updateWeather, 600000);     // 10 min
    setInterval(updateStocks, 60000);       // 1 min
    setInterval(updateTenYear, 3600000);    // 1 hr
    setInterval(updateSports, 600000);      // 10 min
    setInterval(updateNews, 900000);        // 15 min
    setInterval(updatePolymarket, 300000);  // 5 min
    setInterval(updateCanvas, 1800000);     // 30 min
    setInterval(updateEmail, 300000);       // 5 min
  }

  J.live = { start };
})(window.JARVIS = window.JARVIS || {});
