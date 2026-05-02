import { bindDeepLink } from "./deeplinks.js";

const MARKET_TIMEZONE = "America/New_York";
const MARKET_OPEN_MINUTES = 9 * 60 + 30;
const MARKET_CLOSE_MINUTES = 16 * 60;
const REFRESH_INTERVAL_MS = 60 * 1000;

function getEasternParts() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIMEZONE,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return values;
}

function isMarketOpen() {
  const { weekday, hour, minute } = getEasternParts();
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);

  if (weekdayIndex < 1 || weekdayIndex > 5) {
    return false;
  }

  const currentMinutes = Number(hour) * 60 + Number(minute);
  return currentMinutes >= MARKET_OPEN_MINUTES && currentMinutes < MARKET_CLOSE_MINUTES;
}

function updateMarketStatus(statusEl) {
  const open = isMarketOpen();
  statusEl.textContent = open ? "🟢 MARKET OPEN" : "🔴 MARKET CLOSED";
  statusEl.style.color = open ? "#81ff9b" : "var(--text-dim)";
  statusEl.style.textShadow = open ? "0 0 10px rgba(129, 255, 155, 0.65)" : "none";
}

export function initBruce() {
  const statusEl = document.getElementById("bruce-status");
  const tradeEl = document.getElementById("bruce-trade-1");
  const pnlEl = document.getElementById("bruce-pnl");

  if (!statusEl || !tradeEl || !pnlEl) {
    return;
  }

  // Clicking the Bruce widget heading opens Robinhood options
  const header = statusEl.closest(".hud-widget")?.querySelector("h2");
  bindDeepLink(header, "robinhood-options");

  tradeEl.textContent = "No active trades";
  pnlEl.textContent = "P&L: --";

  updateMarketStatus(statusEl);
  window.setInterval(() => updateMarketStatus(statusEl), REFRESH_INTERVAL_MS);
}
