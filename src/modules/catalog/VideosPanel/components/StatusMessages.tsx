import { Text } from "@mantine/core";

import type { CatalogVideo } from "../../../../tauriCommands";

const catalogVideosEmptyMessage = "No Videos in the Catalog.";

export function StatusMessages({
  catalogVideoActionStatusMessage,
  catalogVideos,
  catalogVideosStatusMessage,
}: {
  catalogVideoActionStatusMessage: string;
  catalogVideos: CatalogVideo[];
  catalogVideosStatusMessage: string;
}) {
  return (
    <>
      {catalogVideosStatusMessage ? <Text>{catalogVideosStatusMessage}</Text> : null}
      {catalogVideoActionStatusMessage ? (
        <Text>{catalogVideoActionStatusMessage}</Text>
      ) : null}

      {!catalogVideosStatusMessage && catalogVideos.length === 0 ? (
        <Text c="dimmed">{catalogVideosEmptyMessage}</Text>
      ) : null}
    </>
  );
}
