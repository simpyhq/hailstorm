/**
 * tradingview-widget.js
 * Embeds a TradingView Advanced Chart widget in the Bruce widget panel.
 * Configured for intraday options trading on large-cap watchlist names.
 */

export function initTradingView() {
  const container = document.getElementById("tradingview-chart");
  if (!container) return;

  try {
    if (typeof window.TradingView === "undefined" || typeof window.TradingView.widget === "undefined") {
      // Library not loaded yet — retry once after 2s
      setTimeout(() => {
        try { initTradingView(); } catch (e) { console.warn("TradingView retry failed:", e); }
      }, 2000);
      return;
    }

    new window.TradingView.widget({
      container_id: "tradingview-chart",
      symbol: "SPY",
      interval: "5",
      timezone: "America/Chicago",
      theme: "dark",
      style: "1",
      locale: "en",
      toolbar_bg: "#0a0e1a",
      enable_publishing: false,
      allow_symbol_change: true,
      autosize: true,
      hide_side_toolbar: false,
      withdateranges: true,
      details: true,
      hotlist: true,
      calendar: true,
      watchlist: ["SPY", "QQQ", "NVDA", "TSLA", "AAPL", "AMD", "AMZN", "META", "MSFT"],
      studies: [
        "Volume@tv-basicstudies",
        "VWAP@tv-basicstudies",
        "RSI@tv-basicstudies",
        "MASimple@tv-basicstudies",
      ],
      studies_overrides: {
        "moving average.length": 9,
      },
    });
  } catch (e) {
    console.warn("TradingView widget init failed:", e);
  }
}
