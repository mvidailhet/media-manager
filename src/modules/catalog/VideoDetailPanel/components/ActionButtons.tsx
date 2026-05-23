import { Button, Group } from "@mantine/core";

export function ActionButtons({
  isAvailable,
  onMovePreferredFileLocationToTrash,
  onOpenContainingFolder,
  onOpenVideo,
}: {
  isAvailable: boolean;
  onMovePreferredFileLocationToTrash?: () => void;
  onOpenContainingFolder: () => void;
  onOpenVideo: (startAtSeconds: number) => void;
}) {
  return (
    <Group gap="xs">
      <Button
        type="button"
        disabled={!isAvailable}
        onClick={() => onOpenVideo(0)}
      >
        Open
      </Button>
      <Button
        type="button"
        disabled={!isAvailable}
        variant="default"
        onClick={onOpenContainingFolder}
      >
        Reveal in Finder
      </Button>
      {onMovePreferredFileLocationToTrash ? (
        <Button
          type="button"
          color="red"
          onClick={onMovePreferredFileLocationToTrash}
        >
          Move Video to Trash
        </Button>
      ) : null}
    </Group>
  );
}
