import { useEffect, useState } from "react";
import { Accordion, Box, Group, Stack, Text, Title } from "@mantine/core";

import type { CatalogPerformer, CatalogTag } from "../../../../../tauriCommands";
import {
  listPerformers,
  listTags,
  updatePerformer,
  updateTag,
} from "../../../../../tauriCommands";
import { errorMessage } from "../../../../../shared/errors/errorMessage";
import { MetadataSecretToggleList } from "./components/MetadataSecretToggleList";

const secretMetadataStatusMessage = "Secret Metadata unavailable";
const secretMetadataAccordionValue = "secret-metadata";

export function SecretMetadataSection({
  onPerformerSecretStatusChange,
  onTagSecretStatusChange,
}: {
  onPerformerSecretStatusChange: (performer: CatalogPerformer) => void;
  onTagSecretStatusChange: (tag: CatalogTag) => void;
}) {
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
    try {
      const updatedTag = await updateTag(tag.id, tag.name, isSecret);
      setTags((currentTags) =>
        currentTags.map((currentTag) =>
          currentTag.id === updatedTag.id ? updatedTag : currentTag,
        ),
      );
      onTagSecretStatusChange(updatedTag);
      setStatusMessage("");
    } catch (error) {
      setStatusMessage(errorMessage(error));
    }
  }

  async function changePerformerSecretStatus(
    performer: CatalogPerformer,
    isSecret: boolean,
  ) {
    try {
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
      onPerformerSecretStatusChange(updatedPerformer);
      setStatusMessage("");
    } catch (error) {
      setStatusMessage(errorMessage(error));
    }
  }

  return (
    <Box component="section" aria-label="Secret Tags and Performers">
      <Accordion transitionDuration={0}>
        <Accordion.Item value={secretMetadataAccordionValue}>
          <Accordion.Control>
            <Title order={3} size="h4">
              Secret Tags and Performers
            </Title>
          </Accordion.Control>
          <Accordion.Panel keepMounted={false}>
            <Stack gap="sm">
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
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Box>
  );
}
