# 🏟️ VenuePulse — AI-Native Venue Intelligence Platform

> **PromptWars Hackathon 2026** — Built with Google Gemini, Cloud Run, and real-time crowd simulation.

VenuePulse is an AI-powered venue management platform that transforms stadium operations through real-time crowd intelligence, predictive surge forecasting, and gamified crowd redistribution. Built as a unified single-service architecture for zero-latency deployment on Google Cloud Run.

---

## 🎯 Problem Statement

**60,000 people. 6 gates. 4 food courts. 90 minutes to manage chaos.**

Traditional venue management is reactive — staff spots a crowd problem, radios for help, then manually redirects foot traffic. By then, crush risks have escalated and the attendee experience has degraded.

VenuePulse flips this with **proactive AI intelligence**:
- **Predict** surge events before they happen
- **Redistribute** crowds with incentivized rewards
- **Guide** attendees via conversational AI concierge

---

## ✨ Key Features

### 🤖 AI Concierge (Gemini-Powered)
- Natural language Q&A about queues, crowds, exits
- 5 function-calling tools for real-time data access
- Rate-limited (10 req/min), context-aware, fallback-safe

### 📊 Real-Time Crowd Intelligence
- 22-zone simulation with physics-based crowd movement
- WebSocket broadcasting every 3 seconds
- Stadium SVG heatmap with density color coding
- Crowd density timeline chart

### ⚡ Predictive Surge Engine
- Phase-aware transition matrices (pre-match → goal → halftime → post-match)
- Gate congestion forecasting with confidence scores
- Automated admin alerts

### 🎮 Gamified Crowd Redistribution
- Reward offers: "20% off at Food Court East!" when Court West is packed
- Points system for smart exit behavior
- Attendee wallet with claim/redeem flow

### 🏟️ Admin Operations Dashboard
- Passkey-protected control panel
- Simulation speed control (1x–15x)
- Phase jump, goal events, reward triggers
- 6 KPI StatCards, heatmap, predictions panel

### ⌚ Smart Wristband Concept
- Phone-as-wristband simulator
- Haptic alerts (Web Vibration API)
- Push notifications (FCM)
- Zone-aware LED color simulation

### 📈 Live Analytics Dashboard
- 6 KPI cards: attendance, packed zones, busy zones, rising zones, avg wait, surge alerts
- Attendance over time area chart
- Zone health distribution pie chart
- People by zone type bar chart
- Zone density rankings table
- Zone comparison tool (side-by-side metrics with smart recommendation)
- CSV export of crowd snapshot data

### 🔔 Notification Center
- In-app toast banners for surge alerts, goals, reward triggers
- Bell icon with unread badge count
- Notification history panel with clear all
- Auto-triggered from WebSocket prediction data

### 📋 Admin Event Log
- Timestamped event feed: phase changes, goals, speed adjustments, prediction alerts
- Filterable by event type
- Collapsible panel with event count badge

### 📱 Progressive Web App
- Installable on mobile and desktop
- Service worker with network-first caching
- Offline fallback for static assets
- Apple Web App compatible

