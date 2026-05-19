import { Box, SimpleGrid, Stack, Text } from "@mantine/core";

import type { CatalogVideo } from "../../../tauriCommands";
import { SectionHeader } from "../../../shared/components/SectionHeader";
import { MissingVideosPanel } from "./components/MissingVideosPanel";

export function ScanIssuesPanel({
  missingVideos,
  onRequestMissingVideoForget,
  scanIssuesStatusMessage,
}: {
  missingVideos: CatalogVideo[];
  onRequestMissingVideoForget: (catalogVideo: CatalogVideo) => void;
  scanIssuesStatusMessage: string;
}) {
  return (
    <Box component="section" aria-label="Scan Issues" p="md" maw={760}>
      <Stack gap="md">
        <SectionHeader label="Scan issues" title="Scan Issues" />

        {scanIssuesStatusMessage ? <Text>{scanIssuesStatusMessage}</Text> : null}

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          <MissingVideosPanel
            missingVideos={missingVideos}
            onRequestMissingVideoForget={onRequestMissingVideoForget}
          />
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
