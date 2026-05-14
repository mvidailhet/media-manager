import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./styles.css";

const appRoot = document.getElementById("root");

if (!appRoot) {
  throw new Error("Missing root element");
}

createRoot(appRoot).render(
  <StrictMode>
    <App />
  </StrictMode>
);
