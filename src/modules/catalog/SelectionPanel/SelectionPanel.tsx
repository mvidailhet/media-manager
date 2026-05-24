import { Box } from "@mantine/core";
import type { ReactNode } from "react";

import type { CatalogProps } from "../Catalog";
import { createSelectedVideoDetailActions } from "../selectedVideoDetailActions";
import { BatchEditPanel } from "./BatchEditPanel";
import { EmptySelectionState } from "./components/EmptySelectionState";
import { VideoDetailPanel } from "./VideoDetailPanel";
import styles from "./SelectionPanel.module.css";

export function SelectionPanel({
  availablePerformers,
  availableTags,
  batchRemovablePerformers,
  batchRemovableTags,
  batchSelectedVideosAllFavorite,
  batchSelectedVideoCount,
  batchTrashTargets,
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
  onMoveBatchPreferredFileLocationsToTrash,
  onMoveSelectedVideoFileLocationToTrash,
  onOpenVideo,
  onOpenVideoContainingFolder,
  onPlayVideoInApp,
  onRemovePerformer,
  onRemoveTag,
  onSaveTitle,
  onSetBatchFavorite,
  onSetSelectedFavorite,
  selectedPerformers,
  selectedTags,
  selectedVideo,
}: CatalogProps) {
  const shouldShowBatchEdit = batchSelectedVideoCount >= 2;
  let selectionPanelContent: ReactNode;

  if (shouldShowBatchEdit) {
    selectionPanelContent = (
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
    );
  } else if (selectedVideo) {
    const selectedVideoDetailActions = createSelectedVideoDetailActions({
      onAttachPerformer,
      onAttachTag,
      onCreateOrAttachPerformer,
      onCreateOrAttachTag,
      onDetachPerformer,
      onDetachTag,
      onMoveFileLocationToTrash: onMoveSelectedVideoFileLocationToTrash,
      onOpenVideo,
      onOpenVideoContainingFolder,
      onPlayVideoInApp,
      onSaveTitle,
      onSetSelectedFavorite,
      selectedVideo,
    });

    selectionPanelContent = (
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
  } else {
    selectionPanelContent = <EmptySelectionState />;
  }

  return (
    <Box
      aria-label="Selection Panel"
      className={styles.selectionPanel}
      component="aside"
    >
      {selectionPanelContent}
    </Box>
  );
}
