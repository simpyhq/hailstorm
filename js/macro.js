const MACRO_REFRESH_MS = 3_600_000;
const FRED_PROXY_BASE = "https://api.allorigins.win/raw?url=";
const FED_FUNDS_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS";
const TEN_YEAR_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10";
const DXY_URL = "https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=1d";

let macroIntervalId = null;

function updateText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function parseFredValue(csvText) {
  const lines = String(csvText)
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 1; index -= 1) {
    const parts = lines[index].split(",");
    const value = Number.parseFloat(parts.at(-1));
    if (Number.isFinite(value)) {
      return value;
    }
  }

  throw new Error("FRED CSV missing numeric data");
}

function getLastFiniteValue(values) {
  if (!Array.isArray(values)) {
    return null;
  }

  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(values[index])) {
      return values[index];
    }
  }

  return null;
}

async function fetchFredValue(url) {
  const response = await fetch(`${FRED_PROXY_BASE}${encodeURIComponent(url)}`);
  if (!response.ok) {
    throw new Error("FRED request failed");
  }

  return parseFredValue(await response.text());
}

async function fetchDxyValue() {
  const response = await fetch(`${FRED_PROXY_BASE}${encodeURIComponent(DXY_URL)}`);
  if (!response.ok) {
    throw new Error("DXY request failed");
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const metaPrice = result?.meta?.regularMarketPrice;
  const closePrice = getLastFiniteValue(result?.indicators?.quote?.[0]?.close);
  const value = metaPrice ?? closePrice;

  if (!Number.isFinite(value)) {
    throw new Error("DXY payload missing value");
  }

  return value;
}

async function updateMacro() {
  const defaults = {
    fed: "--",
    tenYear: "--",
    dxy: "--",
  };

  try {
    const [fedResult, tenYearResult, dxyResult] = await Promise.allSettled([
      fetchFredValue(FED_FUNDS_URL),
      fetchFredValue(TEN_YEAR_URL),
      fetchDxyValue(),
    ]);

    const fedValue = fedResult.status === "fulfilled" ? `FED: ${fedResult.value.toFixed(2)}%` : defaults.fed;
    const tenYearValue =
      tenYearResult.status === "fulfilled" ? `10Y: ${tenYearResult.value.toFixed(2)}%` : defaults.tenYear;
    const dxyValue = dxyResult.status === "fulfilled" ? `DXY: ${dxyResult.value.toFixed(1)}` : defaults.dxy;

    updateText("macro-fed", fedValue);
    updateText("macro-10y", tenYearValue);
    updateText("macro-dxy", dxyValue);
  } catch {
    updateText("macro-fed", defaults.fed);
    updateText("macro-10y", defaults.tenYear);
    updateText("macro-dxy", defaults.dxy);
  }
}

export function initMacro() {
  if (macroIntervalId !== null) {
    return;
  }

  updateMacro().catch(() => {});
  macroIntervalId = window.setInterval(() => {
    updateMacro().catch(() => {});
  }, MACRO_REFRESH_MS);
}
