import { Box, Text, Title } from "@mantine/core";

import type { CatalogVideoWorkspace } from "../modules/catalog/catalogTypes";

export function WorkspaceHeader({
  catalogVideoWorkspace,
}: {
  catalogVideoWorkspace: CatalogVideoWorkspace;
}) {
  const workspaceTitle =
    catalogVideoWorkspace === "favorites"
      ? "Favorites View"
      : catalogVideoWorkspace === "recentlyOpened"
        ? "Recently Opened View"
        : "Videos View";

  return (
    <Box component="section" maw={720} aria-labelledby="videos-view-title">
      <Text c="dimmed" fw={700} size="sm" tt="uppercase">
        Local Desktop App
      </Text>
      <Title id="videos-view-title" order={1} mt={8} mb={12}>
        {workspaceTitle}
      </Title>
      <Text c="dimmed" lh={1.6}>
        A local catalog workspace for organizing videos without a network
        dependency.
      </Text>
    </Box>
  );
}
