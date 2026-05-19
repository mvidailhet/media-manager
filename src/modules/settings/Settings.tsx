import type { FfmpegToolsStatus } from "../../tauriCommands";
import { FfmpegStatusPanel } from "./SettingsStatusPanels/FfmpegStatusPanel";
import { TauriStatusPanel } from "./SettingsStatusPanels/TauriStatusPanel";

export type SettingsProps = {
  ffmpegPath: string;
  ffmpegStatusMessage: string;
  ffmpegToolsStatus: FfmpegToolsStatus | null;
  ffprobePath: string;
  localDesktopAppStatus: string;
  onFfmpegPathChange: (path: string) => void;
  onFfprobePathChange: (path: string) => void;
  onSaveConfiguredFfmpegPaths: (event: React.FormEvent) => void;
};

export function Settings({
  ffmpegPath,
  ffmpegStatusMessage,
  ffmpegToolsStatus,
  ffprobePath,
  localDesktopAppStatus,
  onFfmpegPathChange,
  onFfprobePathChange,
  onSaveConfiguredFfmpegPaths,
}: SettingsProps) {
  return (
    <>
      <TauriStatusPanel localDesktopAppStatus={localDesktopAppStatus} />
      <FfmpegStatusPanel
        ffmpegPath={ffmpegPath}
        ffmpegStatusMessage={ffmpegStatusMessage}
        ffmpegToolsStatus={ffmpegToolsStatus}
        ffprobePath={ffprobePath}
        onFfmpegPathChange={onFfmpegPathChange}
        onFfprobePathChange={onFfprobePathChange}
        onSaveConfiguredFfmpegPaths={onSaveConfiguredFfmpegPaths}
      />
    </>
  );
}
