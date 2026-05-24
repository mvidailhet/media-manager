import type { CatalogProps } from "../../Catalog";
import { useSelectedVideoDetailActions } from "../../useSelectedVideoDetailActions";
import { VideoDetailPanel } from "../../VideoDetailPanel";

export function SelectedVideoDetail({
  availablePerformers,
  availableTags,
  detailStatusMessage,
  onAttachPerformer,
  onAttachTag,
  onCreateOrAttachPerformer,
  onCreateOrAttachTag,
  onDetachPerformer,
  onDetachTag,
  onMoveSelectedVideoFileLocationToTrash,
  onOpenVideo,
  onOpenVideoContainingFolder,
  onSaveTitle,
  onSetSelectedFavorite,
  selectedPerformers,
  selectedTags,
  selectedVideo,
}: CatalogProps) {
  const selectedVideoDetailActions = useSelectedVideoDetailActions({
    onAttachPerformer,
    onAttachTag,
    onCreateOrAttachPerformer,
    onCreateOrAttachTag,
    onDetachPerformer,
    onDetachTag,
    onMoveFileLocationToTrash: onMoveSelectedVideoFileLocationToTrash,
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
    <VideoDetailPanel
      actions={selectedVideoDetailActions}
      availablePerformers={availablePerformers}
      availableTags={availableTags}
      detailStatusMessage={detailStatusMessage}
      performers={selectedPerformers}
      tags={selectedTags}
      video={selectedVideo}
    />
  );
}
