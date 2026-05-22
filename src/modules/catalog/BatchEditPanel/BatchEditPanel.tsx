import { Paper, Stack } from "@mantine/core";

import type { CatalogPerformer, CatalogTag } from "../../../tauriCommands";
import { SectionHeader } from "../../../shared/components/SectionHeader";
import { FavoriteActions } from "./components/FavoriteActions";
import { BatchMetadataSection } from "./components/BatchMetadataSection";
import { BatchTrashActions } from "./components/BatchTrashActions";
import type { BatchTrashTarget } from "./batchTrashTypes";

export type BatchMetadataValue<TMetadata> = {
  metadata: TMetadata;
  selectedVideoCount: number;
};

export function BatchEditPanel({
  availablePerformers,
  availableTags,
  onAppendPerformer,
  onAppendTag,
  onCreateOrAppendPerformer,
  onCreateOrAppendTag,
  onRemovePerformer,
  onRemoveTag,
  onMoveToTrash,
  onSetFavorite,
  removablePerformers,
  removableTags,
  selectedVideosAllFavorite,
  selectedVideoCount,
  trashTargets,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  onAppendPerformer: (performer: CatalogPerformer) => void;
  onAppendTag: (tag: CatalogTag) => void;
  onCreateOrAppendPerformer: (name: string) => void;
  onCreateOrAppendTag: (name: string) => void;
  onRemovePerformer: (performer: CatalogPerformer) => void;
  onRemoveTag: (tag: CatalogTag) => void;
  onMoveToTrash: () => void;
  onSetFavorite: (isFavorite: boolean) => void;
  removablePerformers: BatchMetadataValue<CatalogPerformer>[];
  removableTags: BatchMetadataValue<CatalogTag>[];
  selectedVideosAllFavorite: boolean;
  selectedVideoCount: number;
  trashTargets: BatchTrashTarget[];
}) {
  return (
    <Paper
      component="section"
      aria-label="Batch Edit Panel"
      p="md"
      maw={760}
    >
      <Stack gap="md">
        <SectionHeader
          label={`${selectedVideoCount} selected`}
          title="Batch Edit"
        />
        <FavoriteActions
          onSetFavorite={onSetFavorite}
          selectedVideosAllFavorite={selectedVideosAllFavorite}
        />
        <BatchTrashActions
          onMoveToTrash={onMoveToTrash}
          selectedVideoCount={selectedVideoCount}
          trashTargets={trashTargets}
        />
        <BatchMetadataSection
          availableValues={availableTags}
          emptyLabel="No selected Videos have tags"
          metadataKind="tag"
          onAppend={onAppendTag}
          onCreateOrAppend={onCreateOrAppendTag}
          onRemove={onRemoveTag}
          selectedVideoCount={selectedVideoCount}
          selectedValues={removableTags}
          title="Tags"
        />
        <BatchMetadataSection
          availableValues={availablePerformers}
          emptyLabel="No selected Videos have performers"
          metadataKind="performer"
          onAppend={onAppendPerformer}
          onCreateOrAppend={onCreateOrAppendPerformer}
          onRemove={onRemovePerformer}
          selectedVideoCount={selectedVideoCount}
          selectedValues={removablePerformers}
          title="Performers"
        />
      </Stack>
    </Paper>
  );
}
