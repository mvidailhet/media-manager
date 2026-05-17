import { useEffect, useState } from "react";
import { Badge, Box, Button, Checkbox, Code, Group, Stack, Text, TextInput, Title } from "@mantine/core";

import type { CatalogPerformer, CatalogTag, CatalogVideo } from "../../tauriCommands";
import { AvailabilityBadge } from "../../shared/components/AvailabilityBadge";
import { DefinitionTerm } from "../../shared/components/DefinitionTerm";
import { SectionHeader } from "../../shared/components/SectionHeader";
import { formatDuration, formatFileSize } from "../../shared/formatting/videoFormatting";
import { findMetadataByName, findNearMetadataMatch, singularMetadataLabel } from "../../shared/metadata/metadataHelpers";

export function VideoDetailPanel({
  availablePerformers,
  availableTags,
  detailStatusMessage,
  onAttachPerformer,
  onAttachTag,
  onCreateOrAttachPerformer,
  onCreateOrAttachTag,
  onDetachPerformer,
  onDetachTag,
  onSaveTitle,
  onSetFavorite,
  selectedPerformers,
  selectedTags,
  video,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  detailStatusMessage: string;
  onAttachPerformer: (performer: CatalogPerformer) => void;
  onAttachTag: (tag: CatalogTag) => void;
  onCreateOrAttachPerformer: (name: string) => void;
  onCreateOrAttachTag: (name: string) => void;
  onDetachPerformer: (performer: CatalogPerformer) => void;
  onDetachTag: (tag: CatalogTag) => void;
  onSaveTitle: (title: string) => void;
  onSetFavorite: (isFavorite: boolean) => void;
  selectedPerformers: CatalogPerformer[];
  selectedTags: CatalogTag[];
  video: CatalogVideo;
}) {
  const [title, setTitle] = useState(video.title);
  const selectedTagIds = new Set(selectedTags.map((tag) => tag.id));
  const selectedPerformerIds = new Set(
    selectedPerformers.map((performer) => performer.id),
  );
  const attachableTags = availableTags.filter(
    (tag) => !selectedTagIds.has(tag.id),
  );
  const attachablePerformers = availablePerformers.filter(
    (performer) => !selectedPerformerIds.has(performer.id),
  );
  const fileLocations = video.fileLocations;

  useEffect(() => {
    setTitle(video.title);
  }, [video.id, video.title]);

  return (
    <Box
      component="section"
      aria-label="Video Detail Panel"
      className="video-detail-panel"
    >
      <Stack gap="md">
        <SectionHeader label="Selected Video" title="Video Detail Panel" />
        {detailStatusMessage ? <Text>{detailStatusMessage}</Text> : null}
        <Group align="end" wrap="nowrap">
          <TextInput
            className="video-detail-title-input"
            label="Title"
            value={title}
            w="100%"
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
          <Button type="button" onClick={() => void onSaveTitle(title)}>
            Save Title
          </Button>
        </Group>
        <Checkbox
          checked={video.isFavorite}
          label="Favorite"
          onChange={(event) => void onSetFavorite(event.currentTarget.checked)}
        />

        <Group gap="xl" align="start" grow>
          <MetadataChecklist
            attachableItems={attachableTags}
            availableItems={availableTags}
            label="Tags"
            onAttach={onAttachTag}
            onCreateOrAttach={onCreateOrAttachTag}
            onDetach={onDetachTag}
            selectedItems={selectedTags}
          />
          <MetadataChecklist
            attachableItems={attachablePerformers}
            availableItems={availablePerformers}
            label="Performers"
            onAttach={onAttachPerformer}
            onCreateOrAttach={onCreateOrAttachPerformer}
            onDetach={onDetachPerformer}
            selectedItems={selectedPerformers}
          />
        </Group>

        <Box component="dl" className="definition-list">
          <DefinitionTerm label="Duration">
            {formatDuration(video.durationMilliseconds)}
          </DefinitionTerm>
          <DefinitionTerm label="File Size">
            {formatFileSize(video.fileSizeBytes)}
          </DefinitionTerm>
        </Box>

        <Stack gap="xs">
          <Title order={3} size="h4">
            File Locations
          </Title>
          {fileLocations.length > 0 ? (
            fileLocations.map((fileLocation) => (
              <Group key={fileLocation.path} gap="xs" align="center">
                <Code className="wrapping-code">{fileLocation.path}</Code>
                <Text c="dimmed">
                  {formatFileSize(fileLocation.fileSizeBytes)}
                </Text>
                {fileLocation.isPreferred ? (
                  <Badge>Preferred File Location</Badge>
                ) : null}
              </Group>
            ))
          ) : (
            <Text c="dimmed">Missing</Text>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

export function MetadataChecklist<T extends { id: number; name: string }>({
  attachableItems,
  availableItems,
  label,
  onAttach,
  onCreateOrAttach,
  onDetach,
  selectedItems,
}: {
  attachableItems: T[];
  availableItems: T[];
  label: string;
  onAttach: (item: T) => void;
  onCreateOrAttach: (name: string) => void;
  onDetach: (item: T) => void;
  selectedItems: T[];
}) {
  const [newItemName, setNewItemName] = useState("");
  const trimmedNewItemName = newItemName.trim();
  const exactAvailableMatch = findMetadataByName(
    availableItems,
    trimmedNewItemName,
  );
  const exactAttachableMatch = findMetadataByName(
    attachableItems,
    trimmedNewItemName,
  );
  const isAlreadyAttached =
    exactAvailableMatch !== undefined && exactAttachableMatch === undefined;
  const nearMatch = findNearMetadataMatch(availableItems, trimmedNewItemName);
  const actionLabel = isAlreadyAttached
    ? `${singularMetadataLabel(label)} already attached`
    : exactAttachableMatch
      ? `Attach existing ${singularMetadataLabel(label)}`
      : `Create and attach ${singularMetadataLabel(label)}`;

  return (
    <Stack
      component="section"
      className="video-detail-metadata-checklist"
      gap="xs"
      aria-label={label}
    >
      <Title order={3} size="h4">
        {label}
      </Title>
      <TextInput
        label={`New ${singularMetadataLabel(label)}`}
        value={newItemName}
        w="100%"
        onChange={(event) => setNewItemName(event.currentTarget.value)}
      />
      {nearMatch ? <Text size="sm">Near match: {nearMatch.name}</Text> : null}
      <Button
        type="button"
        size="xs"
        variant="default"
        disabled={isAlreadyAttached}
        onClick={() => {
          void onCreateOrAttach(trimmedNewItemName);
          setNewItemName("");
        }}
      >
        {actionLabel}
      </Button>
      {selectedItems.map((item) => (
        <Button
          key={item.id}
          type="button"
          size="xs"
          variant="light"
          onClick={() => void onDetach(item)}
        >
          Remove {item.name}
        </Button>
      ))}
      {attachableItems.map((item) => (
        <Button
          key={item.id}
          type="button"
          size="xs"
          variant="default"
          onClick={() => void onAttach(item)}
        >
          Attach {item.name}
        </Button>
      ))}
    </Stack>
  );
}
