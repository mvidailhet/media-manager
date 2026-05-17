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
} from "@mantine/core";
import { IconCheck, IconPencil, IconX } from "@tabler/icons-react";

import type { CatalogVideo } from "../../tauriCommands";
import { WrappingCode } from "../../shared/components/WrappingCode";
import { formatFileSize } from "../../shared/formatting/videoFormatting";
import { VideoPreview } from "./components/VideoPreview";
import styles from "./VideoDetailPanel.module.css";

const titleEditIconSize = 18;

export function VideoDetailPanel({
  detailStatusMessage,
  onOpenContainingFolder,
  onOpenVideo,
  onSaveTitle,
  onSetFavorite,
  video,
}: {
  detailStatusMessage: string;
  onOpenContainingFolder: () => void;
  onOpenVideo: () => void;
  onSaveTitle: (title: string) => void;
  onSetFavorite: (isFavorite: boolean) => void;
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
    void onSaveTitle(editedTitle);
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
          onFavoriteChange={onSetFavorite}
        />
        <Group gap="xs">
          <Button
            type="button"
            disabled={!video.isAvailable}
            onClick={() => void onOpenVideo()}
          >
            Open
          </Button>
          <Button
            type="button"
            disabled={!video.isAvailable}
            variant="default"
            onClick={() => void onOpenContainingFolder()}
          >
            Open in finder
          </Button>
        </Group>

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
