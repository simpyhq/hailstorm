const MACRO_REFRESH_MS = 3_600_000;
const FED_FUNDS_VALUE = 5.33;
const TEN_YEAR_URL =
  "https://api.fiscaldata.treasury.gov/services/api/v1/accounting/od/avg_interest_rates?fields=record_date,avg_interest_rate_amt,security_desc&filter=security_desc:eq:Treasury%20Notes&sort=-record_date&page[size]=1";
const DXY_URL = "https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=1d";

let macroIntervalId = null;

function updateText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
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

async function fetchTenYearValue() {
  const response = await fetch(TEN_YEAR_URL);
  if (!response.ok) {
    throw new Error("10Y request failed");
  }

  const payload = await response.json();
  const value = Number.parseFloat(payload?.data?.[0]?.avg_interest_rate_amt);
  if (!Number.isFinite(value)) {
    throw new Error("10Y payload missing value");
  }

  return value;
}

async function fetchDxyValue() {
  const response = await fetch(DXY_URL);
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
    const [tenYearResult, dxyResult] = await Promise.allSettled([fetchTenYearValue(), fetchDxyValue()]);

    const fedValue = `FED: ${FED_FUNDS_VALUE.toFixed(2)}%`;
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
