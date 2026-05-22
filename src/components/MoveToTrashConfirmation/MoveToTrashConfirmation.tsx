import { Button, Group, Modal, Stack, Text } from "@mantine/core";

import { PreferredFileLocationList } from "./components/PreferredFileLocationList";

type MoveToTrashConfirmationProps = {
  affectedPreferredFileLocations: string[];
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function MoveToTrashConfirmation({
  affectedPreferredFileLocations,
  isOpen,
  onCancel,
  onConfirm,
}: MoveToTrashConfirmationProps) {
  const affectedPreferredFileLocationCount =
    affectedPreferredFileLocations.length;
  const title = moveToTrashConfirmationTitle(
    affectedPreferredFileLocationCount,
  );
  const affectedPreferredFileLocationSummary =
    affectedPreferredFileLocationCount === 1
      ? "This Preferred File Location will be moved to Trash."
      : `${affectedPreferredFileLocationCount} Preferred File Locations will be moved to Trash.`;

  return (
    <Modal opened={isOpen} onClose={onCancel} title={title} centered>
      <Stack gap="md">
        <Text>{affectedPreferredFileLocationSummary}</Text>
        <PreferredFileLocationList
          preferredFileLocations={affectedPreferredFileLocations}
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
  affectedPreferredFileLocationCount: number,
) {
  if (affectedPreferredFileLocationCount === 1) {
    return "Move this file to Trash?";
  }

  return `Move ${affectedPreferredFileLocationCount} files to Trash?`;
}
