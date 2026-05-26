const STOCK_TICKER_ID = "stock-ticker";
const STOCK_TICKER_INNER_ID = "stock-ticker-inner";
const YAHOO_FALLBACK_MS = 60_000;
const STOCK_PRICE_EPSILON = 0.01;
const ALPACA_WEBSOCKET_URL = "wss://stream.data.alpaca.markets/v2/iex";
// Alpaca live streaming is DISABLED — API credentials must never ship to the
// browser. The ticker polls the keyless Yahoo proxy (/api/yahoo) instead.
// Rotate the old Alpaca key/secret that were previously hardcoded here.
const ALPACA_AUTH_MESSAGE = { action: "auth", key: "", secret: "" };
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
const ALPACA_STREAM_SYMBOLS = [
  "SPY",
  "QQQ",
  "NVDA",
  "TSLA",
  "AAPL",
  "AMD",
  "MSFT",
  "META",
  "AMZN",
  "GOOGL",
  "JPM",
  "GS",
  "BAC",
  "DIA",
  "IWM",
];
const YAHOO_ONLY_SYMBOLS = new Set(["BTC-USD", "ETH-USD", "VIX"]);
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
let stockStreamSocket = null;
let stockStreamReconnectTimeoutId = null;
let stockStreamReconnectDelayMs = 5_000;
let yahooFallbackIntervalId = null;
let yahooAllSymbolsIntervalId = null;

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

