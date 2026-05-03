import { bindDeepLink } from "./deeplinks.js";

const POLYMARKET_URL =
  "/api/polymarket";
const POLYMARKET_REFRESH_MS = 300_000;

let polymarketIntervalId = null;

function getListElement() {
  return document.getElementById("polymarket-list");
}

function truncateQuestion(question, maxLength = 45) {
  if (typeof question !== "string") {
    return "N/A";
  }

  const trimmed = question.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clampProbability(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

function getProbabilityClass(value) {
  if (value > 60) {
    return "polymarket-prob--high";
  }

  if (value < 40) {
    return "polymarket-prob--low";
  }

  return "polymarket-prob--mid";
}

function getProbabilityColor(value) {
  if (value > 60) {
    return "#81ff9b";
  }

  if (value < 40) {
    return "#ff6b6b";
  }

  return "#ffd700";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeMarket(market) {
  const outcomePrices = parseJsonArray(market?.outcomePrices);
  const outcomes = parseJsonArray(market?.outcomes);
  const yesIndex = outcomes.findIndex((outcome) => String(outcome).toLowerCase() === "yes");
  const selectedIndex = yesIndex >= 0 ? yesIndex : 0;
  const probability = clampProbability(Number.parseFloat(outcomePrices[selectedIndex]) * 100);

  return {
    question: truncateQuestion(market?.question ?? "N/A"),
    probability,
    probabilityClass: getProbabilityClass(probability),
    probabilityColor: getProbabilityColor(probability),
  };
}

function renderFallback() {
  const list = getListElement();
  if (!list) {
    return;
  }

  list.innerHTML = `<div class="widget-row"><span>N/A</span></div>`;
  list.querySelectorAll('.skeleton').forEach(el => el.classList.remove('skeleton'));
}

function renderMarkets(markets) {
  const list = getListElement();
  if (!list) {
    return;
  }

  if (markets.length === 0) {
    renderFallback();
    return;
  }

  list.querySelectorAll('.skeleton').forEach(el => el.classList.remove('skeleton'));
  list.innerHTML = markets
    .map((market) => {
      const probabilityText = `${Math.round(market.probability)}%`;
      return `
        <article>
          <div class="polymarket-row">
            <span class="polymarket-question" title="${escapeHtml(market.question)}">${escapeHtml(market.question)}</span>
            <span class="polymarket-prob ${market.probabilityClass}">${escapeHtml(probabilityText)}</span>
          </div>
          <div class="polymarket-bar-wrap">
            <div class="polymarket-bar" style="width: ${market.probability.toFixed(1)}%; background: ${market.probabilityColor};"></div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function updatePolymarket() {
  try {
    const response = await fetch(POLYMARKET_URL);
    if (!response.ok) {
      throw new Error("Polymarket request failed");
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      throw new Error("Polymarket payload missing markets");
    }

    const markets = payload.slice(0, 5).map((market) => normalizeMarket(market));
    renderMarkets(markets);
  } catch {
    renderFallback();
  }
}

export function initPolymarket() {
  if (polymarketIntervalId !== null) {
    return;
  }

  // Widget heading opens Polymarket
  const header = document.querySelector("#polymarket-list")?.closest(".hud-widget")?.querySelector("h2");
  bindDeepLink(header, "polymarket");

  updatePolymarket().catch(() => {});
  polymarketIntervalId = window.setInterval(() => {
    updatePolymarket().catch(() => {});
  }, POLYMARKET_REFRESH_MS);
}
