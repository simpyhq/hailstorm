/**
 * tradingview-widget.js
 * Embeds a TradingView mini chart in the Bruce widget.
 * Shows SPY by default, switches to NVDA during market hours for options focus.
 */

function isMarketHours() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const values = Object.fromEntries(
    parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value])
  );
  const weekday = values.weekday;
  const hour = Number(values.hour);
  if (weekday === "Sat" || weekday === "Sun") return false;
  return hour >= 9 && hour < 17;
}

export function initTradingView() {
  const container = document.getElementById("tradingview-chart");
  if (!container || typeof window.TradingView === "undefined") {
    // TradingView script may not have loaded yet — retry once
    setTimeout(() => {
      if (typeof window.TradingView !== "undefined") initTradingView();
    }, 2000);
    return;
  }

  const symbol = isMarketHours() ? "NASDAQ:NVDA" : "AMEX:SPY";

  new window.TradingView.MiniWidget({
    container_id: "tradingview-chart",
    symbol,
    interval: "15",
    theme: "dark",
    style: "1",
    locale: "en",
    toolbar_bg: "#0d1220",
    enable_publishing: false,
    hide_top_toolbar: true,
    hide_legend: true,
    save_image: false,
    height: 130,
    width: "100%",
    backgroundColor: "rgba(13,18,32,0)",
    gridColor: "rgba(0,212,255,0.04)",
    lineColor: "#00d4ff",
    topColor: "rgba(0,212,255,0.12)",
    bottomColor: "rgba(0,212,255,0)",
  });
}
