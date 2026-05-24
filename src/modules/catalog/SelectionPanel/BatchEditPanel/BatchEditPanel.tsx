import { Box, Stack } from "@mantine/core";

import type { CatalogPerformer, CatalogTag } from "../../../../tauriCommands";
import { SectionHeader } from "../../../../shared/components/SectionHeader";
import { FavoriteActions } from "./components/FavoriteActions";
import { BatchMetadataSection } from "./components/BatchMetadataSection";
import { BatchTrashActions } from "./components/BatchTrashActions";
import type { BatchMetadataValue } from "../batchMetadataTypes";
import type { BatchTrashTarget } from "../batchTrashTypes";

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
  onMoveToTrash: () => Promise<void>;
  onSetFavorite: (isFavorite: boolean) => void;
  removablePerformers: BatchMetadataValue<CatalogPerformer>[];
  removableTags: BatchMetadataValue<CatalogTag>[];
  selectedVideosAllFavorite: boolean;
  selectedVideoCount: number;
  trashTargets: BatchTrashTarget[];
}) {
  return (
    <Box
      component="section"
      aria-label="Batch Edit Panel"
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
    </Box>
  );
}
