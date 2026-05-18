import { Badge, Group } from "@mantine/core";

export function MetadataBadges<T extends { id: number; name: string }>({
  items,
  label,
}: {
  items: T[];
  label: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Group aria-label={label} gap={4}>
      {items.map((item) => (
        <Badge key={item.id} size="xs" variant="light">
          {item.name}
        </Badge>
      ))}
    </Group>
  );
}
