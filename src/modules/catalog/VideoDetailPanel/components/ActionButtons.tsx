import { Button, Group } from "@mantine/core";

export function ActionButtons({
  isAvailable,
  canPlayInApp,
  onMovePreferredFileLocationToTrash,
  onOpenContainingFolder,
  onOpenVideo,
  onPlayVideoInApp,
}: {
  isAvailable: boolean;
  canPlayInApp: boolean;
  onMovePreferredFileLocationToTrash?: () => void;
  onOpenContainingFolder: () => void;
  onOpenVideo: (startAtSeconds: number) => void;
  onPlayVideoInApp: () => void;
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
      {canPlayInApp ? (
        <Button
          type="button"
          disabled={!isAvailable}
          variant="default"
          onClick={onPlayVideoInApp}
        >
          Play in App
        </Button>
      ) : null}
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
