# VenuePulse — Build Progress

## TIER 1 — Skeleton That Runs ✅

- [x] **1.1** Project scaffold — monorepo, requirements.txt, package.json, .env.example, .gitignore
- [x] **1.2** FastAPI app with /health + CORS + security headers middleware
- [x] **1.3** Venue layout — 22 zones with id, type, capacity, coordinates, adjacent_zones
- [x] **1.4** Crowd simulator — transition matrices, adjacency enforcement, density clamping, noise
- [x] **1.5** Game clock — speed multiplier, phase transitions, pause/resume, jump-to-minute
- [x] **1.6** Gemini agent — 5 tools, fallback responses, conversation history cap
- [x] **1.7** WebSocket endpoint — CrowdSnapshot broadcast every 3s with server_timestamp
- [x] **1.8** Rate limiter — 10 req/min per session on /api/agent/chat
- [x] **1.9** Dockerfile — multi-stage, layered caching (deploy pending GCP setup)
- [x] **1.10** Vite + React + TypeScript scaffold — 3 pages (/, /admin, /wristband)

### Tier 1 Verified:
- Backend starts, all 22 zones initialized, simulator ticks correctly
- WebSocket broadcasts CrowdSnapshot every 3s
- AI concierge uses fallback responses (Gemini key not yet configured)
- Frontend renders all 3 pages with live data from backend
- Admin passkey gate works
- Dark theme with glassmorphism aesthetic applied

## TIER 2 — Core Demo Features (Next)

- [ ] **2.1** AI Chat — message bubbles, typing indicator, smart scroll, quick chips
- [ ] **2.2** Zone Indicator — colors + icons + text labels (accessibility)
- [ ] **2.3** useWebSocket hook — auto-detect protocol, exponential backoff, stale detection
- [ ] **2.4** Attendee page assembly — chat + zone + prediction + rewards
- [ ] **2.5** Admin passkey gate (backend validation)
- [ ] **2.6** Admin heatmap — deck.gl HeatmapLayer on Google Maps
- [ ] **2.7** Admin speed slider + jump-to-phase buttons
- [ ] **2.8** Rewards engine — trigger → simulator response → heatmap redistribution
- [ ] **2.9** Admin prediction alerts panel
- [ ] **2.10** ?demo=true mode
- [ ] **2.11** REST API validation
- [ ] **2.12** Firebase FCM setup

## TIER 3 — Demo Ready + Polish

- [ ] **3.1** Wristband concept page
- [ ] **3.2** Exit Planner component
- [ ] **3.3** Rewards Wallet component
- [ ] **3.4** Backend tests (pytest)
- [ ] **3.5** Frontend tests (Vitest)
- [ ] **3.6** Accessibility audit
- [ ] **3.7** SIGTERM handler
- [ ] **3.8** UI polish — dark theme, glassmorphism, micro-animations
- [ ] **3.9** README
- [ ] **3.10** cloudbuild.yaml
- [ ] **3.11** LinkedIn post draft
- [ ] **3.12** Final deploy + smoke test
