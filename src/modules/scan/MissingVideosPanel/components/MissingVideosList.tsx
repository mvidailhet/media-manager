import { Stack, Text } from "@mantine/core";

import type { CatalogVideo } from "../../../../tauriCommands";
import { MissingVideoItem } from "./MissingVideoItem";

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
            <MissingVideoItem
              key={missingVideo.id}
              missingVideo={missingVideo}
              onRequestMissingVideoForget={onRequestMissingVideoForget}
            />
          ))}
        </Stack>
      ) : (
        <Text c="dimmed">No Missing Videos.</Text>
      )}
    </Stack>
  );
}
