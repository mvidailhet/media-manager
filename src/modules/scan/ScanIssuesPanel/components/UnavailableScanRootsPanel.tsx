import { Divider, Stack, Text, Title } from "@mantine/core";

import type { ScanRoot } from "../../../../tauriCommands";
import { WrappingCode } from "../../../../shared/components/WrappingCode";

export function UnavailableScanRootsPanel({
  unavailableScanRoots,
}: {
  unavailableScanRoots: ScanRoot[];
}) {
  return (
    <Stack
      component="section"
      gap="xs"
      aria-labelledby="unavailable-scan-roots-title"
    >
      <Title order={3} id="unavailable-scan-roots-title" size="h4">
        Unavailable Scan Roots
      </Title>
      {unavailableScanRoots.length > 0 ? (
        <Stack gap="sm">
          {unavailableScanRoots.map((scanRoot) => (
            <Stack component="article" gap="xs" key={scanRoot.path}>
              <Divider />
              <WrappingCode>{scanRoot.path}</WrappingCode>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed">No Unavailable Scan Roots.</Text>
      )}
    </Stack>
  );
}
