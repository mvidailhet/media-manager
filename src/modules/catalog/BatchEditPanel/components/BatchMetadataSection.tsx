import { Box, Stack, TagsInput, Text, Title } from "@mantine/core";

import type { CatalogPerformer, CatalogTag } from "../../../../tauriCommands";
import {
  findMetadataByName,
  normalizedMetadataName,
} from "../../../../shared/metadata/metadataHelpers";
import type { MetadataBadgeKind } from "../../components/MetadataBadges";
import {
  metadataInputPillSize,
  metadataInputPillStylesForKind,
} from "../../components/metadataBadgeStyles";
import type { BatchMetadataValue } from "../BatchEditPanel";

type MetadataValue = CatalogTag | CatalogPerformer;

export function BatchMetadataSection<TMetadata extends MetadataValue>({
  availableValues,
  emptyLabel,
  metadataKind,
  onAppend,
  onCreateOrAppend,
  onRemove,
  selectedVideoCount,
  selectedValues,
  title,
}: {
  availableValues: TMetadata[];
  emptyLabel: string;
  metadataKind: MetadataBadgeKind;
  onAppend: (value: TMetadata) => void;
  onCreateOrAppend: (name: string) => void;
  onRemove: (value: TMetadata) => void;
  selectedVideoCount: number;
  selectedValues: BatchMetadataValue<TMetadata>[];
  title: string;
}) {
  const selectedNames = selectedValues.map((value) => value.metadata.name);
  const metadataInputPillStyles = metadataInputPillStylesForKind(metadataKind);

  function changeSelectedNames(nextNames: string[]) {
    const normalizedPreviousNames = new Set(
      selectedNames.map(normalizedMetadataName),
    );
    const normalizedNextNames = new Set(nextNames.map(normalizedMetadataName));

    selectedValues
      .filter((value) =>
        !normalizedNextNames.has(normalizedMetadataName(value.metadata.name)),
      )
      .forEach((value) => onRemove(value.metadata));

    nextNames
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .filter(
        (name) => !normalizedPreviousNames.has(normalizedMetadataName(name)),
      )
      .forEach(appendOrCreateByName);
  }

  function appendOrCreateByName(name: string) {
    const existingValue = findMetadataByName(availableValues, name);

    if (existingValue) {
      onAppend(existingValue);
      return;
    }

    onCreateOrAppend(name);
  }

  return (
    <Box component="section" aria-label={`Batch ${title}`}>
      <Stack gap="xs">
        <Title order={3} size="h4">
          {title}
        </Title>
        <TagsInput
          aria-label={title}
          data={availableValues.map((value) => value.name)}
          size={metadataInputPillSize}
          styles={{ pill: metadataInputPillStyles }}
          value={selectedNames}
          onChange={changeSelectedNames}
        />
        {selectedValues.length > 0 ? (
          <Stack gap={4}>
            {selectedValues.map((value) => (
              <Text
                key={value.metadata.id}
                c={metadataKind === "tag" ? "blue" : "grape"}
                size="sm"
              >
                {value.metadata.name}{" "}
                {value.selectedVideoCount === selectedVideoCount
                  ? "on all selected Videos"
                  : "on some selected Videos"}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text c="dimmed">{emptyLabel}</Text>
        )}
      </Stack>
    </Box>
  );
}
