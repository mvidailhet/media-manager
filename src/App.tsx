import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

import {
  CatalogVideo,
  FfmpegToolsStatus,
  ScanRoot,
  ScanRootRemovalPolicy,
  addScanRoot,
  getFfmpegToolsStatus,
  getLocalDesktopAppStatus,
  listCatalogVideos,
  listScanRoots,
  removeScanRoot,
  refreshScanRoot,
  saveFfmpegConfiguration
} from "./tauriCommands";

const loadingStatusMessage = "Checking Rust command...";
const commandErrorMessage = "Rust command unavailable";
const ffmpegLoadingMessage = "Checking FFmpeg tools...";
const ffmpegErrorMessage = "FFmpeg status unavailable";
const catalogVideosLoadingMessage = "Loading Videos...";
const catalogVideosEmptyMessage = "No Videos in the Catalog.";
const catalogVideosErrorMessage = "Videos unavailable";
const scanRootsLoadingMessage = "Loading Scan Roots...";
const scanRootsErrorMessage = "Scan Roots unavailable";
const scanRootRefreshStartedMessage = "Refreshing Scan Root...";
const millisecondsPerSecond = 1000;
const secondsPerMinute = 60;
const minutesPerHour = 60;
const bytesPerMegabyte = 1_000_000;

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
  const [catalogVideos, setCatalogVideos] = useState<CatalogVideo[]>([]);
  const [catalogVideosStatusMessage, setCatalogVideosStatusMessage] = useState(
    catalogVideosLoadingMessage
  );
  const [scanRoots, setScanRoots] = useState<ScanRoot[]>([]);
  const [scanRootsStatusMessage, setScanRootsStatusMessage] = useState(
    scanRootsLoadingMessage
  );
  const [manualScanRootPath, setManualScanRootPath] = useState("");
  const [scanRootPendingRemoval, setScanRootPendingRemoval] =
    useState<ScanRoot | null>(null);
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
    let canUpdateCatalogVideos = true;

    async function loadCatalogVideos() {
      try {
        const storedCatalogVideos = await listCatalogVideos();

        if (canUpdateCatalogVideos) {
          setCatalogVideos(storedCatalogVideos);
          setCatalogVideosStatusMessage("");
        }
      } catch {
        if (canUpdateCatalogVideos) {
          setCatalogVideosStatusMessage(catalogVideosErrorMessage);
        }
      }
    }

    void loadCatalogVideos();

    return () => {
      canUpdateCatalogVideos = false;
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

  useEffect(() => {
    let canUpdateScanRoots = true;

    async function loadScanRoots() {
      try {
        const storedScanRoots = await listScanRoots();

        if (canUpdateScanRoots) {
          setScanRoots(storedScanRoots);
          setScanRootsStatusMessage("");
        }
      } catch {
        if (canUpdateScanRoots) {
          setScanRootsStatusMessage(scanRootsErrorMessage);
        }
      }
    }

    void loadScanRoots();

    return () => {
      canUpdateScanRoots = false;
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

  async function chooseScanRootFolder() {
    const selectedFolder = await open({
      directory: true,
      multiple: false
    });

    if (typeof selectedFolder === "string") {
      await persistScanRoot(selectedFolder);
    }
  }

  async function addManualScanRoot(event: React.FormEvent) {
    event.preventDefault();
    await persistScanRoot(manualScanRootPath);
  }

  async function persistScanRoot(path: string) {
    const scanRootPath = path.trim();

    if (!scanRootPath) {
      return;
    }

    try {
      const scanRoot = await addScanRoot(scanRootPath);
      setScanRoots((currentScanRoots) =>
        [...currentScanRoots, scanRoot].sort((left, right) =>
          left.path.localeCompare(right.path)
        )
      );
      setManualScanRootPath("");
      setScanRootsStatusMessage("");
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  async function confirmScanRootRemoval(removalPolicy: ScanRootRemovalPolicy) {
    if (!scanRootPendingRemoval) {
      return;
    }

    const removedScanRoot = scanRootPendingRemoval;

    try {
      await removeScanRoot(removedScanRoot.path, removalPolicy);
      setScanRoots((currentScanRoots) =>
        currentScanRoots.filter(
          (scanRoot) => scanRoot.path !== removedScanRoot.path
        )
      );
      setScanRootPendingRemoval(null);
      setScanRootsStatusMessage("");
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  async function refreshSelectedScanRoot(scanRoot: ScanRoot) {
    try {
      setScanRootsStatusMessage(scanRootRefreshStartedMessage);
      const refreshSummary = await refreshScanRoot(scanRoot.path);

      setScanRootsStatusMessage(
        `${refreshSummary.scannedVideoCount} Videos scanned, ${refreshSummary.unprocessableCandidateCount} Unprocessable Video Candidates`
      );
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
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

      <section className="catalog-videos-panel" aria-label="Catalog Videos">
        <div className="panel-heading">
          <div>
            <span className="status-label">Catalog results</span>
            <h2>Videos</h2>
          </div>
        </div>

        {catalogVideosStatusMessage ? (
          <p>{catalogVideosStatusMessage}</p>
        ) : null}

        {!catalogVideosStatusMessage && catalogVideos.length === 0 ? (
          <p>{catalogVideosEmptyMessage}</p>
        ) : null}

        {catalogVideos.length > 0 ? (
          <div className="catalog-video-list">
            {catalogVideos.map((catalogVideo) => (
              <article
                className="catalog-video"
                key={`${catalogVideo.title}-${catalogVideo.fileLocationPath ?? "missing"}`}
              >
                <div>
                  <h3>{catalogVideo.title}</h3>
                  <p>{formatDuration(catalogVideo.durationMilliseconds)}</p>
                </div>
                <dl className="catalog-video-details">
                  <div>
                    <dt>File Location</dt>
                    <dd>
                      {catalogVideo.fileLocationPath ? (
                        <code>{catalogVideo.fileLocationPath}</code>
                      ) : (
                        "Missing"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>File Size</dt>
                    <dd>{formatFileSize(catalogVideo.fileSizeBytes)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="scan-roots-panel" aria-label="Scan Roots">
        <div className="panel-heading">
          <div>
            <span className="status-label">Catalog sources</span>
            <h2>Scan Roots</h2>
          </div>
          <button type="button" onClick={chooseScanRootFolder}>
            Choose folder
          </button>
        </div>

        {scanRootsStatusMessage ? <p>{scanRootsStatusMessage}</p> : null}

        <form className="scan-root-form" onSubmit={addManualScanRoot}>
          <label>
            <span>Manual path</span>
            <input
              type="text"
              value={manualScanRootPath}
              onChange={(event) => setManualScanRootPath(event.target.value)}
              placeholder="/Volumes/Archive/Videos"
            />
          </label>
          <button type="submit">Add path</button>
        </form>

        {scanRoots.length > 0 ? (
          <div className="scan-root-list">
            {scanRoots.map((scanRoot) => (
              <article className="scan-root" key={scanRoot.path}>
                <code>{scanRoot.path}</code>
                <div className="scan-root-actions">
                  <button
                    type="button"
                    onClick={() => void refreshSelectedScanRoot(scanRoot)}
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanRootPendingRemoval(scanRoot)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>No Scan Roots added.</p>
        )}
      </section>

      {scanRootPendingRemoval ? (
        <section
          className="removal-panel"
          aria-label="Remove Scan Root confirmation"
        >
          <h2>Remove Scan Root</h2>
          <code>{scanRootPendingRemoval.path}</code>
          <div className="removal-actions">
            <button
              type="button"
              onClick={() =>
                void confirmScanRootRemoval("preserveMissingVideos")
              }
            >
              Preserve as Missing Videos
            </button>
            <button
              type="button"
              onClick={() => void confirmScanRootRemoval("forgetFromCatalog")}
            >
              Forget From Catalog
            </button>
            <button type="button" onClick={() => setScanRootPendingRemoval(null)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

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

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function formatDuration(durationMilliseconds: number) {
  const totalSeconds = Math.round(durationMilliseconds / millisecondsPerSecond);
  const totalMinutes = Math.floor(totalSeconds / secondsPerMinute);
  const hours = Math.floor(totalMinutes / minutesPerHour);
  const minutes = totalMinutes % minutesPerHour;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function formatFileSize(fileSizeBytes: number | null) {
  if (fileSizeBytes === null) {
    return "Unknown";
  }

  const megabytes = fileSizeBytes / bytesPerMegabyte;

  return `${megabytes.toFixed(1)} MB`;
}
