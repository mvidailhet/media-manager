import { Badge } from "@mantine/core";

export function AvailabilityBadge({
  isAvailable,
  missingLabel = "Unavailable",
}: {
  isAvailable: boolean;
  missingLabel?: string;
}) {
  return (
    <Badge color={isAvailable ? "teal" : "red"} variant="light">
      {isAvailable ? "Available" : missingLabel}
    </Badge>
  );
}
