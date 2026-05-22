import { useState } from "react";
import { Box, Stack, Text } from "@mantine/core";

import { MoveToTrashConfirmation } from "../../../components/MoveToTrashConfirmation";
import type {
  CatalogPerformer,
  CatalogTag,
  CatalogVideo,
} from "../../../tauriCommands";
import { VideoPreview } from "../components/VideoPreview/VideoPreview";
import type { SelectedVideoDetailActions } from "../useSelectedVideoDetailActions";
import { ActionButtons } from "./components/ActionButtons";
import { FileLocationsSection } from "./components/FileLocationsSection";
import { MetadataSection } from "./components/MetadataSection";
import { TitleEditor } from "./components/TitleEditor";
import styles from "./VideoDetailPanel.module.css";

export function VideoDetailPanel({
  actions,
  availablePerformers,
  availableTags,
  detailStatusMessage,
  performers,
  tags,
  video,
}: {
  actions: SelectedVideoDetailActions;
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  detailStatusMessage: string;
  performers: CatalogPerformer[];
  tags: CatalogTag[];
  video: CatalogVideo;
}) {
  const fileLocations = video.fileLocations;
  const [fileLocationPendingTrash, setFileLocationPendingTrash] = useState<
    string | null
  >(null);

  function confirmMoveToTrash() {
    if (!fileLocationPendingTrash) {
      return;
    }

    actions.moveFileLocationToTrash(fileLocationPendingTrash);
    setFileLocationPendingTrash(null);
  }

  return (
    <Box
      component="section"
      aria-label="Video Detail Panel"
      className={styles.panel}
    >
      <Stack gap="md">
        {detailStatusMessage ? <Text>{detailStatusMessage}</Text> : null}
        <TitleEditor
          title={video.title}
          videoId={video.id}
          onSaveTitle={(title) => void actions.saveTitle(title)}
        />
        <VideoPreview
          autoPlay
          catalogVideo={video}
          isLarge
          onOpenAtPreviewTime={(startAtSeconds) =>
            void actions.openVideo(startAtSeconds)
          }
          onFavoriteChange={actions.setFavorite}
        />
        <ActionButtons
          isAvailable={video.isAvailable}
          onOpenVideo={(startAtSeconds) => void actions.openVideo(startAtSeconds)}
          onOpenContainingFolder={() => void actions.openContainingFolder()}
        />

        <MetadataSection
          availableValues={availableTags}
          emptyLabel="No tags"
          onAttach={actions.attachTag}
          onCreateOrAttach={actions.createOrAttachTag}
          onDetach={actions.detachTag}
          selectedValues={tags}
          metadataKind="tag"
          title="Tags"
          videoId={video.id}
        />
        <MetadataSection
          availableValues={availablePerformers}
          emptyLabel="No performers"
          onAttach={actions.attachPerformer}
          onCreateOrAttach={actions.createOrAttachPerformer}
          onDetach={actions.detachPerformer}
          selectedValues={performers}
          metadataKind="performer"
          title="Performers"
          videoId={video.id}
        />

        <FileLocationsSection
          fileLocations={fileLocations}
          onRequestMoveToTrash={setFileLocationPendingTrash}
        />
      </Stack>
      <MoveToTrashConfirmation
        affectedFileLocations={
          fileLocationPendingTrash ? [fileLocationPendingTrash] : []
        }
        isOpen={fileLocationPendingTrash !== null}
        onCancel={() => setFileLocationPendingTrash(null)}
        onConfirm={confirmMoveToTrash}
      />
    </Box>
  );
}
