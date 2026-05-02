import { JarvisOrb } from "./orb.js";

const clockEl = document.getElementById("clock");
const dateEl = document.getElementById("date");
const canvas = document.getElementById("jarvis-orb");
const chatHistory = document.getElementById("chat-history");
const chatForm = document.getElementById("chat-form");
const chatText = document.getElementById("chat-text");
const mainInterface = document.getElementById("main-interface");
const bootOverlay = document.getElementById("boot-overlay");
const bootTitle = document.getElementById("boot-title");
const bootLoading = document.querySelector(".boot-loading");
const bootProgressBar = document.getElementById("boot-progress-bar");
const bootProgressText = document.getElementById("boot-progress-text");
const bootStatus = document.getElementById("boot-status");
const bootChecks = document.getElementById("boot-checks");
const bootWelcome = document.getElementById("boot-welcome");
const nightModeToggle = document.getElementById("night-mode-toggle");

const BOOT_CHECK_LINES = [
  "NEURAL NETWORK............OK",
  "VOICE RECOGNITION.........OK",
  "MARKET DATA...............OK",
  "WEATHER SYSTEMS...........OK",
  "SECURITY PROTOCOLS........OK",
];

const orb = new JarvisOrb(canvas);

let bootComplete = false;
let isNightMode = false;

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  clockEl.textContent = time;
  dateEl.textContent = date.toUpperCase();
}

function clearTrailingCursor() {
  const cursors = chatHistory.querySelectorAll(".cursor");
  cursors.forEach((cursor) => cursor.remove());
}

function scrollChatToBottom() {
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function createMessage(author, text, role) {
  const wrapper = document.createElement("div");
  wrapper.className = `chat-message ${role}`;

  const authorEl = document.createElement("div");
  authorEl.className = "chat-author";
  authorEl.textContent = author;

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.textContent = text;

  wrapper.append(authorEl, bubble);
  return { wrapper, bubble };
}

function appendMessage(author, text, role) {
  clearTrailingCursor();
  const { wrapper } = createMessage(author, text, role);
  chatHistory.appendChild(wrapper);
  scrollChatToBottom();
}

function typewriteMessage(author, text, role, speed = 30) {
  clearTrailingCursor();
  const { wrapper, bubble } = createMessage(author, "", role);
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  bubble.appendChild(cursor);
  chatHistory.appendChild(wrapper);
  scrollChatToBottom();

  return new Promise((resolve) => {
    let index = 0;
    const timer = window.setInterval(() => {
      bubble.firstChild?.remove();
      bubble.prepend(document.createTextNode(text.slice(0, index + 1)));
      bubble.appendChild(cursor);
      index += 1;
      scrollChatToBottom();

      if (index >= text.length) {
        window.clearInterval(timer);
        resolve();
      }
    }, speed);
  });
}

function typeBootLine(text, speed = 12) {
  const line = document.createElement("div");
  line.className = "boot-checks__line";
  bootChecks.appendChild(line);

  return new Promise((resolve) => {
    let index = 0;
    const timer = window.setInterval(() => {
      line.textContent = `> ${text.slice(0, index + 1)}`;
      index += 1;
      if (index >= text.length) {
        window.clearInterval(timer);
        resolve();
      }
    }, speed);
  });
}

function playBootTone() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  const context = new AudioContextCtor();
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const filter = context.createBiquadFilter();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(440, now);
  oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.18);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1200, now);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

  oscillator.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.36);
  oscillator.addEventListener("ended", () => {
    context.close().catch(() => {});
  });
}

function applyNightMode(enabled) {
  isNightMode = enabled;
  document.body.classList.toggle("night-mode", enabled);
  nightModeToggle.setAttribute("aria-pressed", String(enabled));
  orb.setNightMode(enabled);
}

function detectNightMode() {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 6;
}

function toggleListening() {
  if (!bootComplete) {
    return;
  }

  orb.toggleListening();
}

function handleSend(message) {
  appendMessage("User", message, "user");
  orb.setState("processing");

  window.setTimeout(async () => {
    orb.setState("speaking");
    await typewriteMessage("Jarvis", "Command acknowledged. Awaiting further instruction.", "jarvis");
    orb.setState("idle");
  }, 1000);
}

async function runBootSequence() {
  bootTitle.classList.add("is-visible");
  await wait(500);

  bootLoading.classList.add("is-visible");
  for (let progress = 0; progress <= 100; progress += 2) {
    bootProgressBar.style.width = `${progress}%`;
    bootProgressText.textContent = `${progress}%`;
    await wait(20);
  }

  bootStatus.classList.add("is-visible");
  bootTitle.classList.remove("is-visible");

  for (const line of BOOT_CHECK_LINES) {
    await typeBootLine(line, 10);
    await wait(35);
  }

  bootWelcome.classList.add("is-visible");
  await wait(650);

  mainInterface.classList.add("is-visible");
  bootOverlay.classList.add("is-hidden");
  await wait(500);

  orb.playBootReveal();
  playBootTone();
  await wait(1000);
  orb.setState("idle");
  bootComplete = true;
}

function bindEvents() {
  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!bootComplete) {
      return;
    }

    const message = chatText.value.trim();
    if (!message) {
      return;
    }

    chatText.value = "";
    handleSend(message);
  });

  chatText.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      chatForm.requestSubmit();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.code === "Space" && event.target !== chatText) {
      event.preventDefault();
      toggleListening();
    }
  });

  canvas.addEventListener("click", toggleListening);
  nightModeToggle.addEventListener("click", () => applyNightMode(!isNightMode));
}

async function startApp() {
  updateClock();
  window.setInterval(updateClock, 1000);
  applyNightMode(detectNightMode());
  orb.setState("processing");
  bindEvents();
  await runBootSequence();
}

window.addEventListener("load", () => {
  startApp().catch((error) => {
    console.error("Boot sequence failed", error);
    mainInterface.classList.add("is-visible");
    bootOverlay.classList.add("is-hidden");
    bootComplete = true;
    orb.setState("idle");
  });
});
