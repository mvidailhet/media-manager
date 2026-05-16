import type { SettingsModuleProps } from "./SettingsModule";
import {
  commandErrorMessage,
  ffmpegErrorMessage,
  useSettingsStatus,
} from "./useSettingsStatus";

type SettingsModuleController = {
  settingsAttentionCount: number;
  settingsModuleProps: SettingsModuleProps;
};

export function useSettingsModuleController({
  refreshScanIssues,
}: {
  refreshScanIssues: () => Promise<void>;
}): SettingsModuleController {
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
    settingsModuleProps: {
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
