import { Box, Text, Title } from "@mantine/core";

export function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <Box>
      <Text c="dimmed" fw={700} size="sm" tt="uppercase">
        {label}
      </Text>
      <Title order={2} size="h3" mt={6}>
        {title}
      </Title>
    </Box>
  );
}
