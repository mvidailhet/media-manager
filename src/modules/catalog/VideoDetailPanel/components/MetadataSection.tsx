import { useEffect, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Stack,
  TagsInput,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconPencil, IconRestore } from "@tabler/icons-react";

import type { CatalogPerformer, CatalogTag } from "../../../../tauriCommands";
import {
  findMetadataByName,
  normalizedMetadataName,
} from "../../../../shared/metadata/metadataHelpers";
import {
  MetadataBadges,
  type MetadataBadgeKind,
} from "../../components/MetadataBadges";

const metadataEditIconSize = 16;

type MetadataValue = CatalogTag | CatalogPerformer;

export function MetadataSection<TMetadata extends MetadataValue>({
  availableValues,
  emptyLabel,
  onAttach,
  onCreateOrAttach,
  onDetach,
  selectedValues,
  metadataKind,
  title,
  videoId,
}: {
  availableValues: TMetadata[];
  emptyLabel: string;
  onAttach: (value: TMetadata) => void;
  onCreateOrAttach: (name: string) => void;
  onDetach: (value: TMetadata) => void;
  selectedValues: TMetadata[];
  metadataKind: MetadataBadgeKind;
  title: string;
  videoId: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [baselineValues, setBaselineValues] = useState<TMetadata[]>([]);
  const selectedNames = selectedValues.map((value) => value.name);
  const baselineNames = baselineValues.map((value) => value.name);
  const hasBaselineChanges = !areNameSetsEqual(selectedNames, baselineNames);

  useEffect(() => {
    setIsEditing(false);
    setBaselineValues([]);
  }, [videoId]);

  function startEditing() {
    setBaselineValues(selectedValues);
    setIsEditing(true);
  }

  function changeSelectedNames(nextNames: string[]) {
    const normalizedPreviousNames = new Set(
      selectedValues.map((value) => normalizedMetadataName(value.name)),
    );
    const normalizedNextNames = new Set(nextNames.map(normalizedMetadataName));

    selectedValues
      .filter(
        (value) => !normalizedNextNames.has(normalizedMetadataName(value.name)),
      )
      .forEach(onDetach);

    nextNames
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .filter(
        (name) => !normalizedPreviousNames.has(normalizedMetadataName(name)),
      )
      .forEach(attachOrCreateByName);
  }

  function attachOrCreateByName(name: string) {
    const existingValue = findMetadataByName(availableValues, name);

    if (existingValue) {
      onAttach(existingValue);
      return;
    }

    onCreateOrAttach(name);
  }

  function revertToBaseline() {
    const baselineIds = new Set(baselineValues.map((value) => value.id));
    const selectedIds = new Set(selectedValues.map((value) => value.id));

    baselineValues
      .filter((value) => !selectedIds.has(value.id))
      .forEach((value) => onCreateOrAttach(value.name));
    selectedValues
      .filter((value) => !baselineIds.has(value.id))
      .forEach(onDetach);
  }

  return (
    <Box component="section" aria-label={title}>
      <Stack gap="xs">
        <Group gap="xs" justify="space-between" wrap="nowrap">
          <Title order={3} size="h4">
            {title}
          </Title>
          {isEditing ? (
            <Group gap="xs" wrap="nowrap">
              {hasBaselineChanges ? (
                <Tooltip label={`Revert ${title}`}>
                  <ActionIcon
                    aria-label={`Revert ${title}`}
                    size="md"
                    type="button"
                    variant="default"
                    onClick={revertToBaseline}
                  >
                    <IconRestore size={metadataEditIconSize} />
                  </ActionIcon>
                </Tooltip>
              ) : null}
              <Button
                size="xs"
                type="button"
                variant="default"
                onClick={() => setIsEditing(false)}
              >
                Done {title}
              </Button>
            </Group>
          ) : (
            <Tooltip label={`Edit ${title}`}>
              <ActionIcon
                aria-label={`Edit ${title}`}
                size="md"
                type="button"
                variant="default"
                onClick={startEditing}
              >
                <IconPencil size={metadataEditIconSize} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
        {isEditing ? (
          <TagsInput
            aria-label={title}
            data={availableValues.map((value) => value.name)}
            value={selectedNames}
            onChange={changeSelectedNames}
          />
        ) : selectedValues.length > 0 ? (
          <MetadataBadges
            items={selectedValues}
            label={title}
            metadataKind={metadataKind}
          />
        ) : (
          <Text c="dimmed">{emptyLabel}</Text>
        )}
      </Stack>
    </Box>
  );
}

function areNameSetsEqual(firstNames: string[], secondNames: string[]) {
  if (firstNames.length !== secondNames.length) {
    return false;
  }

  const normalizedSecondNames = new Set(secondNames.map(normalizedMetadataName));

  return firstNames.every((name) =>
    normalizedSecondNames.has(normalizedMetadataName(name)),
  );
}
