import { Badge, Button, Group, Stack, Text, Title } from "@mantine/core";

import { WrappingCode } from "../../../../shared/components/WrappingCode";
import { formatFileSize } from "../../../../shared/formatting/videoFormatting";
import type { CatalogVideo } from "../../../../tauriCommands";

type FileLocation = CatalogVideo["fileLocations"][number];

export function FileLocationsSection({
  fileLocations,
  onRequestMoveToTrash,
}: {
  fileLocations: FileLocation[];
  onRequestMoveToTrash: (path: string) => void;
}) {
  return (
    <Stack gap="xs">
      <Title order={3} size="h4">
        File Locations
      </Title>
      {fileLocations.length > 0 ? (
        fileLocations.map((fileLocation) => (
          <Group key={fileLocation.path} gap="xs" align="center">
            <WrappingCode>{fileLocation.path}</WrappingCode>
            <Text c="dimmed">{formatFileSize(fileLocation.fileSizeBytes)}</Text>
            {fileLocation.isPreferred ? (
              <Badge>Preferred File Location</Badge>
            ) : null}
            {fileLocation.isReachable ? (
              <Button
                type="button"
                aria-label={`Move ${fileLocation.path} to Trash`}
                color="red"
                variant="subtle"
                onClick={() => onRequestMoveToTrash(fileLocation.path)}
              >
                Move to Trash
              </Button>
            ) : null}
          </Group>
        ))
      ) : (
        <Text c="dimmed">Missing</Text>
      )}
    </Stack>
  );
}
