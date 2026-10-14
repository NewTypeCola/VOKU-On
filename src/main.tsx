import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Study } from "./ux/Study";
import "./style.css";
import "./motion.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Study><App /></Study>
  </React.StrictMode>,
);
