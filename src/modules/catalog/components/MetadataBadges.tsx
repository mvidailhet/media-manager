import { Badge, type BadgeProps, Group, type GroupProps } from "@mantine/core";

import {
  metadataBadgeColorForKind,
  type MetadataBadgeKind,
} from "./metadataBadgeStyles";

export type { MetadataBadgeKind } from "./metadataBadgeStyles";

export function MetadataBadges<T extends { id: number; name: string }>({
  badgeSize,
  gap = "xs",
  items,
  label,
  metadataKind,
}: {
  badgeSize?: BadgeProps["size"];
  gap?: GroupProps["gap"];
  items: T[];
  label: string;
  metadataKind: MetadataBadgeKind;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Group aria-label={label} gap={gap}>
      {items.map((item) => (
        <Badge
          key={item.id}
          color={metadataBadgeColorForKind(metadataKind)}
          size={badgeSize}
          variant="light"
        >
          {item.name}
        </Badge>
      ))}
    </Group>
  );
}
