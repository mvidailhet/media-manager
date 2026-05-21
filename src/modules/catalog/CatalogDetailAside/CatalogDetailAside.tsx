import { AppShell } from "@mantine/core";

import type { CatalogProps } from "../Catalog";
import { useSelectedVideoDetailActions } from "../useSelectedVideoDetailActions";
import { VideoDetailPanel } from "../VideoDetailPanel";
import { AsideWidthToggle } from "./components/AsideWidthToggle";
import styles from "./CatalogDetailAside.module.css";

export function CatalogDetailAside({
  availablePerformers,
  availableTags,
  detailStatusMessage,
  onAttachPerformer,
  onAttachTag,
  onCreateOrAttachPerformer,
  onCreateOrAttachTag,
  onDetachPerformer,
  onDetachTag,
  onOpenVideo,
  onOpenVideoContainingFolder,
  onSaveTitle,
  onSetSelectedFavorite,
  isExpanded,
  onExpandedChange,
  selectedPerformers,
  selectedTags,
  selectedVideo,
}: CatalogProps & {
  isExpanded: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
}) {
  const selectedVideoDetailActions = useSelectedVideoDetailActions({
    onAttachPerformer,
    onAttachTag,
    onCreateOrAttachPerformer,
    onCreateOrAttachTag,
    onDetachPerformer,
    onDetachTag,
    onOpenVideo,
    onOpenVideoContainingFolder,
    onSaveTitle,
    onSetSelectedFavorite,
    selectedVideo,
  });

  if (!selectedVideo) {
    return null;
  }

  return (
    <AppShell.Aside className={styles.aside} p="md">
      <AsideWidthToggle
        isExpanded={isExpanded}
        onToggle={() => onExpandedChange(!isExpanded)}
      />
      <VideoDetailPanel
        actions={selectedVideoDetailActions}
        availablePerformers={availablePerformers}
        availableTags={availableTags}
        detailStatusMessage={detailStatusMessage}
        performers={selectedPerformers}
        tags={selectedTags}
        video={selectedVideo}
      />
    </AppShell.Aside>
  );
}
