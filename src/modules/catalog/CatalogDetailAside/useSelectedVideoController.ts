import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { errorMessage } from "../../../shared/errors/errorMessage";
import type {
  CatalogPerformer,
  CatalogTag,
  CatalogVideo,
} from "../../../tauriCommands";

export function useSelectedVideoController({
  loadAvailablePerformers,
  loadAvailableTags,
  loadVideoPerformers,
  loadVideoTags,
  setAvailablePerformers,
  setAvailableTags,
  setCatalogVideoMetadataById,
}: {
  loadAvailablePerformers: () => Promise<CatalogPerformer[]>;
  loadAvailableTags: () => Promise<CatalogTag[]>;
  loadVideoPerformers: (videoId: number) => Promise<CatalogPerformer[]>;
  loadVideoTags: (videoId: number) => Promise<CatalogTag[]>;
  setAvailablePerformers: Dispatch<SetStateAction<CatalogPerformer[]>>;
  setAvailableTags: Dispatch<SetStateAction<CatalogTag[]>>;
  setCatalogVideoMetadataById: Dispatch<
    SetStateAction<
      Record<number, { tags: CatalogTag[]; performers: CatalogPerformer[] }>
    >
  >;
}) {
  const [selectedVideo, setSelectedVideo] = useState<CatalogVideo | null>(null);
  const [selectedVideoTags, setSelectedVideoTags] = useState<CatalogTag[]>([]);
  const [selectedVideoPerformers, setSelectedVideoPerformers] = useState<
    CatalogPerformer[]
  >([]);
  const [detailStatusMessage, setDetailStatusMessage] = useState("");
  const selectedVideoRequestId = useRef(0);
  const selectedVideoId = useRef<number | null>(null);

  async function selectVideoForDetail(catalogVideo: CatalogVideo) {
    const requestId = selectedVideoRequestId.current + 1;
    selectedVideoRequestId.current = requestId;
    selectedVideoId.current = catalogVideo.id;
    setSelectedVideo(catalogVideo);
    setDetailStatusMessage("");

    try {
      const [storedTags, storedPerformers, videoTags, videoPerformers] =
        await Promise.all([
          loadAvailableTags(),
          loadAvailablePerformers(),
          loadVideoTags(catalogVideo.id),
          loadVideoPerformers(catalogVideo.id),
        ]);

      if (selectedVideoRequestId.current === requestId) {
        setAvailableTags(storedTags);
        setAvailablePerformers(storedPerformers);
        setSelectedVideoTags(videoTags);
        setSelectedVideoPerformers(videoPerformers);
        setCatalogVideoMetadataById((currentMetadataById) => ({
          ...currentMetadataById,
          [catalogVideo.id]: {
            tags: videoTags,
            performers: videoPerformers,
          },
        }));
      }
    } catch (error) {
      if (selectedVideoRequestId.current === requestId) {
        setDetailStatusMessage(errorMessage(error));
      }
    }
  }

  function resetSelectedVideo() {
    selectedVideoRequestId.current += 1;
    selectedVideoId.current = null;
    setSelectedVideo(null);
    setSelectedVideoTags([]);
    setSelectedVideoPerformers([]);
    setDetailStatusMessage("");
  }

  return {
    detailStatusMessage,
    selectedVideo,
    selectedVideoId,
    selectedVideoPerformers,
    selectedVideoTags,
    selectVideoForDetail,
    setDetailStatusMessage,
    setSelectedVideo,
    setSelectedVideoPerformers,
    setSelectedVideoTags,
    resetSelectedVideo,
  };
}
