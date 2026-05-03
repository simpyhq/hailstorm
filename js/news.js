const NEWS_REFRESH_MS = 900_000;
const FEEDS = [
  {
    source: "FOX BUSINESS",
    url: "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.foxbusiness.com%2Ffoxbusiness%2Flatest",
  },
  {
    source: "NY POST",
    url: "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fnypost.com%2Fbusiness%2Ffeed%2F",
  },
  {
    source: "WSJ",
    url: "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.a.dj.com%2Frss%2FRSSMarketsMain.xml",
  },
  {
    source: "ESPN NFL",
    url: "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.espn.com%2Fespn%2Frss%2Fnfl%2Fnews",
  },
  {
    source: "FED",
    url: "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.federalreserve.gov%2Freleases%2Frss%2Fmonetary.xml",
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

function extractItems(source, items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.slice(0, 5).flatMap((item) => {
    const title = normalizeHeadline(item?.title ?? "");
    if (!title) {
      return [];
    }

    return {
      text: `${source}: ${title}`,
      url: typeof item?.link === "string" ? item.link : "",
    };
  });
}

async function fetchFeed(feed) {
  const response = await fetch(feed.url);
  if (!response.ok) {
    throw new Error(`Feed request failed for ${feed.source}`);
  }

  const payload = await response.json();
  if (payload?.status !== "ok" || !Array.isArray(payload?.items)) {
    throw new Error(`Feed payload missing items for ${feed.source}`);
  }

  return extractItems(feed.source, payload.items);
}

function buildTickerCopy(items) {
  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    if (item.url) {
      const link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.className = "ticker-link";
      link.textContent = item.text;
      fragment.appendChild(link);
    } else {
      fragment.appendChild(document.createTextNode(item.text));
    }

    fragment.appendChild(document.createTextNode(" | "));
  });

  return fragment;
}

function renderNewsTicker(headlines) {
  const { track, copyA, copyB } = getTickerElements();
  if (!track || !copyA || !copyB || headlines.length === 0) {
    return;
  }

  copyA.replaceChildren(buildTickerCopy(headlines));
  copyB.replaceChildren(buildTickerCopy(headlines));

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

  // Pause ticker on hover
  const track = document.getElementById("news-ticker-track");
  if (track) {
    track.addEventListener("mouseenter", () => { track.style.animationPlayState = "paused"; });
    track.addEventListener("mouseleave", () => { track.style.animationPlayState = "running"; });
  }
}
