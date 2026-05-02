const MACRO_REFRESH_MS = 3_600_000;
const FED_FUNDS_VALUE = 5.33;
const TEN_YEAR_DEFAULT = 4.28;
const DXY_DEFAULT = 99.8;
const TEN_YEAR_TIMEOUT_MS = 8_000;
const DXY_TIMEOUT_MS = 5_000;
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

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => window.clearTimeout(timeoutId),
  };
}

function getTreasuryUrl() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}${month}`;
}

function getXmlNodeTextBySuffix(root, suffix) {
  if (!root) {
    return null;
  }

  const nodes = root.querySelectorAll("*");
  for (const node of nodes) {
    if (node.nodeName.endsWith(suffix)) {
      return node.textContent?.trim() ?? null;
    }
  }

  return null;
}

export function renderMacroDefaults() {
  updateText("macro-fed", `FED: ${FED_FUNDS_VALUE.toFixed(2)}%`);
  updateText("macro-10y", `10Y: ${TEN_YEAR_DEFAULT.toFixed(2)}%`);
  updateText("macro-dxy", `DXY: ${DXY_DEFAULT.toFixed(1)}`);
}

async function fetchTenYearValue() {
  const { signal, clear } = createTimeoutSignal(TEN_YEAR_TIMEOUT_MS);

  try {
    const response = await fetch(getTreasuryUrl(), { signal });
    if (!response.ok) {
      throw new Error("10Y request failed");
    }

    const xmlText = await response.text();
    const xml = new DOMParser().parseFromString(xmlText, "application/xml");
    if (xml.querySelector("parsererror")) {
      throw new Error("10Y XML parse failed");
    }

    const entries = Array.from(xml.querySelectorAll("entry"));
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const value = Number.parseFloat(getXmlNodeTextBySuffix(entries[index], "BC_10YEAR"));
      if (Number.isFinite(value)) {
        return value;
      }
    }

    throw new Error("10Y payload missing value");
  } finally {
    clear();
  }
}

async function fetchDxyValue() {
  const { signal, clear } = createTimeoutSignal(DXY_TIMEOUT_MS);

  try {
    const response = await fetch(DXY_URL, { signal });
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
  } finally {
    clear();
  }
}

async function updateMacro() {
  try {
    const [tenYearResult, dxyResult] = await Promise.allSettled([fetchTenYearValue(), fetchDxyValue()]);

    const fedValue = `FED: ${FED_FUNDS_VALUE.toFixed(2)}%`;
    const tenYearValue =
      tenYearResult.status === "fulfilled"
        ? `10Y: ${tenYearResult.value.toFixed(2)}%`
        : `10Y: ${TEN_YEAR_DEFAULT.toFixed(2)}%`;
    const dxyValue =
      dxyResult.status === "fulfilled" ? `DXY: ${dxyResult.value.toFixed(1)}` : `DXY: ${DXY_DEFAULT.toFixed(1)}`;

    updateText("macro-fed", fedValue);
    updateText("macro-10y", tenYearValue);
    updateText("macro-dxy", dxyValue);
  } catch {
    renderMacroDefaults();
  }
}

export function initMacro() {
  if (macroIntervalId !== null) {
    return;
  }

  renderMacroDefaults();
  updateMacro().catch(() => {});
  macroIntervalId = window.setInterval(() => {
    updateMacro().catch(() => {});
  }, MACRO_REFRESH_MS);
}
