import { useEffect, useState } from "react";
import { ActionIcon, Group, TextInput, Title, Tooltip } from "@mantine/core";
import { IconCheck, IconPencil, IconX } from "@tabler/icons-react";

import styles from "../VideoDetailPanel.module.css";

const titleEditIconSize = 18;

export function TitleEditor({
  onSaveTitle,
  title,
  videoId,
}: {
  onSaveTitle: (title: string) => void;
  title: string;
  videoId: number;
}) {
  const [editedTitle, setEditedTitle] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  useEffect(() => {
    setEditedTitle(title);
    setIsEditingTitle(false);
  }, [videoId, title]);

  function startTitleEdit() {
    setEditedTitle(title);
    setIsEditingTitle(true);
  }

  function saveTitle() {
    onSaveTitle(editedTitle);
    setIsEditingTitle(false);
  }

  function cancelTitleEdit() {
    setEditedTitle(title);
    setIsEditingTitle(false);
  }

  if (isEditingTitle) {
    return (
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
    );
  }

  return (
    <Group align="start" wrap="nowrap">
      <Title className={styles.title} order={2} size="h3">
        {title}
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
  );
}
