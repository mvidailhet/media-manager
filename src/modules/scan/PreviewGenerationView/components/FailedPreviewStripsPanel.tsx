import { Box, Button, Divider, Group, Stack, Text, Title } from "@mantine/core";

import type { FailedPreviewStrip } from "../../../../tauriCommands";
import { DefinitionList } from "../../../../shared/components/DefinitionList";
import { DefinitionTerm } from "../../../../shared/components/DefinitionTerm";

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
            <Stack component="article" gap="xs" key={failedPreviewStrip.videoId}>
              <Divider />
              <Box>
                <Title order={4} size="h5">
                  {failedPreviewStrip.title}
                </Title>
                <DefinitionList>
                  <DefinitionTerm label="Failure Reason">
                    {failedPreviewStrip.failureReason}
                  </DefinitionTerm>
                </DefinitionList>
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
