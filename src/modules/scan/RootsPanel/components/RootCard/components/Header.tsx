import { ActionIcon, Button, Group } from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";

import type { ScanRoot } from "../../../../../../tauriCommands";
import { AvailabilityBadge } from "../../../../../../shared/components/AvailabilityBadge";
import { WrappingCode } from "../../../../../../shared/components/WrappingCode";

export function Header({
  areInferenceRulesOpen,
  isScanRootRefreshRunning,
  onCheckScanRootAvailability,
  onRefreshSelectedRoot,
  onRemoveRoot,
  onToggleInferenceRules,
  scanRoot,
}: {
  areInferenceRulesOpen: boolean;
  isScanRootRefreshRunning: boolean;
  onCheckScanRootAvailability: (scanRoot: ScanRoot) => void;
  onRefreshSelectedRoot: (scanRoot: ScanRoot) => void;
  onRemoveRoot: (scanRoot: ScanRoot) => void;
  onToggleInferenceRules: () => void;
  scanRoot: ScanRoot;
}) {
  const inferenceRulesButtonLabel = areInferenceRulesOpen
    ? `Hide Scan Root settings for ${scanRoot.path}`
    : `Show Scan Root settings for ${scanRoot.path}`;

  return (
    <Group gap="sm" justify="space-between">
      <Group gap="xs">
        <WrappingCode>{scanRoot.path}</WrappingCode>
        <AvailabilityBadge isAvailable={scanRoot.isAvailable} />
      </Group>
      <Group gap="xs">
        <ActionIcon
          aria-label={inferenceRulesButtonLabel}
          type="button"
          size="sm"
          variant="subtle"
          onClick={onToggleInferenceRules}
        >
          <IconSettings size={16} />
        </ActionIcon>
        {scanRoot.isAvailable ? (
          <Button
            type="button"
            size="xs"
            variant="default"
            aria-label={`Refresh Scan Root ${scanRoot.path}`}
            onClick={() => void onRefreshSelectedRoot(scanRoot)}
            disabled={isScanRootRefreshRunning}
          >
            Refresh
          </Button>
        ) : (
          <Button
            type="button"
            size="xs"
            variant="default"
            aria-label={`Check availability for Scan Root ${scanRoot.path}`}
            onClick={() => void onCheckScanRootAvailability(scanRoot)}
            disabled={isScanRootRefreshRunning}
          >
            Check availability
          </Button>
        )}
        <Button
          type="button"
          size="xs"
          variant="light"
          color="red"
          onClick={() => onRemoveRoot(scanRoot)}
          disabled={isScanRootRefreshRunning}
        >
          Remove
        </Button>
      </Group>
    </Group>
  );
}
