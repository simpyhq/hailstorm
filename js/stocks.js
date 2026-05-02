const STOCK_TICKER_ID = "stock-ticker";
const STOCK_TICKER_INNER_ID = "stock-ticker-inner";
const STOCK_REFRESH_MS = 30_000;
const STOCK_SYMBOLS = [
  "SPY",
  "QQQ",
  "NVDA",
  "TSLA",
  "AAPL",
  "AMD",
  "BTC-USD",
  "ETH-USD",
  "MSFT",
  "META",
  "AMZN",
  "GOOGL",
  "JPM",
  "GS",
  "BAC",
  "DIA",
  "IWM",
  "VIX",
];
const OPTIONS_WATCHLIST = new Set(["SPY", "QQQ", "NVDA", "TSLA", "AAPL", "AMD"]);
const STOCK_LABELS = new Map([
  ["BTC-USD", "BTC"],
  ["ETH-USD", "ETH"],
]);
const PRICELESS_SYMBOLS = new Set(["VIX"]);
const PLACEHOLDER_MAP = new Map(
  [
    ["SPY", { price: 722.18, changePercent: 0.52 }],
    ["QQQ", { price: 493.44, changePercent: 0.74 }],
    ["NVDA", { price: 1089.0, changePercent: 2.1 }],
    ["TSLA", { price: 248.5, changePercent: -0.8 }],
    ["AAPL", { price: 282.0, changePercent: 3.8 }],
    ["AMD", { price: 104.2, changePercent: 1.2 }],
    ["BTC-USD", { price: 96200, changePercent: 1.9 }],
    ["ETH-USD", { price: 1810, changePercent: 0.5 }],
    ["MSFT", { price: 415.3, changePercent: 0.3 }],
    ["META", { price: 578.2, changePercent: 0.9 }],
    ["AMZN", { price: 195.4, changePercent: 1.1 }],
    ["GOOGL", { price: 162.8, changePercent: 0.6 }],
    ["JPM", { price: 245.1, changePercent: -0.2 }],
    ["GS", { price: 548.0, changePercent: 0.4 }],
    ["BAC", { price: 43.2, changePercent: -0.1 }],
    ["DIA", { price: 406.5, changePercent: 0.3 }],
    ["IWM", { price: 198.3, changePercent: -0.5 }],
    ["VIX", { price: 16.67, changePercent: -1.2 }],
  ].map(([symbol, values]) => [symbol, buildStockRecord(symbol, values.price, values.changePercent)]),
);
const lastKnownStocks = new Map(PLACEHOLDER_MAP);
let hasInitializedStocks = false;

function getContainer() {
  return document.getElementById(STOCK_TICKER_ID);
}

function getTickerInner() {
  return document.getElementById(STOCK_TICKER_INNER_ID);
}

function formatTickerLabel(symbol) {
  return STOCK_LABELS.get(symbol) ?? symbol;
}

function getDirection(changePercent) {
  return changePercent < 0 ? "down" : "up";
}

function buildStockRecord(symbol, price, changePercent) {
  return {
    symbol,
    label: formatTickerLabel(symbol),
    price,
    changePercent,
    direction: getDirection(changePercent),
  };
}

function formatPrice(symbol, value) {
  if (!Number.isFinite(value)) {
    return PRICELESS_SYMBOLS.has(symbol) ? "--.--" : "$--.--";
  }

  const prefix = PRICELESS_SYMBOLS.has(symbol) ? "" : "$";
  return `${prefix}${value.toFixed(2)}`;
}

function formatChange(changePercent) {
  if (!Number.isFinite(changePercent)) {
    return "▲+0.00%";
  }

  const direction = getDirection(changePercent);
  const arrow = direction === "down" ? "▼" : "▲";
  const sign = direction === "down" ? "-" : "+";
  return `${arrow}${sign}${Math.abs(changePercent).toFixed(2)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderChip(stock) {
  const groupClass = OPTIONS_WATCHLIST.has(stock.symbol)
    ? "stock-ticker-chip--options"
    : "stock-ticker-chip--market";

  return `
    <span class="stock-ticker-chip ${groupClass} stock-ticker-chip--${stock.direction}">
      <span class="stock-ticker-chip__symbol">${escapeHtml(stock.label)}</span>
      <span class="stock-ticker-chip__value">${escapeHtml(formatPrice(stock.symbol, stock.price))} ${escapeHtml(formatChange(stock.changePercent))}</span>
    </span>
  `;
}

function resetTickerAnimation(tickerInner) {
  tickerInner.classList.remove("is-animating");
  void tickerInner.offsetWidth;
  tickerInner.classList.add("is-animating");
}

function renderStocks(stocks) {
  const container = getContainer();
  const tickerInner = getTickerInner();
  if (!container || !tickerInner) {
    return;
  }

  const stockMarkup = stocks.map((stock) => renderChip(stock)).join("");
  tickerInner.innerHTML = `${stockMarkup}${stockMarkup}`;
  resetTickerAnimation(tickerInner);
}

function extractStockData(symbol, payload) {
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;
  const currentPrice = meta?.regularMarketPrice ?? meta?.previousClose;
  const previousClose = meta?.chartPreviousClose ?? meta?.previousClose;

  if (!Number.isFinite(currentPrice) || !Number.isFinite(previousClose) || previousClose === 0) {
    throw new Error(`Missing market data for ${symbol}`);
  }

  const changePercent = ((currentPrice - previousClose) / previousClose) * 100;
  return buildStockRecord(symbol, currentPrice, changePercent);
}

async function fetchStock(symbol) {
  const requestSymbol = symbol === "VIX" ? "^VIX" : symbol;
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(requestSymbol)}?interval=1d&range=1d`,
  );

  if (!response.ok) {
    throw new Error(`Stock request failed for ${symbol}`);
  }

  const payload = await response.json();
  return extractStockData(symbol, payload);
}

async function updateStocks() {
  const results = await Promise.allSettled(STOCK_SYMBOLS.map((symbol) => fetchStock(symbol)));
  const stocks = results.map((result, index) => {
    const symbol = STOCK_SYMBOLS[index];
    if (result.status === "fulfilled") {
      lastKnownStocks.set(symbol, result.value);
      return result.value;
    }

    return lastKnownStocks.get(symbol) ?? PLACEHOLDER_MAP.get(symbol);
  });

  renderStocks(stocks.filter(Boolean));
}

export function initStocks() {
  if (hasInitializedStocks) {
    return;
  }

  hasInitializedStocks = true;
  const initialStocks = STOCK_SYMBOLS.map((symbol) => lastKnownStocks.get(symbol) ?? PLACEHOLDER_MAP.get(symbol)).filter(Boolean);
  renderStocks(initialStocks);
  updateStocks().catch(() => {
    renderStocks(initialStocks);
  });
  window.setInterval(() => {
    updateStocks().catch(() => {
      const fallbackStocks = STOCK_SYMBOLS.map(
        (symbol) => lastKnownStocks.get(symbol) ?? PLACEHOLDER_MAP.get(symbol),
      ).filter(Boolean);
      renderStocks(fallbackStocks);
    });
  }, STOCK_REFRESH_MS);
}
