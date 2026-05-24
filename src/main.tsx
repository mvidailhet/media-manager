import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import App from "./App";
import { AppProviders } from "./AppProviders";
import { PlaybackWindow } from "./modules/playback";
import "./styles.css";

const appRoot = document.getElementById("root");

if (!appRoot) {
  throw new Error("Missing root element");
}

const isPlaybackWindow = new URLSearchParams(window.location.search).get(
  "window",
) === "playback";

createRoot(appRoot).render(
  <StrictMode>
    <AppProviders>
      {isPlaybackWindow ? <PlaybackWindow /> : <App />}
    </AppProviders>
  </StrictMode>
);
