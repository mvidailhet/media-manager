import { Checkbox, Stack, Text, Title } from "@mantine/core";

type MetadataValue = {
  id: number;
  isSecret: boolean;
  name: string;
};

export function MetadataSecretToggleList<TMetadata extends MetadataValue>({
  emptyMessage,
  metadataKind,
  onChangeSecretStatus,
  values,
}: {
  emptyMessage: string;
  metadataKind: "Tag" | "Performer";
  onChangeSecretStatus: (value: TMetadata, isSecret: boolean) => void;
  values: TMetadata[];
}) {
  return (
    <Stack component="section" aria-label={`${metadataKind}s`} gap="xs">
      <Title order={4} size="h5">
        {metadataKind}s
      </Title>
      {values.length > 0 ? (
        <Stack gap={4}>
          {values.map((value) => (
            <Checkbox
              key={value.id}
              checked={value.isSecret}
              label={value.name}
              aria-label={`${value.name} secret ${metadataKind}`}
              onChange={(event) =>
                void onChangeSecretStatus(value, event.currentTarget.checked)
              }
            />
          ))}
        </Stack>
      ) : (
        <Text c="dimmed">{emptyMessage}</Text>
      )}
    </Stack>
  );
}
