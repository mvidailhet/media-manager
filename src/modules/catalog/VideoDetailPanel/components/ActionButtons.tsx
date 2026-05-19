import { Button, Group } from "@mantine/core";

export function ActionButtons({
  isAvailable,
  onOpenContainingFolder,
  onOpenVideo,
}: {
  isAvailable: boolean;
  onOpenContainingFolder: () => void;
  onOpenVideo: () => void;
}) {
  return (
    <Group gap="xs">
      <Button type="button" disabled={!isAvailable} onClick={onOpenVideo}>
        Open
      </Button>
      <Button
        type="button"
        disabled={!isAvailable}
        variant="default"
        onClick={onOpenContainingFolder}
      >
        Open in finder
      </Button>
    </Group>
  );
}
