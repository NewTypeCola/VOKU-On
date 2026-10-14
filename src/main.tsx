import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
import "./motion.css";
import { supabase } from "./community/client";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
// Telemetry must never delay rendering or authentication.
void import("./analytics/runtime").then(({ startUsage }) => startUsage(supabase)).catch(() => {});
