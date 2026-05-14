import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import App from "./App";
import { AppProviders } from "./AppProviders";
import "./styles.css";

const appRoot = document.getElementById("root");

if (!appRoot) {
  throw new Error("Missing root element");
}

createRoot(appRoot).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>
);
