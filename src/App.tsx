import { useEffect, useState } from "react";

import { getLocalDesktopAppStatus } from "./tauriCommands";

const loadingStatusMessage = "Checking Rust command...";
const commandErrorMessage = "Rust command unavailable";

export default function App() {
  const [localDesktopAppStatus, setLocalDesktopAppStatus] =
    useState(loadingStatusMessage);

  useEffect(() => {
    let canUpdateStatus = true;

    async function loadLocalDesktopAppStatus() {
      try {
        const status = await getLocalDesktopAppStatus();

        if (canUpdateStatus) {
          setLocalDesktopAppStatus(status);
        }
      } catch {
        if (canUpdateStatus) {
          setLocalDesktopAppStatus(commandErrorMessage);
        }
      }
    }

    void loadLocalDesktopAppStatus();

    return () => {
      canUpdateStatus = false;
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="workspace-header" aria-labelledby="videos-view-title">
        <p className="workspace-label">Local Desktop App</p>
        <h1 id="videos-view-title">Videos View</h1>
        <p className="workspace-summary">
          A local catalog workspace for organizing videos without a network
          dependency.
        </p>
      </section>

      <section className="status-panel" aria-label="Tauri command status">
        <span className="status-label">Tauri bridge</span>
        <strong>{localDesktopAppStatus}</strong>
      </section>
    </main>
  );
}
