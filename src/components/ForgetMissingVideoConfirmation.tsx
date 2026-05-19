import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";

import type { CatalogVideo } from "../modules/catalog";

type ForgetMissingVideoConfirmationProps = {
  missingVideo: CatalogVideo;
  confirmMissingVideoForget: () => Promise<void>;
  cancelMissingVideoForget: () => void;
};

export function ForgetMissingVideoConfirmation({
  missingVideo,
  confirmMissingVideoForget,
  cancelMissingVideoForget,
}: ForgetMissingVideoConfirmationProps) {
  return (
    <Paper
      component="section"
      aria-label="Forget Missing Video confirmation"
      p="md"
      maw={760}
    >
      <Stack gap="sm">
        <Title order={2} size="h3">
          Forget Missing Video
        </Title>
        <Text>{missingVideo.title}</Text>
        <Group gap="xs">
          <Button
            type="button"
            color="red"
            onClick={() => void confirmMissingVideoForget()}
          >
            Confirm Forget From Catalog
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={cancelMissingVideoForget}
          >
            Cancel
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
