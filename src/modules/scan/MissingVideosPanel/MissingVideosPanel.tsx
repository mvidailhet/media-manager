import { Box, Text } from "@mantine/core";

import type { CatalogVideo } from "../../../tauriCommands";
import { SectionHeader } from "../../../shared/components/SectionHeader";
import { MissingVideosList } from "./components/MissingVideosList";

export function MissingVideosPanel({
  missingVideos,
  missingVideosStatusMessage,
  onRequestMissingVideoForget,
}: {
  missingVideos: CatalogVideo[];
  missingVideosStatusMessage: string;
  onRequestMissingVideoForget: (catalogVideo: CatalogVideo) => void;
}) {
  return (
    <Box component="section" aria-label="Missing Videos" p="md" maw={760}>
      <SectionHeader label="Missing videos" title="Missing Videos" />
      {missingVideosStatusMessage ? <Text>{missingVideosStatusMessage}</Text> : null}
      <MissingVideosList
        missingVideos={missingVideos}
        onRequestMissingVideoForget={onRequestMissingVideoForget}
      />
    </Box>
  );
}
