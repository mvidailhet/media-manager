import { useEffect, useState } from "react";

import type { FfmpegToolsStatus } from "../../tauriCommands";
import {
  getFfmpegToolsStatus,
  getLocalDesktopAppStatus,
  saveFfmpegConfiguration,
} from "../../tauriCommands";

const loadingStatusMessage = "Checking Rust command...";
export const commandErrorMessage = "Rust command unavailable";
const ffmpegLoadingMessage = "Checking FFmpeg tools...";
export const ffmpegErrorMessage = "FFmpeg status unavailable";

function normalizeConfiguredPath(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function useSettingsStatus({
  refreshReviewQueue,
}: {
  refreshReviewQueue: () => Promise<void>;
}) {
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
        ffprobePath: normalizeConfiguredPath(ffprobePath),
      });

      setFfmpegToolsStatus(status);
      setFfmpegPath(status.configuration.ffmpegPath ?? "");
      setFfprobePath(status.configuration.ffprobePath ?? "");
      setFfmpegStatusMessage("");
      await refreshReviewQueue();
    } catch {
      setFfmpegStatusMessage(ffmpegErrorMessage);
    }
  }

  return {
    ffmpegPath,
    ffmpegStatusMessage,
    ffmpegToolsStatus,
    ffprobePath,
    localDesktopAppStatus,
    saveConfiguredFfmpegPaths,
    setFfmpegPath,
    setFfprobePath,
  };
}
