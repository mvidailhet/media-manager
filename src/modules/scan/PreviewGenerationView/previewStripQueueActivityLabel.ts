import type { PreviewStripQueueStatus } from "../../../tauriCommands";

export function previewStripQueueActivityLabel(
  previewStripQueueStatus: PreviewStripQueueStatus,
) {
  if (previewStripQueueStatus.isPaused) {
    return "Paused";
  }

  if (
    previewStripQueueStatus.runningCount === 0 &&
    previewStripQueueStatus.pendingCount === 0
  ) {
    return "Idle";
  }

  return "Running";
}
