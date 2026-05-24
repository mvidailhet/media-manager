import type { CatalogProps } from "../../Catalog";
import { BatchEditPanel } from "../../BatchEditPanel";

export function SelectedVideosBatchEdit({
  availablePerformers,
  availableTags,
  batchRemovablePerformers,
  batchRemovableTags,
  batchSelectedVideosAllFavorite,
  batchSelectedVideoCount,
  batchTrashTargets,
  onAppendPerformer,
  onAppendTag,
  onCreateOrAppendPerformer,
  onCreateOrAppendTag,
  onMoveBatchPreferredFileLocationsToTrash,
  onRemovePerformer,
  onRemoveTag,
  onSetBatchFavorite,
}: CatalogProps) {
  return (
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
}
