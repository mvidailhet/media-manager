import { Button, Group } from "@mantine/core";

export function ActionButtons({
  isAvailable,
  onOpenContainingFolder,
  onOpenVideo,
}: {
  isAvailable: boolean;
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
    </Group>
  );
}
