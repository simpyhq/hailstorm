const CANVAS_URL = "/api/canvas-events";
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

function truncateTitle(title) {
  if (title.length <= 30) {
    return title;
  }

  return `${title.slice(0, 27)}...`;
}

function formatDueDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getUrgencyClass(dateString) {
  const dueTime = new Date(dateString).getTime();
  const delta = dueTime - Date.now();

  if (delta <= 24 * 60 * 60 * 1000) {
    return "canvas-due--urgent";
  }

  if (delta <= 3 * 24 * 60 * 60 * 1000) {
    return "canvas-due--soon";
  }

  return "canvas-due--ok";
}

function renderFallback(listEl, message = "--") {
  listEl.innerHTML = `<div class="canvas-row"><span>${message}</span></div>`;
}

function renderAssignments(listEl, assignments) {
  if (!assignments.length) {
    renderFallback(listEl, "N/A");
    return;
  }

  listEl.replaceChildren(
    ...assignments.map((assignment) => {
      const row = document.createElement("div");
      row.className = "canvas-row";

      const titleEl = document.createElement("span");
      titleEl.className = "canvas-title";
      titleEl.title = assignment.fullTitle;
      titleEl.textContent = assignment.title;

      const dueEl = document.createElement("span");
      dueEl.className = `canvas-due ${assignment.urgencyClass}`;
      dueEl.textContent = assignment.dueDate;

      row.append(titleEl, dueEl);
      return row;
    }),
  );
}

async function fetchAssignments() {
  const response = await fetch(CANVAS_URL);

  if (!response.ok) {
    throw new Error(`Canvas request failed: ${response.status}`);
  }

  const events = await response.json();
  const now = Date.now();

  return events
    .filter((event) => event?.title && event?.start_at)
    .map((event) => ({
      fullTitle: event.title,
      title: truncateTitle(event.title),
      dueDate: formatDueDate(event.start_at),
      urgencyClass: getUrgencyClass(event.start_at),
      startAtMs: new Date(event.start_at).getTime(),
    }))
    .filter((event) => Number.isFinite(event.startAtMs) && event.startAtMs >= now)
    .sort((a, b) => a.startAtMs - b.startAtMs)
    .slice(0, 5);
}

export function initCanvas() {
  const listEl = document.getElementById("canvas-list");
  if (!listEl) {
    return;
  }

  const refresh = async () => {
    try {
      const assignments = await fetchAssignments();
      renderAssignments(listEl, assignments);
    } catch {
      renderFallback(listEl);
    }
  };

  refresh();
  window.setInterval(refresh, REFRESH_INTERVAL_MS);
}
