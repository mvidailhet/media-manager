import { Button, Group, TextInput } from "@mantine/core";
import { useState } from "react";

const timePartsSeparator = ":";
const secondsPerMinute = 60;
const secondsPerHour = 3600;

function startTimeTextToSeconds(startTimeText: string): number {
  const timeParts = startTimeText
    .split(timePartsSeparator)
    .map((timePart) => Number(timePart.trim()));

  if (timeParts.some((timePart) => !Number.isFinite(timePart) || timePart < 0)) {
    return 0;
  }

  if (timeParts.length === 3) {
    const [hours, minutes, seconds] = timeParts;
    return hours * secondsPerHour + minutes * secondsPerMinute + seconds;
  }

  if (timeParts.length === 2) {
    const [minutes, seconds] = timeParts;
    return minutes * secondsPerMinute + seconds;
  }

  if (timeParts.length === 1) {
    const [seconds] = timeParts;
    return seconds;
  }

  return 0;
}

export function ActionButtons({
  isAvailable,
  onOpenContainingFolder,
  onOpenVideo,
}: {
  isAvailable: boolean;
  onOpenContainingFolder: () => void;
  onOpenVideo: (startAtSeconds: number) => void;
}) {
  const [startTimeText, setStartTimeText] = useState("0");

  return (
    <Group gap="xs">
      <TextInput
        aria-label="Start time"
        disabled={!isAvailable}
        value={startTimeText}
        onChange={(event) => setStartTimeText(event.currentTarget.value)}
        placeholder="0:00"
        w={100}
      />
      <Button
        type="button"
        disabled={!isAvailable}
        onClick={() => onOpenVideo(startTimeTextToSeconds(startTimeText))}
      >
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
