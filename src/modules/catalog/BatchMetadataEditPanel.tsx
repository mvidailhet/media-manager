import { Button, Group, Paper, Stack } from "@mantine/core";

import type { CatalogPerformer, CatalogTag } from "../../tauriCommands";
import { SectionHeader } from "../../shared/components/SectionHeader";
import { BatchMetadataActions } from "./BatchMetadataEditPanel/components/BatchMetadataActions";

export function BatchMetadataEditPanel({
  availablePerformers,
  availableTags,
  onAppendPerformer,
  onAppendTag,
  onCreateOrAppendPerformer,
  onCreateOrAppendTag,
  onRemovePerformer,
  onRemoveTag,
  onSetFavorite,
  removablePerformers,
  removableTags,
  selectedVideoCount,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  onAppendPerformer: (performer: CatalogPerformer) => void;
  onAppendTag: (tag: CatalogTag) => void;
  onCreateOrAppendPerformer: (name: string) => void;
  onCreateOrAppendTag: (name: string) => void;
  onRemovePerformer: (performer: CatalogPerformer) => void;
  onRemoveTag: (tag: CatalogTag) => void;
  onSetFavorite: (isFavorite: boolean) => void;
  removablePerformers: CatalogPerformer[];
  removableTags: CatalogTag[];
  selectedVideoCount: number;
}) {
  return (
    <Paper
      component="section"
      aria-label="Batch Metadata Edit"
      p="md"
      maw={760}
    >
      <Stack gap="md">
        <SectionHeader
          label={`${selectedVideoCount} selected`}
          title="Batch Metadata Edit"
        />
        <Group gap="xs">
          <Button
            type="button"
            variant="default"
            onClick={() => void onSetFavorite(true)}
          >
            Mark selected Videos as Favorite
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => void onSetFavorite(false)}
          >
            Unmark selected Videos as Favorite
          </Button>
        </Group>
        <Group gap="xl" align="start">
          <BatchMetadataActions
            availableItems={availableTags}
            label="Tags"
            onAppend={onAppendTag}
            onCreateOrAppend={onCreateOrAppendTag}
            onRemove={onRemoveTag}
            removableItems={removableTags}
          />
          <BatchMetadataActions
            availableItems={availablePerformers}
            label="Performers"
            onAppend={onAppendPerformer}
            onCreateOrAppend={onCreateOrAppendPerformer}
            onRemove={onRemovePerformer}
            removableItems={removablePerformers}
          />
        </Group>
      </Stack>
    </Paper>
  );
}
