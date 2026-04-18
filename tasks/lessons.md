# VenuePulse Lessons Learned

## 🧪 Testing
- **Simulation Floating Point Issues**: When testing crowd counts, rely on ranges (e.g., `54500 <= c <= 55500`) rather than exact integers due to floor/truncation in Markov transition calculations over many ticks.
- **Async API Testing**: Use `httpx.AsyncClient(transport=ASGITransport(app=app))` for testing FastAPI + WebSocket applications to avoid thread-safety issues with event loops.
- **WebSocket Mocking**: Always send an initial snapshot on connection to prevent UI flickering or "ghost" states during reconnection.

## 🏗️ Architecture
- **Single-Container Monolith**: For hackathons, a multi-stage Docker build that serves both frontend (dist) and backend (FastAPI) from a single port simplifies Google Cloud Run configuration significantly.
- **State Persistence**: Using a singleton pattern for the `CrowdSimulator` allows the WebSocket broadcast loop and API endpoints to access the exact same state without complex DB locking.

## 🎨 Frontend & UX
- **Chart Performance**: When rendering real-time area charts (Recharts), slice the history array (e.g., `.slice(-20)`) to maintain 60FPS even after hours of continuous simulation.
- **Accessibility**: Skip-links are essential for dashboard-heavy apps to allow screen reader users to bypass the sidebar navigation quickly.
- **PWA**: A simple `sw.js` with a network-first strategy is a high-ROI feature for hackathons—it makes the mobile experience feel like a native app with zero extra effort.

## 🛠️ Google Gemini Integration
- **Function Calling Latency**: Gemini 1.5 is fast, but function calls add 500-800ms. Keep tool responses compact to minimize total token round-trip time.
- **Fallback Logic**: Always have a hardcoded fallback response for AI agents if the API key is missing or rate-limited; this prevents a total failure of the conversational UI.
