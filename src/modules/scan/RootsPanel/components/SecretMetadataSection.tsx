import { useEffect, useState } from "react";
import { Box, Group, Stack, Text, Title } from "@mantine/core";

import type { CatalogPerformer, CatalogTag } from "../../../../tauriCommands";
import {
  listPerformers,
  listTags,
  updatePerformer,
  updateTag,
} from "../../../../tauriCommands";
import { MetadataSecretToggleList } from "./SecretMetadataSection/MetadataSecretToggleList";

const secretMetadataStatusMessage = "Secret Metadata unavailable";

export function SecretMetadataSection() {
  const [tags, setTags] = useState<CatalogTag[]>([]);
  const [performers, setPerformers] = useState<CatalogPerformer[]>([]);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    let canUpdateSecretMetadata = true;

    async function loadSecretMetadata() {
      try {
        const [storedTags, storedPerformers] = await Promise.all([
          listTags(),
          listPerformers(),
        ]);

        if (canUpdateSecretMetadata) {
          setTags(storedTags);
          setPerformers(storedPerformers);
          setStatusMessage("");
        }
      } catch {
        if (canUpdateSecretMetadata) {
          setStatusMessage(secretMetadataStatusMessage);
        }
      }
    }

    void loadSecretMetadata();

    return () => {
      canUpdateSecretMetadata = false;
    };
  }, []);

  async function changeTagSecretStatus(tag: CatalogTag, isSecret: boolean) {
    const updatedTag = await updateTag(tag.id, tag.name, isSecret);
    setTags((currentTags) =>
      currentTags.map((currentTag) =>
        currentTag.id === updatedTag.id ? updatedTag : currentTag,
      ),
    );
  }

  async function changePerformerSecretStatus(
    performer: CatalogPerformer,
    isSecret: boolean,
  ) {
    const updatedPerformer = await updatePerformer(
      performer.id,
      performer.name,
      isSecret,
    );
    setPerformers((currentPerformers) =>
      currentPerformers.map((currentPerformer) =>
        currentPerformer.id === updatedPerformer.id
          ? updatedPerformer
          : currentPerformer,
      ),
    );
  }

  return (
    <Box component="section" aria-label="Secret Tags and Performers">
      <Stack gap="sm">
        <Title order={3} size="h4">
          Secret Tags and Performers
        </Title>
        {statusMessage ? <Text>{statusMessage}</Text> : null}
        <Group align="start" gap="xl">
          <MetadataSecretToggleList
            emptyMessage="No Tags available."
            metadataKind="Tag"
            values={tags}
            onChangeSecretStatus={changeTagSecretStatus}
          />
          <MetadataSecretToggleList
            emptyMessage="No Performers available."
            metadataKind="Performer"
            values={performers}
            onChangeSecretStatus={changePerformerSecretStatus}
          />
        </Group>
      </Stack>
    </Box>
  );
}
