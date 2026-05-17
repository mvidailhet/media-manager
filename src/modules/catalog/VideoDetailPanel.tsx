import { useEffect, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  TagsInput,
} from "@mantine/core";
import {
  IconCheck,
  IconPencil,
  IconRestore,
  IconX,
} from "@tabler/icons-react";

import type {
  CatalogPerformer,
  CatalogTag,
  CatalogVideo,
} from "../../tauriCommands";
import { WrappingCode } from "../../shared/components/WrappingCode";
import { formatFileSize } from "../../shared/formatting/videoFormatting";
import {
  findMetadataByName,
  normalizedMetadataName,
} from "../../shared/metadata/metadataHelpers";
import { VideoPreview } from "./components/VideoPreview";
import type { SelectedVideoDetailActions } from "./useSelectedVideoDetailActions";
import styles from "./VideoDetailPanel.module.css";

const titleEditIconSize = 18;
const metadataEditIconSize = 16;

type VideoMetadataValue = CatalogTag | CatalogPerformer;

export function VideoDetailPanel({
  actions,
  availablePerformers,
  availableTags,
  detailStatusMessage,
  performers,
  tags,
  video,
}: {
  actions: SelectedVideoDetailActions;
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  detailStatusMessage: string;
  performers: CatalogPerformer[];
  tags: CatalogTag[];
  video: CatalogVideo;
}) {
  const [editedTitle, setEditedTitle] = useState(video.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const fileLocations = video.fileLocations;

  useEffect(() => {
    setEditedTitle(video.title);
    setIsEditingTitle(false);
  }, [video.id, video.title]);

  function startTitleEdit() {
    setEditedTitle(video.title);
    setIsEditingTitle(true);
  }

  function saveTitle() {
    void actions.saveTitle(editedTitle);
    setIsEditingTitle(false);
  }

  function cancelTitleEdit() {
    setEditedTitle(video.title);
    setIsEditingTitle(false);
  }

  return (
    <Box
      component="section"
      aria-label="Video Detail Panel"
      className={styles.panel}
    >
      <Stack gap="md">
        {detailStatusMessage ? <Text>{detailStatusMessage}</Text> : null}
        {isEditingTitle ? (
          <Group align="end" wrap="nowrap">
            <TextInput
              className={styles.titleInput}
              label="Title"
              value={editedTitle}
              w="100%"
              onChange={(event) => setEditedTitle(event.currentTarget.value)}
            />
            <Tooltip label="Save title">
              <ActionIcon
                aria-label="Save title"
                color="green"
                size="lg"
                type="button"
                onClick={saveTitle}
              >
                <IconCheck size={titleEditIconSize} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Cancel title edit">
              <ActionIcon
                aria-label="Cancel title edit"
                color="gray"
                size="lg"
                type="button"
                variant="default"
                onClick={cancelTitleEdit}
              >
                <IconX size={titleEditIconSize} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : (
          <Group align="start" wrap="nowrap">
            <Title className={styles.title} order={2} size="h3">
              {video.title}
            </Title>
            <Tooltip label="Edit title">
              <ActionIcon
                aria-label="Edit title"
                size="lg"
                type="button"
                variant="default"
                onClick={startTitleEdit}
              >
                <IconPencil size={titleEditIconSize} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
        <VideoPreview
          catalogVideo={video}
          isLarge
          onFavoriteChange={actions.setFavorite}
        />
        <Group gap="xs">
          <Button
            type="button"
            disabled={!video.isAvailable}
            onClick={() => void actions.openVideo()}
          >
            Open
          </Button>
          <Button
            type="button"
            disabled={!video.isAvailable}
            variant="default"
            onClick={() => void actions.openContainingFolder()}
          >
            Open in finder
          </Button>
        </Group>

        <VideoMetadataSection
          availableValues={availableTags}
          emptyLabel="No tags"
          onAttach={actions.attachTag}
          onCreateOrAttach={actions.createOrAttachTag}
          onDetach={actions.detachTag}
          selectedValues={tags}
          title="Tags"
          videoId={video.id}
        />
        <VideoMetadataSection
          availableValues={availablePerformers}
          emptyLabel="No performers"
          onAttach={actions.attachPerformer}
          onCreateOrAttach={actions.createOrAttachPerformer}
          onDetach={actions.detachPerformer}
          selectedValues={performers}
          title="Performers"
          videoId={video.id}
        />

        <Stack gap="xs">
          <Title order={3} size="h4">
            File Locations
          </Title>
          {fileLocations.length > 0 ? (
            fileLocations.map((fileLocation) => (
              <Group key={fileLocation.path} gap="xs" align="center">
                <WrappingCode>{fileLocation.path}</WrappingCode>
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

function VideoMetadataSection<TMetadata extends VideoMetadataValue>({
  availableValues,
  emptyLabel,
  onAttach,
  onCreateOrAttach,
  onDetach,
  selectedValues,
  title,
  videoId,
}: {
  availableValues: TMetadata[];
  emptyLabel: string;
  onAttach: (value: TMetadata) => void;
  onCreateOrAttach: (name: string) => void;
  onDetach: (value: TMetadata) => void;
  selectedValues: TMetadata[];
  title: string;
  videoId: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [baselineValues, setBaselineValues] = useState<TMetadata[]>([]);
  const selectedNames = selectedValues.map((value) => value.name);
  const baselineNames = baselineValues.map((value) => value.name);
  const hasBaselineChanges = !areNameSetsEqual(selectedNames, baselineNames);

  useEffect(() => {
    setIsEditing(false);
    setBaselineValues([]);
  }, [videoId]);

  function startEditing() {
    setBaselineValues(selectedValues);
    setIsEditing(true);
  }

  function changeSelectedNames(nextNames: string[]) {
    const normalizedPreviousNames = new Set(
      selectedValues.map((value) => normalizedMetadataName(value.name)),
    );
    const normalizedNextNames = new Set(nextNames.map(normalizedMetadataName));

    selectedValues
      .filter((value) => !normalizedNextNames.has(normalizedMetadataName(value.name)))
      .forEach(onDetach);

    nextNames
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .filter((name) => !normalizedPreviousNames.has(normalizedMetadataName(name)))
      .forEach(attachOrCreateByName);
  }

  function attachOrCreateByName(name: string) {
    const existingValue = findMetadataByName(availableValues, name);

    if (existingValue) {
      onAttach(existingValue);
      return;
    }

    onCreateOrAttach(name);
  }

  function revertToBaseline() {
    const baselineIds = new Set(baselineValues.map((value) => value.id));
    const selectedIds = new Set(selectedValues.map((value) => value.id));

    baselineValues
      .filter((value) => !selectedIds.has(value.id))
      .forEach((value) => onCreateOrAttach(value.name));
    selectedValues
      .filter((value) => !baselineIds.has(value.id))
      .forEach(onDetach);
  }

  return (
    <Box component="section" aria-label={title}>
      <Stack gap="xs">
        <Group gap="xs" justify="space-between" wrap="nowrap">
          <Title order={3} size="h4">
            {title}
          </Title>
          {isEditing ? (
            <Group gap="xs" wrap="nowrap">
              {hasBaselineChanges ? (
                <Tooltip label={`Revert ${title}`}>
                  <ActionIcon
                    aria-label={`Revert ${title}`}
                    size="md"
                    type="button"
                    variant="default"
                    onClick={revertToBaseline}
                  >
                    <IconRestore size={metadataEditIconSize} />
                  </ActionIcon>
                </Tooltip>
              ) : null}
              <Button
                size="xs"
                type="button"
                variant="default"
                onClick={() => setIsEditing(false)}
              >
                Done {title}
              </Button>
            </Group>
          ) : (
            <Tooltip label={`Edit ${title}`}>
              <ActionIcon
                aria-label={`Edit ${title}`}
                size="md"
                type="button"
                variant="default"
                onClick={startEditing}
              >
                <IconPencil size={metadataEditIconSize} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
        {isEditing ? (
          <TagsInput
            aria-label={title}
            data={availableValues.map((value) => value.name)}
            value={selectedNames}
            onChange={changeSelectedNames}
          />
        ) : selectedValues.length > 0 ? (
          <Group gap="xs">
            {selectedValues.map((value) => (
              <Badge key={value.id} variant="light">
                {value.name}
              </Badge>
            ))}
          </Group>
        ) : (
          <Text c="dimmed">{emptyLabel}</Text>
        )}
      </Stack>
    </Box>
  );
}

function areNameSetsEqual(firstNames: string[], secondNames: string[]) {
  if (firstNames.length !== secondNames.length) {
    return false;
  }

  const normalizedSecondNames = new Set(secondNames.map(normalizedMetadataName));

  return firstNames.every((name) =>
    normalizedSecondNames.has(normalizedMetadataName(name)),
  );
}
