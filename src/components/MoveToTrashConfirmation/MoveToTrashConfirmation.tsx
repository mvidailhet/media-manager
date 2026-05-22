import { Button, Group, Modal, Stack, Text } from "@mantine/core";

import { PreferredFileLocationList } from "./components/PreferredFileLocationList";

type MoveToTrashConfirmationProps = {
  affectedFileLocations: string[];
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  selectedVideoCount?: number;
};

export function MoveToTrashConfirmation({
  affectedFileLocations,
  isOpen,
  onCancel,
  onConfirm,
  selectedVideoCount,
}: MoveToTrashConfirmationProps) {
  const affectedFileLocationCount = affectedFileLocations.length;
  const title = moveToTrashConfirmationTitle(affectedFileLocationCount);
  const affectedFileLocationSummary = moveToTrashConfirmationSummary(
    affectedFileLocationCount,
  );

  return (
    <Modal opened={isOpen} onClose={onCancel} title={title} centered>
      <Stack gap="md">
        {selectedVideoCount !== undefined ? (
          <Text>{selectedVideoCount} selected Videos</Text>
        ) : null}
        <Text>{affectedFileLocationSummary}</Text>
        <PreferredFileLocationList
          fileLocations={affectedFileLocations}
        />
        <Text c="dimmed">This action cannot be undone from the app.</Text>
        <Group gap="xs" justify="flex-end">
          <Button type="button" variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" color="red" onClick={onConfirm}>
            Move to Trash
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function moveToTrashConfirmationTitle(
  affectedFileLocationCount: number,
) {
  if (affectedFileLocationCount === 0) {
    return "Move selected Videos to Trash?";
  }

  if (affectedFileLocationCount === 1) {
    return "Move this file to Trash?";
  }

  return `Move ${affectedFileLocationCount} files to Trash?`;
}

function moveToTrashConfirmationSummary(
  affectedFileLocationCount: number,
) {
  if (affectedFileLocationCount === 0) {
    return "No reachable Preferred File Locations will be moved to Trash.";
  }

  if (affectedFileLocationCount === 1) {
    return "This File Location will be moved to Trash.";
  }

  return `${affectedFileLocationCount} File Locations will be moved to Trash.`;
}
