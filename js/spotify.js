/**
 * spotify.js — Spotify Now Playing widget
 * Uses the Spotify Web API with PKCE auth flow.
 * Client ID is stored here; no backend required.
 */

const CLIENT_ID = "2515168d1cf64febbb4d8cd21a1fc6cf";
const REDIRECT_URI = window.location.origin + "/";
const SCOPES = "user-read-currently-playing user-read-playback-state user-modify-playback-state";
const POLL_INTERVAL_MS = 5000;
const TOKEN_KEY = "spotify_token";
const EXPIRY_KEY = "spotify_token_expiry";
const VERIFIER_KEY = "spotify_verifier";

let pollIntervalId = null;

// ── PKCE helpers ──────────────────────────────────────────────
function generateVerifier(length = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

async function generateChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function redirectToAuth() {
  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);
  sessionStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

async function exchangeCode(code) {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) return null;

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data;
}

function saveToken(data) {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(EXPIRY_KEY, Date.now() + data.expires_in * 1000);
  if (data.refresh_token) {
    localStorage.setItem("spotify_refresh", data.refresh_token);
  }
}

function getToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = Number(localStorage.getItem(EXPIRY_KEY));
  if (!token || Date.now() > expiry - 30000) return null;
  return token;
}

async function refreshToken() {
  const refresh = localStorage.getItem("spotify_refresh");
  if (!refresh) return null;

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refresh,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) return null;
  const data = await res.json();
  saveToken(data);
  return data.access_token;
}

async function getValidToken() {
  return getToken() || await refreshToken();
}

// ── UI helpers ────────────────────────────────────────────────
function updateUI({ track, artist, artUrl, progressPct, isPlaying }) {
  const trackEl = document.getElementById("spotify-track");
  const artistEl = document.getElementById("spotify-artist");
  const artEl = document.getElementById("spotify-art");
  const placeholderEl = document.getElementById("spotify-art-placeholder");
  const progressEl = document.getElementById("spotify-progress");
  const playBtn = document.getElementById("spotify-play");

  if (trackEl) { trackEl.textContent = track || "--"; trackEl.classList.remove('skeleton'); }
  if (artistEl) { artistEl.textContent = artist || "--"; artistEl.classList.remove('skeleton'); }
  if (progressEl) progressEl.style.width = `${progressPct || 0}%`;
  if (playBtn) playBtn.innerHTML = isPlaying ? "&#9646;&#9646;" : "&#9654;";

  if (artUrl && artEl && placeholderEl) {
    artEl.src = artUrl;
    artEl.classList.add("loaded");
    placeholderEl.classList.add("hidden");
  }
}

function showNotConnected() {
  const trackEl = document.getElementById("spotify-track");
  if (trackEl) trackEl.textContent = "Click to connect";
}

// ── API calls ─────────────────────────────────────────────────
async function fetchNowPlaying() {
  const token = await getValidToken();
  if (!token) { showNotConnected(); return; }

  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 204 || res.status === 404) {
    updateUI({ track: "Nothing playing", artist: "--", progressPct: 0, isPlaying: false });
    return;
  }

  if (!res.ok) return;
  const data = await res.json();

  const track = data?.item?.name || "--";
  const artist = data?.item?.artists?.map((a) => a.name).join(", ") || "--";
  const artUrl = data?.item?.album?.images?.[1]?.url || data?.item?.album?.images?.[0]?.url || "";
  const progress = data?.progress_ms || 0;
  const duration = data?.item?.duration_ms || 1;
  const progressPct = Math.round((progress / duration) * 100);
  const isPlaying = data?.is_playing || false;

  updateUI({ track, artist, artUrl, progressPct, isPlaying });
}

async function spotifyControl(action) {
  const token = await getValidToken();
  if (!token) return;

  const endpoints = {
    play: { method: "PUT", url: "https://api.spotify.com/v1/me/player/play" },
    pause: { method: "PUT", url: "https://api.spotify.com/v1/me/player/pause" },
    next: { method: "POST", url: "https://api.spotify.com/v1/me/player/next" },
    prev: { method: "POST", url: "https://api.spotify.com/v1/me/player/previous" },
  };

  const ep = endpoints[action];
  if (!ep) return;

  await fetch(ep.url, { method: ep.method, headers: { Authorization: `Bearer ${token}` } });
  setTimeout(fetchNowPlaying, 400);
}

// ── Init ──────────────────────────────────────────────────────
export async function initSpotify() {
  // Handle OAuth callback
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (code) {
    const tokenData = await exchangeCode(code);
    if (tokenData) {
      saveToken(tokenData);
      sessionStorage.removeItem(VERIFIER_KEY);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // Wire up controls
  document.getElementById("spotify-play")?.addEventListener("click", async () => {
    const token = await getValidToken();
    if (!token) { await redirectToAuth(); return; }
    const playBtn = document.getElementById("spotify-play");
    const isPlaying = playBtn?.innerHTML.includes("9646");
    await spotifyControl(isPlaying ? "pause" : "play");
  });

  document.getElementById("spotify-next")?.addEventListener("click", () => spotifyControl("next"));
  document.getElementById("spotify-prev")?.addEventListener("click", () => spotifyControl("prev"));

  // Click track/art to connect if not authed
  document.getElementById("spotify-track")?.addEventListener("click", async () => {
    if (!getToken()) await redirectToAuth();
  });

  // Start polling
  const token = await getValidToken();
  if (token) {
    fetchNowPlaying();
    pollIntervalId = setInterval(fetchNowPlaying, POLL_INTERVAL_MS);
  } else {
    showNotConnected();
    // Try refresh once
    const refreshed = await refreshToken();
    if (refreshed) {
      fetchNowPlaying();
      pollIntervalId = setInterval(fetchNowPlaying, POLL_INTERVAL_MS);
    }
  }
}
