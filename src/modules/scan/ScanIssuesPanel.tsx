import { Box, Button, Code, Divider, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";

import type { CatalogVideo, FailedPreviewStrip, ScanRoot, UnprocessableVideoCandidate } from "../../tauriCommands";
import { DefinitionTerm } from "../../shared/components/DefinitionTerm";
import { SectionHeader } from "../../shared/components/SectionHeader";
import { formatDuration, formatFileSize } from "../../shared/formatting/videoFormatting";

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

        {scanIssuesStatusMessage ? (
          <Text>{scanIssuesStatusMessage}</Text>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          <MissingVideosPanel
            missingVideos={missingVideos}
            onRequestMissingVideoForget={onRequestMissingVideoForget}
          />
          <UnavailableScanRootsPanel
            unavailableScanRoots={unavailableScanRoots}
          />
          <UnprocessableCandidatesPanel
            unprocessableVideoCandidates={unprocessableVideoCandidates}
          />
        </SimpleGrid>
      </Stack>
    </Box>
  );
}

export function MissingVideosPanel({
  missingVideos,
  onRequestMissingVideoForget,
}: {
  missingVideos: CatalogVideo[];
  onRequestMissingVideoForget: (catalogVideo: CatalogVideo) => void;
}) {
  return (
    <Stack component="section" gap="xs" aria-labelledby="missing-videos-title">
      <Title order={3} id="missing-videos-title" size="h4">
        Missing Videos
      </Title>
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
              <Code className="wrapping-code">{scanRoot.path}</Code>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed">No Unavailable Scan Roots.</Text>
      )}
    </Stack>
  );
}

export function UnprocessableCandidatesPanel({
  unprocessableVideoCandidates,
}: {
  unprocessableVideoCandidates: UnprocessableVideoCandidate[];
}) {
  return (
    <Stack
      component="section"
      gap="xs"
      aria-labelledby="unprocessable-candidates-title"
    >
      <Title order={3} id="unprocessable-candidates-title" size="h4">
        Unprocessable Video Candidates
      </Title>
      {unprocessableVideoCandidates.length > 0 ? (
        <Stack gap="sm">
          {unprocessableVideoCandidates.map((candidate) => (
            <Stack component="article" gap="xs" key={candidate.path}>
              <Divider />
              <Code className="wrapping-code">{candidate.path}</Code>
              <Box component="dl" className="definition-list">
                <DefinitionTerm label="Failure Reason">
                  {candidate.reason}
                </DefinitionTerm>
                <DefinitionTerm label="File Size">
                  {formatFileSize(candidate.fileSizeBytes)}
                </DefinitionTerm>
              </Box>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed">No Unprocessable Video Candidates.</Text>
      )}
    </Stack>
  );
}

export function FailedPreviewStripsPanel({
  failedPreviewStrips,
  onIgnoreFailedPreview,
  onRetryFailedPreview,
}: {
  failedPreviewStrips: FailedPreviewStrip[];
  onIgnoreFailedPreview: (failedPreviewStrip: FailedPreviewStrip) => void;
  onRetryFailedPreview: (failedPreviewStrip: FailedPreviewStrip) => void;
}) {
  return (
    <Stack
      component="section"
      gap="xs"
      aria-labelledby="failed-preview-strips-title"
    >
      <Title order={3} id="failed-preview-strips-title" size="h4">
        Failed Preview Strips
      </Title>
      {failedPreviewStrips.length > 0 ? (
        <Stack gap="sm">
          {failedPreviewStrips.map((failedPreviewStrip) => (
            <Stack
              component="article"
              gap="xs"
              key={failedPreviewStrip.videoId}
            >
              <Divider />
              <Box>
                <Title order={4} size="h5">
                  {failedPreviewStrip.title}
                </Title>
                <Box component="dl" className="definition-list">
                  <DefinitionTerm label="Failure Reason">
                    {failedPreviewStrip.failureReason}
                  </DefinitionTerm>
                </Box>
              </Box>
              <Group gap="xs">
                <Button
                  type="button"
                  size="xs"
                  variant="light"
                  aria-label={`Retry Failed Preview Strip for ${failedPreviewStrip.title}`}
                  onClick={() => void onRetryFailedPreview(failedPreviewStrip)}
                >
                  Retry
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="default"
                  aria-label={`Ignore Failed Preview Strip for ${failedPreviewStrip.title}`}
                  onClick={() => void onIgnoreFailedPreview(failedPreviewStrip)}
                >
                  Ignore
                </Button>
              </Group>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed">No Failed Preview Strips.</Text>
      )}
    </Stack>
  );
}