### 🧪 Test Coverage (235 Tests, 83% Coverage)
- **Simulator**: zones, tick mechanics, density clamping, goal freeze, reward boosts
- **Game Clock**: phase transitions, speed control, pause/resume, scoring, reset
- **Venue**: layout composition, adjacency graph integrity, capacity, coordinates
- **Predictor**: halftime surges, mass exit, early exit predictions, sorting
- **Rewards**: offer lifecycle, points accumulation, claiming, expiry
- **Rate Limiter**: limits, 429 responses, key isolation, sliding window
- **Models**: density levels, validation constraints, enum coverage
- **API**: health, crowd, admin, rewards, security headers (integration tests)
- **Security**: CSP/HSTS headers, OWASP injection attacks, passkey timing-safe comparison
- **Concierge**: Gemini chat, fallback responses, tool execution, history capping
- **WebSocket**: connection lifecycle, broadcast, shutdown, failed client cleanup
- **Config**: settings loading, production assertions, secret validation
- **FCM**: token registration, notification sending, broadcast

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                Google Cloud Run                  │
│                                                  │
│  ┌────────────┐  ┌──────────────────────────┐   │
│  │  Vite PWA  │  │      FastAPI Server       │   │
│  │  (static)  │  │                           │   │
│  │            │  │  ┌─────┐ ┌─────────────┐  │   │
│  │ • Attendee │  │  │Crowd│ │   Gemini     │  │   │
│  │ • Admin    │◄─┤  │ Sim │ │  AI Agent    │  │   │
│  │ • Wristband│  │  └─────┘ └─────────────┘  │   │
│  │            │  │  ┌─────┐ ┌─────────────┐  │   │
│  │   React +  │  │  │Pred │ │  Rewards     │  │   │
│  │  Tailwind  │  │  │Engne│ │  Engine      │  │   │
│  └────────────┘  │  └─────┘ └─────────────┘  │   │
│                  │  ┌─────────────────────┐   │   │
│                  │  │  WebSocket Manager  │   │   │
│                  │  └─────────────────────┘   │   │
│                  └──────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Stack
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Python 3.12 + FastAPI | API server, WebSocket, simulation |
| AI | Google Gemini 2.0 Flash | Function-calling concierge agent |
| Frontend | React 19 + Vite + TypeScript | PWA with 3 views |
| Styling | Tailwind CSS v4 | Light-mode design system |
| Charts | Recharts | Crowd density timeline |
| Deploy | Cloud Run (single container) | Zero cold-start, auto-scale |
| CI/CD | Cloud Build + Artifact Registry | Automated container build + deploy |
| Notifications | Firebase Cloud Messaging | Push alerts to wristband |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- Google Cloud API key (for Gemini)

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Set environment
set GOOGLE_API_KEY=your-gemini-key
set ADMIN_PASSKEY=venue2026

