import type {
  CatalogPerformer,
  CatalogTag,
  CatalogVideo,
} from "../../tauriCommands";

export type SelectedVideoDetailActions = {
  attachPerformer: (performer: CatalogPerformer) => void;
  attachTag: (tag: CatalogTag) => void;
  createOrAttachPerformer: (performerName: string) => void;
  createOrAttachTag: (tagName: string) => void;
  detachPerformer: (performer: CatalogPerformer) => void;
  detachTag: (tag: CatalogTag) => void;
  moveFileLocationToTrash: (path: string) => void;
  openContainingFolder: () => void;
  openVideo: (startAtSeconds: number) => void;
  playVideoInApp: () => void;
  saveTitle: (title: string) => void;
  setFavorite: (isFavorite: boolean) => void;
};

export function useSelectedVideoDetailActions({
  onAttachPerformer,
  onAttachTag,
  onCreateOrAttachPerformer,
  onCreateOrAttachTag,
  onDetachPerformer,
  onDetachTag,
  onMoveFileLocationToTrash,
  onOpenVideo,
  onOpenVideoContainingFolder,
  onPlayVideoInApp,
  onSaveTitle,
  onSetSelectedFavorite,
  selectedVideo,
}: {
  onAttachPerformer: (performer: CatalogPerformer) => void;
  onAttachTag: (tag: CatalogTag) => void;
  onCreateOrAttachPerformer: (performerName: string) => void;
  onCreateOrAttachTag: (tagName: string) => void;
  onDetachPerformer: (performer: CatalogPerformer) => void;
  onDetachTag: (tag: CatalogTag) => void;
  onMoveFileLocationToTrash: (path: string) => void;
  onOpenVideo: (catalogVideo: CatalogVideo, startAtSeconds: number) => void;
  onOpenVideoContainingFolder: (catalogVideo: CatalogVideo) => void;
  onPlayVideoInApp: (catalogVideo: CatalogVideo) => void;
  onSaveTitle: (title: string) => void;
  onSetSelectedFavorite: (isFavorite: boolean) => void;
  selectedVideo: CatalogVideo | null;
}): SelectedVideoDetailActions {
  return {
    attachPerformer: onAttachPerformer,
    attachTag: onAttachTag,
    createOrAttachPerformer: onCreateOrAttachPerformer,
    createOrAttachTag: onCreateOrAttachTag,
    detachPerformer: onDetachPerformer,
    detachTag: onDetachTag,
    moveFileLocationToTrash: onMoveFileLocationToTrash,
    openContainingFolder: () => {
      if (selectedVideo) {
        onOpenVideoContainingFolder(selectedVideo);
      }
    },
    openVideo: (startAtSeconds: number) => {
      if (selectedVideo) {
        onOpenVideo(selectedVideo, startAtSeconds);
      }
    },
    playVideoInApp: () => {
      if (selectedVideo) {
        onPlayVideoInApp(selectedVideo);
      }
    },
    saveTitle: onSaveTitle,
    setFavorite: onSetSelectedFavorite,
  };
}
