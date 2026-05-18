import { AppShell } from "@mantine/core";

import type { CatalogModuleProps } from "./CatalogModule";
import { useSelectedVideoDetailActions } from "./useSelectedVideoDetailActions";
import { VideoDetailPanel } from "./VideoDetailPanel/VideoDetailPanel";

export function CatalogModuleDetailAside({
  availablePerformers,
  availableTags,
  detailStatusMessage,
  onAttachPerformer,
  onAttachTag,
  onCreateOrAttachPerformer,
  onCreateOrAttachTag,
  onDetachPerformer,
  onDetachTag,
  onOpenVideo,
  onOpenVideoContainingFolder,
  onSaveTitle,
  onSetSelectedFavorite,
  selectedPerformers,
  selectedTags,
  selectedVideo,
}: CatalogModuleProps) {
  const selectedVideoDetailActions = useSelectedVideoDetailActions({
    onAttachPerformer,
    onAttachTag,
    onCreateOrAttachPerformer,
    onCreateOrAttachTag,
    onDetachPerformer,
    onDetachTag,
    onOpenVideo,
    onOpenVideoContainingFolder,
    onSaveTitle,
    onSetSelectedFavorite,
    selectedVideo,
  });

  if (!selectedVideo) {
    return null;
  }

  return (
    <AppShell.Aside p="md">
      <VideoDetailPanel
        actions={selectedVideoDetailActions}
        availablePerformers={availablePerformers}
        availableTags={availableTags}
        detailStatusMessage={detailStatusMessage}
        performers={selectedPerformers}
        tags={selectedTags}
        video={selectedVideo}
      />
    </AppShell.Aside>
  );
}
