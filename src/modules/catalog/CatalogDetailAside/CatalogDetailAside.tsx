import { AppShell } from "@mantine/core";

import type { CatalogProps } from "../Catalog";
import { BatchEditPanel } from "../BatchEditPanel";
import { useSelectedVideoDetailActions } from "../useSelectedVideoDetailActions";
import { VideoDetailPanel } from "../VideoDetailPanel";
import { AsideWidthToggle } from "./components/AsideWidthToggle";
import styles from "./CatalogDetailAside.module.css";

export function CatalogDetailAside({
  availablePerformers,
  availableTags,
  batchRemovablePerformers,
  batchRemovableTags,
  batchSelectedVideosAllFavorite,
  batchSelectedVideoCount,
  detailStatusMessage,
  onAppendPerformer,
  onAppendTag,
  onAttachPerformer,
  onAttachTag,
  onCreateOrAppendPerformer,
  onCreateOrAppendTag,
  onCreateOrAttachPerformer,
  onCreateOrAttachTag,
  onDetachPerformer,
  onDetachTag,
  onMoveSelectedVideoFileLocationToTrash,
  onMoveBatchPreferredFileLocationsToTrash,
  onOpenVideo,
  onOpenVideoContainingFolder,
  onRemovePerformer,
  onRemoveTag,
  onSaveTitle,
  onSetBatchFavorite,
  onSetSelectedFavorite,
  isExpanded,
  onExpandedChange,
  selectedPerformers,
  selectedTags,
  selectedVideo,
  batchTrashTargets,
}: CatalogProps & {
  isExpanded: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
}) {
  const shouldShowBatchEdit = batchSelectedVideoCount >= 2;
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

  if (!selectedVideo && !shouldShowBatchEdit) {
    return null;
  }

  return (
    <AppShell.Aside className={styles.aside} p="md">
      <AsideWidthToggle
        isExpanded={isExpanded}
        onToggle={() => onExpandedChange(!isExpanded)}
      />
      {shouldShowBatchEdit ? (
        <BatchEditPanel
          availablePerformers={availablePerformers}
          availableTags={availableTags}
          onAppendPerformer={onAppendPerformer}
          onAppendTag={onAppendTag}
          onCreateOrAppendPerformer={onCreateOrAppendPerformer}
          onCreateOrAppendTag={onCreateOrAppendTag}
          onRemovePerformer={onRemovePerformer}
          onRemoveTag={onRemoveTag}
          onMoveToTrash={onMoveBatchPreferredFileLocationsToTrash}
          onSetFavorite={onSetBatchFavorite}
          removablePerformers={batchRemovablePerformers}
          removableTags={batchRemovableTags}
          selectedVideosAllFavorite={batchSelectedVideosAllFavorite}
          selectedVideoCount={batchSelectedVideoCount}
          trashTargets={batchTrashTargets}
        />
      ) : selectedVideo ? (
        <VideoDetailPanel
          actions={selectedVideoDetailActions}
          availablePerformers={availablePerformers}
          availableTags={availableTags}
          detailStatusMessage={detailStatusMessage}
          performers={selectedPerformers}
          tags={selectedTags}
          video={selectedVideo}
        />
      ) : null}
    </AppShell.Aside>
  );
}
