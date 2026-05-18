import { Box, SimpleGrid, Stack, Text } from "@mantine/core";

import type { CatalogVideo, ScanRoot, UnprocessableVideoCandidate } from "../../../tauriCommands";
import { SectionHeader } from "../../../shared/components/SectionHeader";
import { MissingVideosPanel } from "./components/MissingVideosPanel";
import { UnavailableScanRootsPanel } from "./components/UnavailableScanRootsPanel";
import { UnprocessableCandidatesPanel } from "./components/UnprocessableCandidatesPanel";

export function ScanIssuesPanel({
  missingVideos,
  onRequestMissingVideoForget,
  scanIssuesStatusMessage,
  unavailableScanRoots,
  unprocessableVideoCandidates,
}: {
  missingVideos: CatalogVideo[];
  onRequestMissingVideoForget: (catalogVideo: CatalogVideo) => void;
  scanIssuesStatusMessage: string;
  unavailableScanRoots: ScanRoot[];
  unprocessableVideoCandidates: UnprocessableVideoCandidate[];
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
          <UnavailableScanRootsPanel unavailableScanRoots={unavailableScanRoots} />
          <UnprocessableCandidatesPanel
            unprocessableVideoCandidates={unprocessableVideoCandidates}
          />
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
