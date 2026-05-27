# Project Hailstorm

My personal AI command center. The home base where everything I'm building, watching, and working on lives in one place. Voice-controlled, integrated with the services I actually use, and built to stun the people I show it to.

---

## North Star

The ultimate vision is Iron Man's JARVIS, made real and personal to me. Not a chatbot in a window. A presence. I walk into my room, the HUD is alive on screen, Jarvis is listening. I say "what's the market doing" and the watchlist lights up while a voice gives me the read. I say "Bruce, what's the play on NVDA today" and Bruce surfaces an options trade analysis. I say "play Disco Lines" and the orb pulses with the beat. Every project I'm running, every market I'm watching, every appointment on my calendar, every email that matters, every position in my brokerage, every sub-agent I have spawned, all of it accessible by voice, surfaced visually, and unified under one interface.

The bar is simple. When someone sees me use this, they should not be able to look away.

---

## The Five Layers

I'm not building features. I'm building layers. Each layer makes the next one possible. Thinking this way keeps me from getting overwhelmed when I have twenty ideas at once.

**Display Layer.** The HUD itself. The thing you see. Visual polish, animation, layout, typography, the orb. This is what makes the first impression hit.

**Voice Layer.** Voice in and voice out. The conversational interface. This is what makes the system stop feeling like a dashboard and start feeling like a presence. The single highest-leverage upgrade for the movie moment.

**Integration Layer.** Connections to every external service I actually use. Spotify for music. Gmail for email. Google Calendar for schedule. Canvas for school. Tradier for options. Yahoo Finance for market data. ClarixHost for system metrics. Each integration unlocks new things Jarvis can show and act on.

**Agent Layer.** Jarvis is the primary agent, running on OpenClaw. The sub-agents already live below him with specific specialties:

- **Bruce** — Options assistant
- **Clarix** — Business assistant
- **Cipher** — Debugger
- **Vesper** — IGA Health researcher
- **Sentinel** — Trust and investments tracker

Each has its own model routing, its own memory, its own focus. They report up to Jarvis. I orchestrate them.

**Data Layer.** Persistent state. My project list, my notes, my contacts, my priorities, my goals. Starts simple with JSON files and markdown on the Mini. Grows into a real database when it needs to.

---

## Sequenced Roadmap

Order matters. Each phase is chosen so the next one is easier to build and the demo moment is bigger than the last.

### Phase 1: HUD Polish

**Goal:** Beautiful enough that first impression hits.

**Features:**
- Mouse-driven parallax across all elements
- Three.js orb rebuild for true 3D depth
- Volumetric light bleed from orb
- Information density pass with peripheral ambient readouts
- Tactical vocabulary pass (TGT, OBJ, NOMINAL, STANDBY codes)
- Hologram instability effects (scanline drift, occasional glitch frames)

**Estimated time:** One to two weeks

**Demo moment unlocked:** Someone walks into the room, sees the screen, and stops talking mid-sentence.

### Phase 2: Voice

**Goal:** Shows off interaction. Stops feeling like a dashboard, starts feeling like a presence.

**Features:**
- Voice input via OpenAI Realtime API or browser Speech API
- TTS output via ElevenLabs or OpenAI voices
- Wake word detection so it's always listening
- Visual feedback in the orb (pulses brighter when processing, animates when speaking)
- Routes voice queries through existing OpenClaw backend so Jarvis is the same brain across WhatsApp and HUD

**Estimated time:** Two to three weeks

**Demo moment unlocked:** I say "Jarvis" out loud and the orb responds. The room shifts from looking at a screen to participating in a conversation.

### Phase 3: Spotify Integration

**Goal:** First integration. Universal appeal. Demo magic in one sentence.

**Features:**
- Spotify Web Playback SDK embedded in HUD
- Now-playing widget with album art, track, artist
- Voice control for play, pause, skip, search by artist or song
- Orb visualizer that reacts to audio amplitude
- Queue management

**Estimated time:** One week

**Demo moment unlocked:** "Jarvis, play John Summit." Music starts. Anyone watching just witnessed magic.

### Phase 4: Real Market Data

**Goal:** Make the numbers actually real. Tie into existing infrastructure.

**Features:**
- Yahoo Finance proxy (already exists in repo /api) wired into market widgets
- Tradier API integration for live options positions and P&L (Bruce reads from this)
- Real-time watchlist updates for SPY, QQQ, NVDA, TSLA, AAPL, AMD, AMZN, META, MSFT
- Options chain viewer for active tickers
- Daily P&L bar with green/red coloring
- 10Y treasury, DXY, VIX live feeds

**Estimated time:** One to two weeks

**Demo moment unlocked:** Someone asks "wait is that real?" I say "that's my actual brokerage" and pull up a position I'm in.

### Phase 5: Sub-Agent Mission Control

**Goal:** The headline. The thing nobody else has.

