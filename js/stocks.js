const STOCK_TICKER_ID = "stock-ticker";
const STOCK_REFRESH_MS = 60_000;
const STOCK_SYMBOLS = ["SPY", "QQQ", "NVDA", "AAPL", "AMD", "BTC-USD"];
const STOCK_PLACEHOLDERS = [
  { symbol: "SPY", label: "SPY", price: 518.18, changePercent: 0.52, direction: "up" },
  { symbol: "QQQ", label: "QQQ", price: 441.27, changePercent: 0.63, direction: "up" },
  { symbol: "NVDA", label: "NVDA", price: 903.12, changePercent: 1.14, direction: "up" },
  { symbol: "AAPL", label: "AAPL", price: 182.44, changePercent: -0.31, direction: "down" },
  { symbol: "AMD", label: "AMD", price: 164.7, changePercent: 0.47, direction: "up" },
  { symbol: "BTC-USD", label: "BTC", price: 63482.9, changePercent: 1.92, direction: "up" },
];

function getContainer() {
  return document.getElementById(STOCK_TICKER_ID);
}

function formatTickerLabel(symbol) {
  return symbol === "BTC-USD" ? "BTC" : symbol;
}

function formatPrice(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "--.--";
}

function getDirection(changePercent) {
  if (changePercent < 0) {
    return "down";
  }

  return "up";
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

function renderStocks(stocks) {
  const container = getContainer();
  if (!container) {
    return;
  }

  container.replaceChildren(
    ...stocks.map((stock) => {
      const item = document.createElement("span");
      item.className = `stock-chip stock-chip--${stock.direction}`;
      item.textContent = `${stock.label} ${formatPrice(stock.price)} ${formatChange(stock.changePercent)}`;
      return item;
    }),
  );
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
  return {
    symbol,
    label: formatTickerLabel(symbol),
    price: currentPrice,
    changePercent,
    direction: getDirection(changePercent),
  };
}

async function fetchStock(symbol) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
  );

  if (!response.ok) {
    throw new Error(`Stock request failed for ${symbol}`);
  }

  const payload = await response.json();
  return extractStockData(symbol, payload);
}

async function updateStocks() {
  try {
    const stocks = await Promise.all(STOCK_SYMBOLS.map((symbol) => fetchStock(symbol)));
    renderStocks(stocks);
  } catch {
    renderStocks(STOCK_PLACEHOLDERS);
  }
}

export function initStocks() {
  renderStocks(STOCK_PLACEHOLDERS);
  updateStocks().catch(() => {});
  window.setInterval(() => {
    updateStocks().catch(() => {});
  }, STOCK_REFRESH_MS);
}
