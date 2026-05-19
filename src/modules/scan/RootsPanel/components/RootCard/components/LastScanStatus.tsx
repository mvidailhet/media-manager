import { Text } from "@mantine/core";

import type { ScanRoot } from "../../../../../../tauriCommands";

const millisecond = 1;
const secondInMilliseconds = 1_000 * millisecond;
const minuteInMilliseconds = 60 * secondInMilliseconds;
const hourInMilliseconds = 60 * minuteInMilliseconds;
const dayInMilliseconds = 24 * hourInMilliseconds;

export function LastScanStatus({ scanRoot }: { scanRoot: ScanRoot }) {
  return (
    <Text c="dimmed" size="sm">
      {lastScanStatusLabel(scanRoot.lastScanCompletedAt)}
    </Text>
  );
}

function lastScanStatusLabel(lastScanCompletedAt: string | null | undefined) {
  if (!lastScanCompletedAt) {
    return "No scan completed yet";
  }

  return `Last scan done ${formatTimeAgo(lastScanCompletedAt)} ago`;
}

function formatTimeAgo(timestamp: string) {
  const completedAt = new Date(timestampAsUtcWhenTimezoneIsMissing(timestamp));
  const elapsedMilliseconds = Math.max(Date.now() - completedAt.getTime(), 0);

  if (elapsedMilliseconds < minuteInMilliseconds) {
    return "just now";
  }

  if (elapsedMilliseconds < hourInMilliseconds) {
    return formatWholeUnit(elapsedMilliseconds, minuteInMilliseconds, "minute");
  }

  if (elapsedMilliseconds < dayInMilliseconds) {
    return formatWholeUnit(elapsedMilliseconds, hourInMilliseconds, "hour");
  }

  return formatWholeUnit(elapsedMilliseconds, dayInMilliseconds, "day");
}

function timestampAsUtcWhenTimezoneIsMissing(timestamp: string) {
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp);

  if (hasTimezone) {
    return timestamp;
  }

  return `${timestamp.replace(" ", "T")}Z`;
}

function formatWholeUnit(
  elapsedMilliseconds: number,
  unitMilliseconds: number,
  unitName: string,
) {
  const unitCount = Math.floor(elapsedMilliseconds / unitMilliseconds);
  const pluralSuffix = unitCount === 1 ? "" : "s";

  return `${unitCount} ${unitName}${pluralSuffix}`;
}
