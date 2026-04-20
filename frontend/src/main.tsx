import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/layout/Layout";
import { AttendeePage } from "./pages/AttendeePage";
import { AdminPage } from "./pages/AdminPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { WristbandPage } from "./pages/WristbandPage";
import { NotFoundPage } from "./pages/NotFoundPage";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<AttendeePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/wristband" element={<WristbandPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
