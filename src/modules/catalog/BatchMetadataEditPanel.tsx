import { useState } from "react";
import { Button, Group, Paper, Stack, Text, TextInput, Title } from "@mantine/core";

import type { CatalogPerformer, CatalogTag } from "../../tauriCommands";
import { SectionHeader } from "../../shared/components/SectionHeader";
import { findMetadataByName, findNearMetadataMatch, singularMetadataLabel } from "../../shared/metadata/metadataHelpers";

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

export function BatchMetadataActions<T extends { id: number; name: string }>({
  availableItems,
  label,
  onAppend,
  onCreateOrAppend,
  onRemove,
  removableItems,
}: {
  availableItems: T[];
  label: string;
  onAppend: (item: T) => void;
  onCreateOrAppend: (name: string) => void;
  onRemove: (item: T) => void;
  removableItems: T[];
}) {
  const [newItemName, setNewItemName] = useState("");
  const trimmedNewItemName = newItemName.trim();
  const exactAvailableMatch = findMetadataByName(
    availableItems,
    trimmedNewItemName,
  );
  const nearMatch = findNearMetadataMatch(availableItems, trimmedNewItemName);
  const actionLabel = exactAvailableMatch
    ? `Append existing ${singularMetadataLabel(label)} to selected Videos`
    : `Create and append ${singularMetadataLabel(label)} to selected Videos`;

  return (
    <Stack component="section" gap="xs" aria-label={`Batch ${label}`}>
      <Title order={3} size="h4">
        {label}
      </Title>
      <TextInput
        label={`New ${singularMetadataLabel(label)}`}
        value={newItemName}
        onChange={(event) => setNewItemName(event.currentTarget.value)}
      />
      {nearMatch ? <Text size="sm">Near match: {nearMatch.name}</Text> : null}
      <Button
        type="button"
        size="xs"
        variant="default"
        onClick={() => {
          void onCreateOrAppend(trimmedNewItemName);
          setNewItemName("");
        }}
      >
        {actionLabel}
      </Button>
      {availableItems.map((item) => (
        <Button
          key={item.id}
          type="button"
          size="xs"
          variant="default"
          onClick={() => void onAppend(item)}
        >
          Append {item.name} to selected Videos
        </Button>
      ))}
      {removableItems.map((item) => (
        <Group key={item.id} gap="xs">
          <Button
            type="button"
            size="xs"
            variant="light"
            onClick={() => void onRemove(item)}
          >
            Remove {item.name} from selected Videos
          </Button>
        </Group>
      ))}
    </Stack>
  );
}
