import { Divider, Stack, Text, Title } from "@mantine/core";

import type { UnprocessableVideoCandidate } from "../../../../tauriCommands";
import { DefinitionList } from "../../../../shared/components/DefinitionList";
import { DefinitionTerm } from "../../../../shared/components/DefinitionTerm";
import { WrappingCode } from "../../../../shared/components/WrappingCode";
import { formatFileSize } from "../../../../shared/formatting/videoFormatting";

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
              <WrappingCode>{candidate.path}</WrappingCode>
              <DefinitionList>
                <DefinitionTerm label="Failure Reason">
                  {candidate.reason}
                </DefinitionTerm>
                <DefinitionTerm label="File Size">
                  {formatFileSize(candidate.fileSizeBytes)}
                </DefinitionTerm>
              </DefinitionList>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed">No Unprocessable Video Candidates.</Text>
      )}
    </Stack>
  );
}
