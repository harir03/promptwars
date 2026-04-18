# LinkedIn Post — VenuePulse Launch

---

🏟️ **Just shipped VenuePulse — AI-powered crowd intelligence for live venues.**

Built for the PromptWars hackathon in under 48 hours. Here's what it does:

**The Problem:**
Managing crowd flow in a 55,000-seat stadium is chaos. Fans get stuck in packed zones, miss the action waiting in food queues, and exits become dangerous bottlenecks after the final whistle.

**The Solution:**
VenuePulse uses AI to predict crowd surges before they happen and redistribute fans through gamified incentives.

🔮 **Predictive Engine** — Forecasts halftime food court rushes, post-match gate congestion, and lopsided-score early exits with 90%+ confidence
📊 **Live Heatmap** — 22-zone real-time density visualization with trend indicators and wait time estimates
🎮 **Gamified Redistribution** — "Move to Food Court East for 20% off + 150 points" — turns crowd management into an attendee benefit
⌚ **Wristband Simulator** — Haptic alerts, NFC check-in, and push notifications for a frictionless fan experience
🤖 **AI Concierge** — Gemini-powered assistant that knows queue lengths, finds the shortest restroom line, and plans your exit route
📈 **Analytics Dashboard** — Real-time KPIs, zone comparison, CSV export, and density trend analysis

**Tech Stack:**
• FastAPI + WebSocket (3s real-time broadcast)
• React + TypeScript + Tailwind + Recharts + Framer Motion
• Google Gemini (ADK) with 5 custom tools
• 145 backend tests (pytest) — 100% green
• PWA-installable, offline-capable
• Cloud Run deployment with multi-stage Docker

**What I learned:**
→ Crowd simulation via Markov transition matrices is surprisingly elegant
→ Gamification beats enforcement — people move when there's an incentive
→ WebSocket + exponential backoff reconnection is essential for real-time UX
→ Building a full-stack demo with real AI integration in 48h forces ruthless prioritization

This was solo work — architecture, design, frontend, backend, testing, deployment. Every pixel, every endpoint, every test.

🔗 [link to demo]
📦 [link to repo]

#PromptWars #Hackathon #AI #GeminiAPI #CloudRun #CrowdManagement #FullStack #WebDev #FastAPI #React

---

> **Alt versions for platforms:**
> - Twitter/X: Use the first 3 paragraphs + link
> - Instagram: Screenshot carousel of the dashboard + wristband pages
> - Dev.to: Expand the "What I learned" section into a full article
