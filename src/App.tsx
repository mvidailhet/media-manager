import { useEffect, useState } from "react";

import {
  FfmpegToolsStatus,
  getFfmpegToolsStatus,
  getLocalDesktopAppStatus,
  saveFfmpegConfiguration
} from "./tauriCommands";

const loadingStatusMessage = "Checking Rust command...";
const commandErrorMessage = "Rust command unavailable";
const ffmpegLoadingMessage = "Checking FFmpeg tools...";
const ffmpegErrorMessage = "FFmpeg status unavailable";

function normalizeConfiguredPath(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

export default function App() {
  const [localDesktopAppStatus, setLocalDesktopAppStatus] =
    useState(loadingStatusMessage);
  const [ffmpegToolsStatus, setFfmpegToolsStatus] =
    useState<FfmpegToolsStatus | null>(null);
  const [ffmpegStatusMessage, setFfmpegStatusMessage] =
    useState(ffmpegLoadingMessage);
  const [ffmpegPath, setFfmpegPath] = useState("");
  const [ffprobePath, setFfprobePath] = useState("");

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

  useEffect(() => {
    let canUpdateStatus = true;

    async function loadFfmpegToolsStatus() {
      try {
        const status = await getFfmpegToolsStatus();

        if (canUpdateStatus) {
          setFfmpegToolsStatus(status);
          setFfmpegPath(status.configuration.ffmpegPath ?? "");
          setFfprobePath(status.configuration.ffprobePath ?? "");
          setFfmpegStatusMessage("");
        }
      } catch {
        if (canUpdateStatus) {
          setFfmpegStatusMessage(ffmpegErrorMessage);
        }
      }
    }

    void loadFfmpegToolsStatus();

    return () => {
      canUpdateStatus = false;
    };
  }, []);

  async function saveConfiguredFfmpegPaths(event: React.FormEvent) {
    event.preventDefault();

    try {
      const status = await saveFfmpegConfiguration({
        ffmpegPath: normalizeConfiguredPath(ffmpegPath),
        ffprobePath: normalizeConfiguredPath(ffprobePath)
      });

      setFfmpegToolsStatus(status);
      setFfmpegPath(status.configuration.ffmpegPath ?? "");
      setFfprobePath(status.configuration.ffprobePath ?? "");
      setFfmpegStatusMessage("");
    } catch {
      setFfmpegStatusMessage(ffmpegErrorMessage);
    }
  }

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

      <section className="ffmpeg-panel" aria-label="FFmpeg tools status">
        <div>
          <span className="status-label">Video tooling</span>
          <h2>FFmpeg status</h2>
        </div>

        {ffmpegStatusMessage ? <p>{ffmpegStatusMessage}</p> : null}

        {ffmpegToolsStatus ? (
          <div className="tool-status-list">
            {[ffmpegToolsStatus.ffmpeg, ffmpegToolsStatus.ffprobe].map(
              (toolStatus) => (
                <article className="tool-status" key={toolStatus.binaryName}>
                  <div>
                    <h3>{toolStatus.binaryName}</h3>
                    <p>{toolStatus.statusMessage}</p>
                    {toolStatus.resolvedPath ? (
                      <code>{toolStatus.resolvedPath}</code>
                    ) : null}
                  </div>
                  <strong
                    className={
                      toolStatus.isAvailable
                        ? "availability available"
                        : "availability missing"
                    }
                  >
                    {toolStatus.isAvailable ? "Available" : "Missing"}
                  </strong>
                </article>
              )
            )}
          </div>
        ) : null}

        <form className="ffmpeg-form" onSubmit={saveConfiguredFfmpegPaths}>
          <label>
            <span>FFmpeg path</span>
            <input
              type="text"
              value={ffmpegPath}
              onChange={(event) => setFfmpegPath(event.target.value)}
              placeholder="Use PATH discovery"
            />
          </label>
          <label>
            <span>ffprobe path</span>
            <input
              type="text"
              value={ffprobePath}
              onChange={(event) => setFfprobePath(event.target.value)}
              placeholder="Use PATH discovery"
            />
          </label>
          <button type="submit">Save paths</button>
        </form>
      </section>
    </main>
  );
}
