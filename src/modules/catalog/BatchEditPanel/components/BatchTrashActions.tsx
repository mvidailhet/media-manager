import { useState } from "react";
import { Button, Stack, Text } from "@mantine/core";

import { MoveToTrashConfirmation } from "../../../../components/MoveToTrashConfirmation";
import type { BatchTrashTarget } from "../batchTrashTypes";

export function BatchTrashActions({
  onMoveToTrash,
  selectedVideoCount,
  trashTargets,
}: {
  onMoveToTrash: () => Promise<void>;
  selectedVideoCount: number;
  trashTargets: BatchTrashTarget[];
}) {
  const [isConfirmingTrash, setIsConfirmingTrash] = useState(false);
  const affectedFileLocations = trashTargets.map((target) => target.path);

  function confirmMoveToTrash() {
    void onMoveToTrash();
    setIsConfirmingTrash(false);
  }

  return (
    <Stack gap="xs">
      <Button
        color="red"
        onClick={() => setIsConfirmingTrash(true)}
        type="button"
        variant="subtle"
      >
        Move selected Videos to Trash
      </Button>
      <MoveToTrashConfirmation
        affectedFileLocations={affectedFileLocations}
        isOpen={isConfirmingTrash}
        onCancel={() => setIsConfirmingTrash(false)}
        onConfirm={confirmMoveToTrash}
        selectedVideoCount={selectedVideoCount}
      />
      {trashTargets.length === 0 ? (
        <Text c="dimmed" size="sm">
          No selected Videos have a reachable Preferred File Location.
        </Text>
      ) : null}
    </Stack>
  );
}
