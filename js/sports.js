import { bindDeepLink } from "./deeplinks.js";

const SPORTS_REFRESH_MS = 600_000;
const TEAM_CONFIG = [
  {
    elementId: "rangers-score",
    teamId: "13",
    url: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/13/schedule",
  },
  {
    elementId: "mavs-score",
    teamId: "6",
    url: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/6/schedule",
  },
  {
    elementId: "cowboys-score",
    teamId: "6",
    url: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/6/schedule",
  },
];

let sportsIntervalId = null;

function updateText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
    element.classList.remove('skeleton');
  }
}

function formatUpcomingDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    const time = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `Tonight ${time}`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getCompetitorInfo(event, teamId) {
  const competitors = event?.competitions?.[0]?.competitors;
  if (!Array.isArray(competitors)) {
    return null;
  }

  const team = competitors.find((competitor) => String(competitor?.team?.id) === String(teamId));
  const opponent = competitors.find((competitor) => String(competitor?.team?.id) !== String(teamId));

  if (!team || !opponent) {
    return null;
  }

  return { team, opponent };
}

function getMatchupPrefix(team) {
  return team?.homeAway === "home" ? "vs" : "@";
}

function getOpponentAbbreviation(opponent) {
  return opponent?.team?.abbreviation ?? opponent?.team?.shortDisplayName ?? "TBD";
}

function formatCompletedEvent(event, teamId) {
  const info = getCompetitorInfo(event, teamId);
  if (!info) {
    return "N/A";
  }

  const { team, opponent } = info;
  const teamScore = Number.parseInt(team?.score, 10);
  const opponentScore = Number.parseInt(opponent?.score, 10);
  if (!Number.isFinite(teamScore) || !Number.isFinite(opponentScore)) {
    return "N/A";
  }

  const result = teamScore > opponentScore ? "W" : "L";
  return `${result} ${teamScore}-${opponentScore} ${getMatchupPrefix(team)} ${getOpponentAbbreviation(opponent)}`;
}

function formatUpcomingEvent(event, teamId) {
  const info = getCompetitorInfo(event, teamId);
  if (!info) {
    return "N/A";
  }

  const { team, opponent } = info;
  return `${getMatchupPrefix(team)} ${getOpponentAbbreviation(opponent)} — ${formatUpcomingDate(event?.date)}`;
}

function selectRelevantEvent(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return null;
  }

  const upcoming = events
    .filter((event) => event?.status?.type?.completed === false)
    .sort((a, b) => new Date(a?.date).getTime() - new Date(b?.date).getTime())[0];

  if (upcoming) {
    return { event: upcoming, type: "upcoming" };
  }

  const completed = events
    .filter((event) => event?.status?.type?.completed === true)
    .sort((a, b) => new Date(b?.date).getTime() - new Date(a?.date).getTime())[0];

  if (completed) {
    return { event: completed, type: "completed" };
  }

  return null;
}

async function fetchTeamSummary(config) {
  try {
    const response = await fetch(config.url);
    if (!response.ok) {
      throw new Error("ESPN request failed");
    }

    const payload = await response.json();
    const selected = selectRelevantEvent(payload?.events);

    if (!selected) {
      return "Offseason";
    }

    return selected.type === "completed"
      ? formatCompletedEvent(selected.event, config.teamId)
      : formatUpcomingEvent(selected.event, config.teamId);
  } catch {
    return "N/A";
  }
}

async function updateSports() {
  try {
    const results = await Promise.all(
      TEAM_CONFIG.map(async (config) => ({
        elementId: config.elementId,
        value: await fetchTeamSummary(config),
      })),
    );

    results.forEach((result) => {
      updateText(result.elementId, result.value);
    });
  } catch {
    TEAM_CONFIG.forEach((config) => {
      updateText(config.elementId, "N/A");
    });
  }
}

export function initSports() {
  if (sportsIntervalId !== null) {
    return;
  }

  // Widget heading opens ESPN
  const header = document.getElementById("rangers-score")?.closest(".hud-widget")?.querySelector("h2");
  bindDeepLink(header, "espn");

  updateSports().catch(() => {});
  sportsIntervalId = window.setInterval(() => {
    updateSports().catch(() => {});
  }, SPORTS_REFRESH_MS);
}
