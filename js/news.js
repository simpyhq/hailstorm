const NEWS_REFRESH_MS = 900_000;
const FEEDS = [
  {
    source: "FOX BUSINESS",
    url: "https://api.allorigins.win/get?url=https://feeds.foxbusiness.com/foxbusiness/latest",
  },
  {
    source: "NY POST",
    url: "https://api.allorigins.win/get?url=https://nypost.com/business/feed/",
  },
  {
    source: "WASHINGTON EXAMINER",
    url: "https://api.allorigins.win/get?url=https://www.washingtonexaminer.com/feed",
  },
];

function getTickerElements() {
  return {
    track: document.getElementById("news-ticker-track"),
    copyA: document.getElementById("news-ticker-copy-a"),
    copyB: document.getElementById("news-ticker-copy-b"),
  };
}

function normalizeHeadline(text) {
  return text.replace(/\s+/g, " ").trim();
}

function extractItems(source, xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const items = Array.from(xml.querySelectorAll("item"));

  return items.slice(0, 5).flatMap((item) => {
    const title = normalizeHeadline(item.querySelector("title")?.textContent ?? "");
    if (!title) {
      return [];
    }

    return `${source}: ${title}`;
  });
}

async function fetchFeed(feed) {
  const response = await fetch(feed.url);
  if (!response.ok) {
    throw new Error(`Feed request failed for ${feed.source}`);
  }

  const payload = await response.json();
  const xmlText = payload?.contents;
  if (typeof xmlText !== "string" || !xmlText.trim()) {
    throw new Error(`Feed payload missing XML for ${feed.source}`);
  }

  return extractItems(feed.source, xmlText);
}

function renderNewsTicker(headlines) {
  const { track, copyA, copyB } = getTickerElements();
  if (!track || !copyA || !copyB || headlines.length === 0) {
    return;
  }

  const tickerText = `${headlines.join(" | ")} |`;
  copyA.textContent = tickerText;
  copyB.textContent = tickerText;

  track.style.animation = "none";
  void track.offsetWidth;
  track.style.animation = "";
}

async function updateNews() {
  try {
    const results = await Promise.allSettled(FEEDS.map((feed) => fetchFeed(feed)));
    const headlines = results
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value);

    if (headlines.length === 0) {
      return;
    }

    renderNewsTicker(headlines);
  } catch {
    return;
  }
}

export function initNews() {
  updateNews().catch(() => {});
  window.setInterval(() => {
    updateNews().catch(() => {});
  }, NEWS_REFRESH_MS);
}
