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
│   │   ├── config.py          # Environment config
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
│   │   │   ├── security.py    # Headers + tracing
│   │   │   └── rate_limiter.py # 10 req/min sliding window
│   │   └── api/
│   │       ├── websocket.py   # WS manager + broadcast loop
│   │       └── routes/        # REST endpoints
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/Layout.tsx    # Sidebar + header
│   │   │   ├── dashboard/
│   │   │   │   ├── StadiumMap.tsx   # SVG venue heatmap
│   │   │   │   ├── CrowdChart.tsx   # Recharts timeline
│   │   │   │   ├── ZoneCard.tsx     # Density card
│   │   │   │   └── GameClock.tsx    # Match timer
│   │   │   ├── chat/AIChat.tsx      # AI concierge chat
│   │   │   └── attendee/
│   │   │       ├── ExitPlanner.tsx  # Smart exit recs
│   │   │       └── RewardsWallet.tsx # Points + offers
│   │   ├── pages/
│   │   │   ├── AttendeePage.tsx     # Chat + zones + exit
│   │   │   ├── AdminPage.tsx        # Ops dashboard
│   │   │   └── WristbandPage.tsx    # Hardware concept
│   │   ├── hooks/useWebSocket.ts
│   │   └── types/index.ts
│   └── package.json
├── Dockerfile              # Multi-stage build
├── .env.example
└── README.md
```

---

## 🔒 Security

- **Admin passkey gate** — All admin endpoints require `X-Admin-Key` header
- **Rate limiting** — Sliding window (10 req/min) on chat endpoint
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options`, `X-Request-ID`
- **CORS whitelist** — Configurable via `CORS_ORIGINS` env var
- **Input validation** — Pydantic models with Field constraints

---

## ♿ Accessibility

- Colorblind-safe density indicators (icon + text label + color)
- ARIA labels on all interactive elements
- Semantic HTML structure
- Keyboard navigable
- Screen reader friendly zone status announcements

---

## 📝 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_API_KEY` | — | Gemini API key (required for AI) |
| `ADMIN_PASSKEY` | `venuepulse_admin_2026` | Admin dashboard access |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |
| `ENVIRONMENT` | `development` | `development` or `production` |
| `SIMULATION_SPEED` | `1.0` | Initial sim speed multiplier |
| `TICK_INTERVAL_SECONDS` | `3.0` | WebSocket broadcast interval |

---

## 🏆 Hackathon Criteria Coverage

| Criteria | Implementation |
|----------|---------------|
| **Gemini Integration** | Function-calling agent with 5 tools |
| **Cloud Run Ready** | Single container, Dockerfile, health check |
| **Real-time Data** | WebSocket + 3s tick simulation |
| **Code Quality** | Type hints, Pydantic models, structured logging |
| **Security** | Rate limiting, CORS, passkey, headers |
| **Accessibility** | Colorblind-safe, ARIA labels, semantic HTML |
| **Innovation** | Predictive surge + gamified redistribution |

---

## 👥 Team

Built for PromptWars 2026 with ❤️ and far too much caffeine.

---

*VenuePulse — Because 60,000 fans deserve intelligence, not chaos.*
