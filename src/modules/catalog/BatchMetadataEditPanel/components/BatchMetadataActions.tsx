import { useState } from "react";
import { Button, Group, Stack, Text, TextInput, Title } from "@mantine/core";

import {
  findMetadataByName,
  findNearMetadataMatch,
  singularMetadataLabel,
} from "../../../../shared/metadata/metadataHelpers";

export function BatchMetadataActions<T extends { id: number; name: string }>({
  availableItems,
  label,
  onAppend,
  onCreateOrAppend,
  onRemove,
  removableItems,
}: {
  availableItems: T[];
  label: string;
  onAppend: (item: T) => void;
  onCreateOrAppend: (name: string) => void;
  onRemove: (item: T) => void;
  removableItems: T[];
}) {
  const [newItemName, setNewItemName] = useState("");
  const trimmedNewItemName = newItemName.trim();
  const exactAvailableMatch = findMetadataByName(
    availableItems,
    trimmedNewItemName,
  );
  const nearMatch = findNearMetadataMatch(availableItems, trimmedNewItemName);
  const actionLabel = exactAvailableMatch
    ? `Append existing ${singularMetadataLabel(label)} to selected Videos`
    : `Create and append ${singularMetadataLabel(label)} to selected Videos`;

  return (
    <Stack component="section" gap="xs" aria-label={`Batch ${label}`}>
      <Title order={3} size="h4">
        {label}
      </Title>
      <TextInput
        label={`New ${singularMetadataLabel(label)}`}
        value={newItemName}
        onChange={(event) => setNewItemName(event.currentTarget.value)}
      />
      {nearMatch ? <Text size="sm">Near match: {nearMatch.name}</Text> : null}
      <Button
        type="button"
        size="xs"
        variant="default"
        onClick={() => {
          void onCreateOrAppend(trimmedNewItemName);
          setNewItemName("");
        }}
      >
        {actionLabel}
      </Button>
      {availableItems.map((item) => (
        <Button
          key={item.id}
          type="button"
          size="xs"
          variant="default"
          onClick={() => void onAppend(item)}
        >
          Append {item.name} to selected Videos
        </Button>
      ))}
      {removableItems.map((item) => (
        <Group key={item.id} gap="xs">
          <Button
            type="button"
            size="xs"
            variant="light"
            onClick={() => void onRemove(item)}
          >
            Remove {item.name} from selected Videos
          </Button>
        </Group>
      ))}
    </Stack>
  );
}
