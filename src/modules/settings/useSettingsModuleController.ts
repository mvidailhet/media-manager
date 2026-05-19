import type { SettingsProps } from "./Settings";
import {
  commandErrorMessage,
  ffmpegErrorMessage,
  useSettingsStatus,
} from "./useSettingsStatus";

type SettingsController = {
  settingsAttentionCount: number;
  settingsProps: SettingsProps;
};

export function useSettingsModuleController({
  refreshScanIssues,
}: {
  refreshScanIssues: () => Promise<void>;
}): SettingsController {
  const settingsStatus = useSettingsStatus({
    refreshScanIssues,
  });
  const {
    ffmpegPath,
    ffmpegStatusMessage,
    ffmpegToolsStatus,
    ffprobePath,
    localDesktopAppStatus,
    saveConfiguredFfmpegPaths,
    setFfmpegPath,
    setFfprobePath,
  } = settingsStatus;

  const ffmpegToolAttentionCount = ffmpegToolsStatus
    ? [ffmpegToolsStatus.ffmpeg, ffmpegToolsStatus.ffprobe].filter(
        (toolStatus) => !toolStatus.isAvailable,
      ).length
    : ffmpegStatusMessage === ffmpegErrorMessage
      ? 1
      : 0;
  const settingsAttentionCount =
    (localDesktopAppStatus === commandErrorMessage ? 1 : 0) +
    ffmpegToolAttentionCount;

  return {
    settingsAttentionCount,
    settingsProps: {
      ffmpegPath,
      ffmpegStatusMessage,
      ffmpegToolsStatus,
      ffprobePath,
      localDesktopAppStatus,
      onFfmpegPathChange: setFfmpegPath,
      onFfprobePathChange: setFfprobePath,
      onSaveConfiguredFfmpegPaths: saveConfiguredFfmpegPaths,
    },
  };
}
