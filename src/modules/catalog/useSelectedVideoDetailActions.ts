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
  openContainingFolder: () => void;
  openVideo: () => void;
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
  onOpenVideo,
  onOpenVideoContainingFolder,
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
  onOpenVideo: (catalogVideo: CatalogVideo) => void;
  onOpenVideoContainingFolder: (catalogVideo: CatalogVideo) => void;
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
    openContainingFolder: () => {
      if (selectedVideo) {
        onOpenVideoContainingFolder(selectedVideo);
      }
    },
    openVideo: () => {
      if (selectedVideo) {
        onOpenVideo(selectedVideo);
      }
    },
    saveTitle: onSaveTitle,
    setFavorite: onSetSelectedFavorite,
  };
}
