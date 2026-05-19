import { Box, Button, Divider, Stack, Text, Title } from "@mantine/core";

import type { CatalogVideo } from "../../../../tauriCommands";
import { formatDuration } from "../../../../shared/formatting/videoFormatting";

export function MissingVideosList({
  missingVideos,
  onRequestMissingVideoForget,
}: {
  missingVideos: CatalogVideo[];
  onRequestMissingVideoForget: (catalogVideo: CatalogVideo) => void;
}) {
  return (
    <Stack gap="xs">
      {missingVideos.length > 0 ? (
        <Stack gap="sm">
          {missingVideos.map((missingVideo) => (
            <Stack component="article" gap="xs" key={missingVideo.id}>
              <Divider />
              <Box>
                <Title order={4} size="h5">
                  {missingVideo.title}
                </Title>
                <Text c="dimmed">
                  {formatDuration(missingVideo.durationMilliseconds)}
                </Text>
              </Box>
              <Button
                type="button"
                size="xs"
                variant="light"
                onClick={() => onRequestMissingVideoForget(missingVideo)}
              >
                Forget From Catalog
              </Button>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed">No Missing Videos.</Text>
      )}
    </Stack>
  );
}
