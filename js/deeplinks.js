/**
 * deeplinks.js
 * Smart deep-link router — opens the native app on mobile,
 * falls back to the web URL on desktop or if app isn't installed.
 */

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

/**
 * App registry
 * Each entry:
 *   ios     — URI scheme or universal link (tries first on iOS)
 *   android — Intent URI or scheme (tries first on Android)
 *   web     — Always-available fallback URL
 *   appStore — iOS App Store URL (fallback if scheme fails)
 *   playStore — Google Play URL (fallback if scheme fails)
 */
export const APPS = {
  canvas: {
    ios: "canvas-student://",
    android: "intent://canvas-student/#Intent;scheme=canvas-student;package=com.instructure.candroid;end",
    web: "https://canvas.ou.edu",
    appStore: "https://apps.apple.com/us/app/canvas-student/id480883488",
    playStore: "https://play.google.com/store/apps/details?id=com.instructure.candroid",
  },
  robinhood: {
    ios: "robinhood://",
    android: "intent://robinhood/#Intent;scheme=robinhood;package=com.robinhood.android;end",
    web: "https://robinhood.com",
    appStore: "https://apps.apple.com/us/app/robinhood/id938003185",
    playStore: "https://play.google.com/store/apps/details?id=com.robinhood.android",
  },
  "robinhood-options": {
    ios: "robinhood://options",
    android: "intent://robinhood/options#Intent;scheme=robinhood;package=com.robinhood.android;end",
    web: "https://robinhood.com/options-investing",
    appStore: "https://apps.apple.com/us/app/robinhood/id938003185",
    playStore: "https://play.google.com/store/apps/details?id=com.robinhood.android",
  },
  polymarket: {
    ios: "https://polymarket.com",  // no native app, universal link
    android: "https://polymarket.com",
    web: "https://polymarket.com",
  },
  handshake: {
    ios: "handshake://",
    android: "intent://handshake/#Intent;scheme=handshake;package=com.joinhandshake.android;end",
    web: "https://app.joinhandshake.com",
    appStore: "https://apps.apple.com/us/app/handshake-jobs-for-students/id1034064787",
    playStore: "https://play.google.com/store/apps/details?id=com.joinhandshake.android",
  },
  weather: {
    ios: "weather://",
    android: null,
    web: "https://weather.com",
    appStore: "https://apps.apple.com/us/app/weather/id1069513131",
  },
  spotify: {
    ios: "spotify://",
    android: "intent://spotify/#Intent;scheme=spotify;package=com.spotify.music;end",
    web: "https://open.spotify.com",
    appStore: "https://apps.apple.com/us/app/spotify/id324684580",
    playStore: "https://play.google.com/store/apps/details?id=com.spotify.music",
  },
  espn: {
    ios: "sportscenter://",
    android: "intent://sportscenter/#Intent;scheme=sportscenter;package=com.espn.score_center;end",
    web: "https://espn.com",
    appStore: "https://apps.apple.com/us/app/espn-live-sports-scores/id317469184",
    playStore: "https://play.google.com/store/apps/details?id=com.espn.score_center",
  },
};

/**
 * Open a deep link smartly.
 * On mobile: try the app scheme, fall back to App Store / Play Store / web after delay.
 * On desktop: go straight to the web URL.
 *
 * iOS-specific: uses a hidden iframe to attempt the URI scheme so Safari
 * doesn't open a new tab or show a "Leave Page?" prompt. Falls back to
 * App Store after 2s if the app isn't installed.
 *
 * @param {keyof APPS} appKey  - Key from APPS registry
 * @param {string} [webOverride] - Optional specific web URL override
 */
export function openLink(appKey, webOverride) {
  const app = APPS[appKey];
  if (!app) {
    if (webOverride) window.open(webOverride, "_blank");
    return;
  }

  const webUrl = webOverride || app.web;

  if (!isMobile) {
    window.open(webUrl, "_blank");
    return;
  }

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const scheme = isIOS ? app.ios : app.android;

  if (!scheme) {
    window.open(webUrl, "_blank");
    return;
  }

  // Universal links (https://) — open directly, no scheme tricks needed
  if (scheme.startsWith("https://") || scheme.startsWith("http://")) {
    window.open(scheme, "_blank");
    return;
  }

  const fallback = isIOS ? (app.appStore || webUrl) : (app.playStore || webUrl);

  if (isIOS) {
    // iOS: hidden iframe approach — doesn't open a new tab or trigger prompts.
    // If the app is installed, iOS intercepts the scheme and opens it.
    // If not, nothing happens and we fall back to App Store after 2s.
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;";
    iframe.src = scheme;
    document.body.appendChild(iframe);

    const fallbackTimer = setTimeout(() => {
      document.body.removeChild(iframe);
      window.location.href = fallback;
    }, 2000);

    // If app opened, page will hide — cancel the fallback
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          clearTimeout(fallbackTimer);
          // Clean up iframe after a moment
          setTimeout(() => {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
          }, 500);
        }
      },
      { once: true }
    );
  } else {
    // Android: intent URIs handle fallback natively, just navigate
    window.location.href = scheme;
  }
}

/**
 * Make an element a tappable deep link.
 * Adds cursor-pointer style and click handler.
 *
 * @param {HTMLElement} el
 * @param {keyof APPS} appKey
 * @param {string} [webOverride]
 */
export function bindDeepLink(el, appKey, webOverride) {
  if (!el) return;
  el.style.cursor = "pointer";
  el.title = isMobile ? "Tap to open app" : "Click to open";
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    openLink(appKey, webOverride);
  });
}
