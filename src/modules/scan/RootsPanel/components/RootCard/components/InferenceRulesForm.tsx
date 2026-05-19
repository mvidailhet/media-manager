import { useState } from "react";
import { Button, Checkbox, Group, NumberInput, Stack, TextInput } from "@mantine/core";

import type { ScanRoot } from "../../../../../../tauriCommands";

export function InferenceRulesForm({
  isScanRootRefreshRunning,
  onSaveInferenceRules,
  scanRoot,
}: {
  isScanRootRefreshRunning: boolean;
  onSaveInferenceRules: (
    scanRoot: ScanRoot,
    inferenceRules: ScanRoot["inferenceRules"],
  ) => void;
  scanRoot: ScanRoot;
}) {
  const [suggestTagsFromChildFolders, setSuggestTagsFromChildFolders] =
    useState(scanRoot.inferenceRules.suggestTagsFromChildFolders);
  const [ignoredFolderNames, setIgnoredFolderNames] = useState(
    scanRoot.inferenceRules.ignoredFolderNames.join(", "),
  );
  const [ignoredExactYearStart, setIgnoredExactYearStart] = useState(
    scanRoot.inferenceRules.ignoredExactYearRange.startYear,
  );
  const [ignoredExactYearEnd, setIgnoredExactYearEnd] = useState(
    scanRoot.inferenceRules.ignoredExactYearRange.endYear,
  );

  function saveInferenceRules() {
    onSaveInferenceRules(scanRoot, {
      ignoredExactYearRange: {
        endYear: ignoredExactYearEnd,
        startYear: ignoredExactYearStart,
      },
      ignoredFolderNames: ignoredFolderNames
        .split(",")
        .map((ignoredFolderName) => ignoredFolderName.trim())
        .filter((ignoredFolderName) => ignoredFolderName.length > 0),
      suggestTagsFromChildFolders,
    });
  }

  return (
    <Stack gap={4}>
      <Group align="end" gap="sm">
        <Checkbox
          checked={suggestTagsFromChildFolders}
          label="Suggest Tags"
          onChange={(event) =>
            setSuggestTagsFromChildFolders(event.currentTarget.checked)
          }
        />
      </Group>
      <TextInput
        label="Ignored folder names"
        size="sm"
        value={ignoredFolderNames}
        onChange={(event) => setIgnoredFolderNames(event.currentTarget.value)}
      />
      <Group align="end" gap="sm">
        <NumberInput
          label="Ignored year start"
          size="sm"
          value={ignoredExactYearStart}
          onChange={(value) =>
            setIgnoredExactYearStart(typeof value === "number" ? value : 1900)
          }
        />
        <NumberInput
          label="Ignored year end"
          size="sm"
          value={ignoredExactYearEnd}
          onChange={(value) =>
            setIgnoredExactYearEnd(typeof value === "number" ? value : 2099)
          }
        />
        <Button
          type="button"
          size="xs"
          onClick={saveInferenceRules}
          disabled={isScanRootRefreshRunning}
        >
          Save Inference Rules
        </Button>
      </Group>
    </Stack>
  );
}
