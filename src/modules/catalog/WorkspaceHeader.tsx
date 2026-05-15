import { Box, Text, Title } from "@mantine/core";

export function WorkspaceHeader() {
  return (
    <Box component="section" maw={720} aria-labelledby="catalog-title">
      <Text c="dimmed" fw={700} size="sm" tt="uppercase">
        Local Desktop App
      </Text>
      <Title id="catalog-title" order={1} mt={8} mb={12}>
        Catalog
      </Title>
      <Text c="dimmed" lh={1.6}>
        A local catalog workspace for organizing videos without a network
        dependency.
      </Text>
    </Box>
  );
}