**Features:**
- HUD panel showing all active sub-agents (Bruce, Clarix, Cipher, Vesper, Sentinel)
- Each agent shows current task, last activity, status indicator, model in use
- Real-time activity feed of what each agent is doing
- Voice command to delegate work to specific agents ("Cipher, debug this error log")
- Ability to spawn new agents from templates
- Same panel layout becomes the basis for Clarix's client-facing interface

**Estimated time:** Three to four weeks

**Demo moment unlocked:** "And here's where I run all my projects." Five agents working in parallel. Bruce watching options chains. Clarix monitoring business operations. Cipher waiting for the next debug request. Vesper digesting research. Sentinel tracking positions. Each visible. Each controllable. Closing line: "and this is where Clarix sells the same system to other people."

---

## Active Work

What I'm building right now. Updated as I go.

- [x] Initial HUD prototype deployed to project-hailstorm.vercel.app
- [x] Cinematic v2 HUD with arc reactor orb, boot sequence, glass panels, morning brief cards
- [x] Made JARVIS the homepage of the site (replacing old dashboard, archived to dashboard-old.html)
- [x] Claude Code installed on Mac Mini for direct repo editing
- [x] Mouse-driven parallax across all HUD elements
- [x] **Phase 1 (HUD Polish) complete** — lighting, density, tactical pass, Three.js orb

---

## Idea Parking Lot

Future ideas go here so they don't clutter the active work. Add freely. Promote to the roadmap when ready.

### Visual and HUD polish
- Three.js rebuild of orb for true 3D depth (Phase 1)
- Volumetric bloom that lights surrounding elements
- Hologram scanline drift and glitch frames
- 6 to 10 peripheral ambient readouts (atmospheric pressure, packet loss, OpenRouter token spend, container memory, GPU usage, Tailscale status)
- Boot sequence variations (different startups, different welcome lines by time of day)
- Workshop mode (when actively coding, HUD shifts to show code-relevant info)
- Trading mode (markets-focused layout during options sessions)
- Deeper night mode beyond current NM toggle
- Lock screen mode when idle for extended periods

### Voice
- Custom wake word training for "Jarvis"
- Multiple voice personalities to switch between
- Voice latency optimization for true real-time feel
- Voice memory across sessions ("Jarvis, remind me what we talked about yesterday")
- Whisper mode for late night use

### Integrations
- Gmail for email triage and morning briefing
- Google Calendar for schedule display and reminders
- Canvas for OU assignments, grades, due dates
- Notion or Linear for task management
- GitHub for code commits and Clarix client deployments
- Tradier for options account
- Yahoo Finance proxy (already in /api)
- News API for relevant headlines
- Weather API for accurate atmosphere widget
- Apple Health for sleep and recovery
- Smart home if I add HomeKit devices later

### Personal life modules
- Workout tracker (4-day upper/lower split, weights logged, progression visible)
- Golf scores and round history
- Reading list and progress
- Vegas trip planner (21st birthday May 2027, Fontainebleau, group coordination)
- Class schedule for Fall 2026 (18 credits, 4-day week with study blocks)
- Investment Club deal memo archive

### Finance
- Storage co-investor reporting (To The Point Storage, Simpson/Kichan Group)
- Personal net worth tracker
- Sentinel dashboard view for trust and investment positions

### Clarix
- Active client list with status indicators
- Per-client deployment dashboards (CPU, RAM, last interaction, model usage)
- Revenue tracker
- Client onboarding workflow automation
- Client-facing sub-panel matching the personal mission control UI so demos translate to sales

### Sub-agent expansions
Current roster: Bruce (Options), Clarix (Business), Cipher (Debugger), Vesper (IGA Health), Sentinel (Trust/Investments).

Future agents to consider:
- Email triage agent (sorts inbox, drafts replies, flags urgent)
- Morning brief agent (assembles overnight news, market open, calendar, weather)
- School agent (tracks Canvas assignments, deadlines, study schedule)
- Workout coach agent (adjusts split based on recovery, tracks PRs)
- Reading agent (summarizes saved articles, builds knowledge base)
- Travel agent (for the Vegas trip and beyond, books, tracks, plans)

---

## Shipped

Log of finished features with dates. Builds confidence over time.

- 2026-05-26: Initial HUD prototype live at project-hailstorm.vercel.app
- 2026-05-26: Cinematic v2 HUD with arc reactor orb, boot sequence, glass panels, morning brief
- 2026-05-26: JARVIS set as homepage, old dashboard archived to dashboard-old.html
- 2026-05-26: Claude Code installed on Mac Mini for direct repo editing
- 2026-05-26: HAILSTORM_ROADMAP.md created as project compass
- 2026-05-26: Real-time data wired into HUD (weather, markets, macro, sports, news, Polymarket, Canvas, email, Spotify); leaked secrets pulled from client code into Vercel env
- 2026-05-26: Homepage de-monolithed into css/hud + js/hud modules (window.JARVIS namespace)
- 2026-05-26: Phase 1 HUD Polish shipped — volumetric lighting, mouse-driven parallax, peripheral telemetry + tactical vocabulary, Three.js 3D orb rebuild

---

*Last updated: 2026-05-26*