# Start
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173/` — frontend proxies API calls to `:8000`.

### Docker
```bash
docker build -t venuepulse .
docker run -p 8080:8080 -e GOOGLE_API_KEY=your-key -e ADMIN_PASSKEY=venue2026 venuepulse
```

---

## 📁 Project Structure

```
promptwars/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app + lifecycle
│   │   ├── config.py          # Environment config (Pydantic V2)
│   │   ├── crowd/
│   │   │   ├── simulator.py   # 22-zone crowd engine
│   │   │   ├── venue.py       # Zone layout + adjacency
│   │   │   ├── game_clock.py  # Match timer + phases
│   │   │   ├── predictor.py   # Surge forecasting
│   │   │   └── models.py      # Pydantic schemas
│   │   ├── agent/
│   │   │   ├── concierge.py   # Gemini function-calling agent
│   │   │   └── tools.py       # 5 agent tools
│   │   ├── gamification/
│   │   │   └── rewards.py     # Offer lifecycle + points
│   │   ├── notifications/
│   │   │   └── fcm.py         # Firebase push + simulated mode
│   │   ├── middleware/
│   │   │   ├── security.py    # CSP, HSTS, tracing headers
│   │   │   └── rate_limiter.py # 10 req/min sliding window
│   │   └── api/
│   │       ├── websocket.py   # WS manager + broadcast loop
│   │       └── routes/        # REST endpoints
│   ├── tests/                 # 235 pytest tests (83% coverage)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ErrorBoundary.tsx     # Global error recovery
│   │   │   ├── layout/Layout.tsx     # Sidebar + header + skip link
│   │   │   ├── dashboard/
│   │   │   │   ├── StadiumMap.tsx    # SVG venue heatmap
│   │   │   │   ├── CrowdChart.tsx    # Recharts timeline
│   │   │   │   ├── ZoneCard.tsx      # Density card + progressbar
│   │   │   │   └── GameClock.tsx     # Match timer
│   │   │   ├── chat/AIChat.tsx       # AI concierge chat
│   │   │   └── notifications/
│   │   │       └── NotificationCenter.tsx # Toast + bell
│   │   ├── pages/
│   │   │   ├── AttendeePage.tsx      # Chat + zones + exit
│   │   │   ├── AdminPage.tsx         # Ops dashboard
│   │   │   ├── AnalyticsPage.tsx     # Data analytics
│   │   │   ├── WristbandPage.tsx     # Hardware concept
│   │   │   └── NotFoundPage.tsx      # Accessible 404
│   │   ├── hooks/useWebSocket.ts
│   │   └── types/index.ts
│   └── package.json
├── Dockerfile              # Multi-stage, non-root user
├── cloudbuild.yaml         # Cloud Build + Artifact Registry
├── .env.example
└── README.md
```

---

## 🔒 Security

- **Admin passkey gate** — All admin endpoints require `X-Admin-Key` header with timing-safe comparison (OWASP A07)
- **Rate limiting** — Sliding window (10 req/min) on chat endpoint with `Retry-After` header
- **Security headers** — CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Permissions-Policy, X-Request-ID
- **CORS whitelist** — Explicit domain list via `CORS_ORIGINS` env var (no wildcard in production)
- **Input validation** — Pydantic models with Field constraints, regex validation on zone_id and user_id
- **Non-root container** — Docker runs as unprivileged `appuser` (OWASP A05)
- **Secret Manager** — Production secrets via Google Cloud Secret Manager (OWASP A02)

---

## ♿ Accessibility

VenuePulse targets **WCAG 2.2 Level AA** compliance:

- **Semantic landmarks** — `<aside>`, `<header>`, `<main>`, `<nav>` for all major regions
- **ARIA roles** — `role="tablist/tab/tabpanel"`, `role="progressbar"`, `role="alert"`, `role="status"`
- **Keyboard accessible** — All interactive elements reachable via Tab, tooltips visible on focus
- **Skip navigation** — "Skip to content" link for keyboard users
- **Screen reader support** — `aria-label`, `aria-describedby`, `aria-live="polite"` for status updates
- **Colorblind-safe** — Density indicators use icon + text + color (never color alone)
- **Error boundary** — Graceful error recovery with accessible fallback UI
- **404 page** — Accessible "Not Found" page with navigation link

---

## 📝 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_API_KEY` | — | Gemini API key (required for AI) |
| `ADMIN_PASSKEY` | — | Admin dashboard access (required, no default) |
| `CORS_ORIGINS` | `localhost:5173,localhost:3000` | Allowed CORS origins (comma-separated) |
| `ENVIRONMENT` | `development` | `development` or `production` |
| `SIMULATION_SPEED` | `1.0` | Initial sim speed multiplier |
| `TICK_INTERVAL_SECONDS` | `3.0` | WebSocket broadcast interval |
| `FIREBASE_CREDENTIALS_PATH` | — | Path to Firebase service account JSON |
| `GOOGLE_CLOUD_PROJECT` | — | GCP project ID for Cloud Run |

---

## 🏆 Hackathon Criteria Coverage

| Criteria | Implementation |
|----------|---------------|
| **Gemini Integration** | Function-calling agent with 5 tools, Gemini 2.0 Flash |
| **Cloud Run Ready** | Single container, Dockerfile, health check, Cloud Build + Artifact Registry |
| **Real-time Data** | WebSocket + 3s tick simulation |
| **Code Quality** | Type hints, Pydantic V2, parameterized logging, Error Boundary, 404 page |
| **Security** | Rate limiting, CORS, CSP, HSTS, passkey (timing-safe), non-root container |
| **Testing** | 235 tests, 83% coverage, OWASP edge-case tests |
| **Accessibility** | WCAG 2.2 AA, semantic landmarks, ARIA roles, keyboard nav, skip link |
| **Innovation** | Predictive surge + gamified redistribution |

---

## 👥 Team

Built for PromptWars 2026 with ❤️ and far too much caffeine.

---

*VenuePulse — Because 60,000 fans deserve intelligence, not chaos.*
