import { JarvisOrb } from "./orb.js";
import { initBruce } from "./bruce.js";
import { initCanvas } from "./canvas.js";
import { initInternships } from "./internships.js";
import { initNews } from "./news.js";
import { initMacro } from "./macro.js";
import { initPolymarket } from "./polymarket.js";
import { initSports } from "./sports.js";
import { initStocks } from "./stocks.js";
import { initWeather } from "./weather.js";

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
const flashOverlay = document.getElementById("flash-overlay");
const leftPanel = document.querySelector(".left-panel");
const rightPanel = document.querySelector(".right-panel");
const orbStage = document.querySelector(".orb-stage");

const BOOT_CHECK_LINES = [
  "NEURAL NETWORK............OK",
  "VOICE RECOGNITION.........OK",
  "MARKET DATA...............OK",
  "WEATHER SYSTEMS...........OK",
  "SECURITY PROTOCOLS........OK",
];

const orb = new JarvisOrb(canvas);

let bootComplete = false;
let bootSkipped = false;
let systemsInitialized = false;
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
      if (bootSkipped) {
        window.clearInterval(timer);
        resolve();
        return;
      }

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

function revealMainInterface() {
  mainInterface.classList.add("is-visible");
  orbStage.classList.add("scale-in");
  leftPanel.classList.add("slide-in-left");
  rightPanel.classList.add("slide-in-right");
}

function initSystems() {
  if (systemsInitialized) {
    return;
  }

  systemsInitialized = true;
  initStocks();
  initWeather();
  initNews();
  initPolymarket();
  initSports();
  initMacro();
  initCanvas();
  initBruce();
  initInternships();
}

function skipBoot() {
  if (bootComplete || bootSkipped) {
    return;
  }

  bootSkipped = true;
  bootOverlay.style.transition = "opacity 0.3s ease";
  bootOverlay.classList.add("is-hidden");
  revealMainInterface();
  bootComplete = true;
  orb.setState("idle");
  initSystems();
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
  initSystems();
  bootTitle.classList.add("is-visible");
  await wait(800);
  if (bootSkipped) {
    return;
  }
  bootTitle.classList.add("flicker");
  await wait(400);
  if (bootSkipped) {
    return;
  }
  bootTitle.classList.remove("flicker");

  bootLoading.classList.add("is-visible");
  for (let progress = 0; progress <= 100; progress += 1) {
    bootProgressBar.style.width = `${progress}%`;
    bootProgressText.textContent = `${progress}%`;
    await wait(30 + Math.floor(Math.random() * 11) - 5);
    if (bootSkipped) {
      return;
    }
  }

  await wait(400);
  if (bootSkipped) {
    return;
  }
  bootTitle.classList.add("is-fading-out");
  bootTitle.classList.remove("is-visible");
  await wait(500);
  if (bootSkipped) {
    return;
  }
  bootTitle.classList.remove("is-fading-out");
  bootStatus.classList.add("is-visible");
  await wait(600);
  if (bootSkipped) {
    return;
  }

  for (const line of BOOT_CHECK_LINES) {
    await typeBootLine(line, 18);
    if (bootSkipped) {
      return;
    }
    await wait(80);
    if (bootSkipped) {
      return;
    }
  }

  await wait(500);
  if (bootSkipped) {
    return;
  }
  bootChecks.classList.add("is-hidden");
  await wait(400);
  if (bootSkipped) {
    return;
  }
  bootWelcome.classList.add("is-visible");
  await wait(1800);
  if (bootSkipped) {
    return;
  }

  revealMainInterface();

  flashOverlay.classList.add("is-active");
  await wait(150);
  if (bootSkipped) {
    return;
  }
  flashOverlay.classList.remove("is-active");

  bootOverlay.classList.add("is-hidden");
  await wait(1000);
  if (bootSkipped) {
    return;
  }

  orb.playBootReveal();
  playBootTone();
  await wait(800);
  if (bootSkipped) {
    return;
  }
  await typewriteMessage("Jarvis", "Welcome back, Christian. J.A.R.V.I.S. is online and standing by.", "jarvis");
  if (bootSkipped) {
    return;
  }
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
    if (!bootComplete && event.key === "Escape") {
      skipBoot();
      return;
    }

    if (event.code === "Space" && event.target !== chatText) {
      event.preventDefault();
      toggleListening();
    }
  });

  canvas.addEventListener("click", toggleListening);
  nightModeToggle.addEventListener("click", () => applyNightMode(!isNightMode));
  document.getElementById("boot-skip")?.addEventListener("click", skipBoot);
}

async function startApp() {
  initSystems();
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
    revealMainInterface();
    bootOverlay.classList.add("is-hidden");
    bootComplete = true;
    orb.setState("idle");
    initSystems();
  });
});
