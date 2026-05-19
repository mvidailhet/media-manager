import { Badge, Group } from "@mantine/core";

type AttentionTabLabelProps = {
  attentionCount: number;
  label: string;
};

export function AttentionTabLabel({
  attentionCount,
  label,
}: AttentionTabLabelProps) {
  return (
    <Group gap={6}>
      <span>{label}</span>
      {attentionCount > 0 ? (
        <Badge size="sm" color="red">
          {attentionCount}
        </Badge>
      ) : null}
    </Group>
  );
}