function getCurrentStocks() {
  return STOCK_SYMBOLS.map((symbol) => lastKnownStocks.get(symbol) ?? PLACEHOLDER_MAP.get(symbol)).filter(Boolean);
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

function getPreviousClose(stock) {
  if (!stock || !Number.isFinite(stock.price) || !Number.isFinite(stock.changePercent)) {
    return null;
  }

  const divisor = 1 + stock.changePercent / 100;
  if (!Number.isFinite(divisor) || divisor === 0) {
    return null;
  }

  const previousClose = stock.price / divisor;
  return Number.isFinite(previousClose) ? previousClose : null;
}

function buildTradeRecord(symbol, price) {
  const currentStock = lastKnownStocks.get(symbol) ?? PLACEHOLDER_MAP.get(symbol);
  const previousClose = getPreviousClose(currentStock);
  const changePercent =
    Number.isFinite(previousClose) && previousClose !== 0
      ? ((price - previousClose) / previousClose) * 100
      : currentStock?.changePercent ?? 0;

  return buildStockRecord(symbol, price, changePercent);
}

function isMeaningfulPriceChange(previousPrice, nextPrice) {
  if (!Number.isFinite(previousPrice) || !Number.isFinite(nextPrice)) {
    return true;
  }

  return Math.abs(nextPrice - previousPrice) > STOCK_PRICE_EPSILON;
}

function isMarketHours(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const values = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  const weekday = values.weekday;
  const hour = Number.parseInt(values.hour, 10);
  const minute = Number.parseInt(values.minute, 10);

  if (weekday === "Sat" || weekday === "Sun" || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return false;
  }

  const minutesSinceMidnight = hour * 60 + minute;
  return minutesSinceMidnight >= 8 * 60 + 30 && minutesSinceMidnight <= 17 * 60;
}

async function fetchYahooQuote(symbol) {
  const requestSymbol = symbol === "VIX" ? "^VIX" : symbol;
  const response = await fetch(
    `/api/yahoo?symbol=${encodeURIComponent(requestSymbol)}`,
  );

  if (!response.ok) {
    throw new Error(`Stock request failed for ${symbol}`);
  }

  const payload = await response.json();
  return extractStockData(symbol, payload);
}

async function fetchYahooFallback(symbol) {
  if (!YAHOO_ONLY_SYMBOLS.has(symbol)) {
    throw new Error(`Yahoo fallback not supported for ${symbol}`);
  }

  return fetchYahooQuote(symbol);
}

function clearStockStreamReconnect() {
  if (stockStreamReconnectTimeoutId !== null) {
    window.clearTimeout(stockStreamReconnectTimeoutId);
    stockStreamReconnectTimeoutId = null;
  }
}

function closeStockStream() {
  clearStockStreamReconnect();
  if (stockStreamSocket) {
    stockStreamSocket.onopen = null;
    stockStreamSocket.onmessage = null;
    stockStreamSocket.onerror = null;
    stockStreamSocket.onclose = null;
    stockStreamSocket.close();
    stockStreamSocket = null;
  }
}

function scheduleStockStreamReconnect() {
  if (stockStreamReconnectTimeoutId !== null || !isMarketHours()) {
    return;
  }

  stockStreamReconnectTimeoutId = window.setTimeout(() => {
    stockStreamReconnectTimeoutId = null;
    connectStockStream();
  }, stockStreamReconnectDelayMs);
  stockStreamReconnectDelayMs = Math.min(stockStreamReconnectDelayMs * 2, 30_000);
}

function handleTradeMessage(message) {
  const symbol = message?.S;
  const price = message?.p;
  if (!ALPACA_STREAM_SYMBOLS.includes(symbol) || !Number.isFinite(price)) {
    return;
  }

  const previousStock = lastKnownStocks.get(symbol) ?? PLACEHOLDER_MAP.get(symbol);
  if (!isMeaningfulPriceChange(previousStock?.price, price)) {
    return;
  }

  lastKnownStocks.set(symbol, buildTradeRecord(symbol, price));
  renderStocks(getCurrentStocks());
}

function handleStockStreamMessage(event) {
  let messages;

  try {
    messages = JSON.parse(event.data);
  } catch {
    return;
  }

  if (!Array.isArray(messages)) {
    return;
  }

  messages.forEach((message) => {
    if (message?.T === "connected") {
      stockStreamSocket?.send(JSON.stringify(ALPACA_AUTH_MESSAGE));
      return;
    }

    if (message?.T === "success" && message?.msg === "authenticated") {
      stockStreamSocket?.send(
        JSON.stringify({
          action: "subscribe",
          trades: ALPACA_STREAM_SYMBOLS,
        }),
      );
      return;
    }

    if (message?.T === "t") {
      handleTradeMessage(message);
    }
  });
}

function connectStockStream() {
  if (!isMarketHours()) {
    return;
  }

  closeStockStream();

  try {
    stockStreamSocket = new WebSocket(ALPACA_WEBSOCKET_URL);
  } catch {
    scheduleStockStreamReconnect();
    return;
  }

  stockStreamSocket.onopen = () => {
    stockStreamReconnectDelayMs = 5_000;
    stockStreamSocket?.send(JSON.stringify(ALPACA_AUTH_MESSAGE));
  };
  stockStreamSocket.onmessage = handleStockStreamMessage;
  stockStreamSocket.onerror = () => {
    closeStockStream();
    scheduleStockStreamReconnect();
  };
  stockStreamSocket.onclose = () => {
    stockStreamSocket = null;
    scheduleStockStreamReconnect();
  };
}

async function refreshSymbols(symbols, fetcher) {
  const results = await Promise.allSettled(symbols.map((symbol) => fetcher(symbol)));
  let hasPriceChange = false;

  results.forEach((result, index) => {
    const symbol = symbols[index];
    if (result.status === "fulfilled") {
      const previousStock = lastKnownStocks.get(symbol) ?? PLACEHOLDER_MAP.get(symbol);
      lastKnownStocks.set(symbol, result.value);
      if (isMeaningfulPriceChange(previousStock?.price, result.value.price)) {
        hasPriceChange = true;
      }
    }
  });

  if (hasPriceChange) {
    renderStocks(getCurrentStocks());
  }
}

function startYahooFallbackPolling() {
  if (yahooFallbackIntervalId !== null) {
    return;
  }

  const refreshFallbackSymbols = () =>
    refreshSymbols(Array.from(YAHOO_ONLY_SYMBOLS), fetchYahooFallback).catch(() => {
      renderStocks(getCurrentStocks());
    });

  refreshFallbackSymbols();
  yahooFallbackIntervalId = window.setInterval(refreshFallbackSymbols, YAHOO_FALLBACK_MS);
}

function startYahooAllSymbolsPolling() {
  if (yahooAllSymbolsIntervalId !== null) {
    return;
  }

  const refreshAllSymbols = () =>
    refreshSymbols(STOCK_SYMBOLS, fetchYahooQuote).catch(() => {
      renderStocks(getCurrentStocks());
    });

  refreshAllSymbols();
  yahooAllSymbolsIntervalId = window.setInterval(refreshAllSymbols, YAHOO_FALLBACK_MS);
}

export function initStocks() {
  if (hasInitializedStocks) {
    return;
  }

  hasInitializedStocks = true;
  const initialStocks = getCurrentStocks();
  renderStocks(initialStocks);

  // Pause stock ticker on hover
  const tickerInner = getTickerInner();
  if (tickerInner) {
    tickerInner.addEventListener("mouseenter", () => { tickerInner.style.animationPlayState = "paused"; });
    tickerInner.addEventListener("mouseleave", () => { tickerInner.style.animationPlayState = "running"; });
  }

  // Always poll the keyless Yahoo proxy — no Alpaca credentials in the browser.
  startYahooAllSymbolsPolling();
}
