import { Button, Group, Paper, Stack, Title } from "@mantine/core";

import type { ScanRoot, ScanRootRemovalPolicy } from "../modules/scan";
import { WrappingCode } from "../shared/components/WrappingCode";

type RemoveScanRootConfirmationProps = {
  scanRoot: ScanRoot;
  confirmScanRootRemoval: (
    removalPolicy: ScanRootRemovalPolicy,
  ) => Promise<void>;
  cancelScanRootRemoval: () => void;
};

export function RemoveScanRootConfirmation({
  scanRoot,
  confirmScanRootRemoval,
  cancelScanRootRemoval,
}: RemoveScanRootConfirmationProps) {
  return (
    <Paper
      component="section"
      aria-label="Remove Scan Root confirmation"
      p="md"
      maw={760}
    >
      <Stack gap="sm">
        <Title order={2} size="h3">
          Remove Scan Root
        </Title>
        <WrappingCode>{scanRoot.path}</WrappingCode>
        <Group gap="xs">
          <Button
            type="button"
            onClick={() => void confirmScanRootRemoval("preserveMissingVideos")}
          >
            Preserve as Missing Videos
          </Button>
          <Button
            type="button"
            variant="light"
            color="red"
            onClick={() => void confirmScanRootRemoval("forgetFromCatalog")}
          >
            Forget From Catalog
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={cancelScanRootRemoval}
          >
            Cancel
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
