/**
 * email-widget.js
 * Fetches recent emails from the portal API and displays subjects in the widget.
 * Uses the same auth pattern as internships.js.
 */

const LOGIN_URL = "https://simpyhq.com/api/auth/login";
const EMAIL_URL = "https://simpyhq.com/api/emails/recent";
const LOGIN_PASSWORD = "Chrissim2006!";
const REFRESH_MS = 5 * 60 * 1000; // 5 min

function getListEl() {
  return document.getElementById("email-list");
}

function renderFallback(msg = "--") {
  const listEl = getListEl();
  if (!listEl) return;
  listEl.innerHTML = `<div class="widget-row"><span class="email-subject">${msg}</span></div>`;
  listEl.querySelectorAll('.skeleton').forEach(el => el.classList.remove('skeleton'));
}

function renderEmails(emails) {
  const listEl = getListEl();
  if (!listEl || !emails.length) { renderFallback("No new email"); return; }

  listEl.querySelectorAll('.skeleton').forEach(el => el.classList.remove('skeleton'));
  listEl.replaceChildren(
    ...emails.slice(0, 4).map((email) => {
      const row = document.createElement("div");
      row.className = `widget-row${email.unread ? " email-unread" : ""}`;

      const subject = document.createElement("div");
      subject.className = "email-subject";
      subject.textContent = email.subject || "(no subject)";
      subject.title = email.subject || "";

      const from = document.createElement("div");
      from.className = "email-from";
      from.textContent = email.from || "";

      row.append(subject, from);
      return row;
    })
  );
}

async function fetchEmails() {
  // Login first
  const loginRes = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password: LOGIN_PASSWORD }),
  });
  if (!loginRes.ok) throw new Error("Email login failed");

  const emailRes = await fetch(EMAIL_URL, { credentials: "include" });
  if (!emailRes.ok) throw new Error("Email fetch failed");

  const data = await emailRes.json();
  return Array.isArray(data) ? data : [];
}

export function initEmailWidget() {
  const refresh = async () => {
    try {
      const emails = await fetchEmails();
      renderEmails(emails);
    } catch {
      // Portal email API may not exist yet — show graceful fallback
      renderFallback("Connect portal");
    }
  };

  refresh();
  setInterval(refresh, REFRESH_MS);
}
