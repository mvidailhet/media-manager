import { Box, Text } from "@mantine/core";

export function DefinitionTerm({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Box>
      <Text component="dt" c="dimmed" fw={700} size="xs" tt="uppercase">
        {label}
      </Text>
      <Text component="dd" className="definition-value">
        {children}
      </Text>
    </Box>
  );
}
