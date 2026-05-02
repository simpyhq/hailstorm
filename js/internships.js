import { bindDeepLink } from "./deeplinks.js";

const LOGIN_URL = "https://simpyhq.com/api/auth/login";
const LISTINGS_URL = "https://simpyhq.com/api/jobs/listings";
const LOGIN_PASSWORD = "Chrissim2006!";
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function renderFallback() {
  setValue("internship-applied", "--");
  setValue("internship-interview", "--");
  setValue("internship-offer", "--");
  setValue("internship-rejected", "--");
  setValue("internship-total", "--");
}

function countStatuses(listings) {
  const counts = {
    applied: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
    total: listings.length,
  };

  for (const listing of listings) {
    switch (listing?.status) {
      case "applied":
        counts.applied += 1;
        break;
      case "interview":
      case "phone_screen":
        counts.interview += 1;
        break;
      case "offer":
        counts.offer += 1;
        break;
      case "rejected":
        counts.rejected += 1;
        break;
      default:
        break;
    }
  }

  return counts;
}

async function fetchListings() {
  const loginResponse = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ password: LOGIN_PASSWORD }),
  });

  if (!loginResponse.ok) {
    throw new Error(`Internship login failed: ${loginResponse.status}`);
  }

  const listingsResponse = await fetch(LISTINGS_URL, {
    credentials: "include",
  });

  if (!listingsResponse.ok) {
    throw new Error(`Internship listings failed: ${listingsResponse.status}`);
  }

  const listings = await listingsResponse.json();
  return Array.isArray(listings) ? listings : [];
}

function renderCounts(counts) {
  setValue("internship-applied", counts.applied);
  setValue("internship-interview", counts.interview);
  setValue("internship-offer", counts.offer);
  setValue("internship-rejected", counts.rejected);
  setValue("internship-total", counts.total);
}

export function initInternships() {
  // Widget heading opens Handshake
  const header = document.getElementById("internship-total")?.closest(".hud-widget")?.querySelector("h2");
  bindDeepLink(header, "handshake");

  const refresh = async () => {
    try {
      const listings = await fetchListings();
      renderCounts(countStatuses(listings));
    } catch {
      renderFallback();
    }
  };

  renderFallback();
  refresh();
  window.setInterval(refresh, REFRESH_INTERVAL_MS);
}
