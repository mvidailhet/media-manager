import { useRef, useState } from "react";

import {
  appendUniqueMetadata,
  findMetadataByName,
  uniqueMetadataValues,
} from "../../shared/metadata/metadataHelpers";
import { errorMessage } from "../../shared/errors/errorMessage";
import type {
  CatalogPerformer,
  CatalogTag,
  CatalogVideo,
  RejectMetadataSuggestionSourceRequest,
} from "./useCatalogMetadata";
import { useCatalogMetadata } from "./useCatalogMetadata";
import { useCatalogVideos } from "./useCatalogVideos";
import type {
  CatalogMetadataSuggestionAcceptanceRequest,
  CatalogVideoFilters,
  CatalogVideoMetadata,
  CatalogVideoSort,
  CatalogVideoWorkspace,
  CatalogView,
} from "./catalogTypes";
import { defaultCatalogVideoFilters } from "./catalogTypes";
import {
  catalogVideoMatchesFilters,
  sortedCatalogVideos,
} from "./catalogVideoFiltering";
import type { CatalogModuleProps } from "./CatalogModule";

export type { CatalogVideo };

const emptyMetadataInputMessage = "Enter a name first.";

type CatalogModuleController = {
  catalogModuleProps: CatalogModuleProps;
  catalogVideos: CatalogVideo[];
  forgetMissingVideo: (videoId: number) => Promise<void>;
  missingVideos: CatalogVideo[];
  refreshCatalogVideos: () => Promise<void>;
};

function uniqueMetadataNames(metadataNames: string[]) {
  const normalizedNames = new Set<string>();
  const uniqueNames: string[] = [];

  for (const metadataName of metadataNames) {
    const displayName = metadataName.trim();
    const normalizedName = displayName.toLowerCase();

    if (displayName.length === 0 || normalizedNames.has(normalizedName)) {
      continue;
    }

    normalizedNames.add(normalizedName);
    uniqueNames.push(displayName);
  }

  return uniqueNames;
}

export function useCatalogModuleController({
  refreshScanIssues,
  setScanIssuesStatusMessage,
}: {
  refreshScanIssues: (shouldClearStatusMessage?: boolean) => Promise<void>;
  setScanIssuesStatusMessage: (message: string) => void;
}): CatalogModuleController {
  const [selectedVideo, setSelectedVideo] = useState<CatalogVideo | null>(null);
  const [selectedVideoTags, setSelectedVideoTags] = useState<CatalogTag[]>([]);
  const [selectedVideoPerformers, setSelectedVideoPerformers] = useState<
    CatalogPerformer[]
  >([]);
  const [batchSelectedVideoIds, setBatchSelectedVideoIds] = useState<number[]>(
    [],
  );
  const [catalogVideoFilters, setCatalogVideoFilters] =
    useState<CatalogVideoFilters>(defaultCatalogVideoFilters);
  const [catalogVideoSort, setCatalogVideoSort] =
    useState<CatalogVideoSort>("titleAscending");
  const [catalogVideoWorkspace, setCatalogVideoWorkspace] =
    useState<CatalogVideoWorkspace>("videos");
  const [catalogView, setCatalogView] = useState<CatalogView>("allVideos");
  const [detailStatusMessage, setDetailStatusMessage] = useState("");
  const selectedVideoRequestId = useRef(0);
  const selectedVideoId = useRef<number | null>(null);
  const {
    catalogVideoActionStatusMessage,
    catalogVideos,
    catalogVideosStatusMessage,
    forgetMissingVideo,
    openVideo,
    openVideoContainingFolder,
    refreshCatalogVideos,
    renameVideo,
    setCatalogVideoActionStatusMessage,
    setCatalogVideos,
    setVideoFavorited,
  } = useCatalogVideos();
  const {
    acceptSuggestedMetadata,
    attachPerformerToCatalogVideo,
    attachTagToCatalogVideo,
    availablePerformers,
    availableTags,
    catalogVideoMetadataById,
    createNamedPerformer,
    createNamedTag,
    detachPerformerFromCatalogVideo,
    detachTagFromCatalogVideo,
    loadAvailablePerformers,
    loadAvailableTags,
    loadVideoPerformers,
    rejectSuggestedMetadataSource,
    setAvailablePerformers,
    setAvailableTags,
    setCatalogVideoMetadataById,
    loadVideoTags,
  } = useCatalogMetadata({ catalogVideos });

  async function acceptSelectedMetadataSuggestionVideos({
    acceptedMetadataKind,
    acceptedValue,
    additionalTagNames = [],
    scanRootPath,
    suggestedValue,
    sourcePathSegment,
    suggestionKind,
    videoIds,
  }: CatalogMetadataSuggestionAcceptanceRequest) {
    try {
      await acceptSuggestedMetadata({
        acceptedMetadataKind,
        acceptedValue,
        scanRootPath,
        suggestedValue,
        sourcePathSegment,
        suggestionKind,
        videoIds,
      });
      const additionalTags = await metadataTagsForNames(additionalTagNames);
      await Promise.all(
        additionalTags.flatMap((tag) =>
          videoIds.map((videoId) => attachTagToCatalogVideo(tag.id, videoId)),
        ),
      );
      await refreshScanIssues(false);
      const [storedTags, storedPerformers] = await Promise.all([
        loadAvailableTags(),
        loadAvailablePerformers(),
      ]);
      setAvailableTags(storedTags);
      setAvailablePerformers(storedPerformers);
      const metadataEntries = await Promise.all(
        videoIds.map(async (videoId) => {
          const [videoTags, videoPerformers] = await Promise.all([
            loadVideoTags(videoId),
            loadVideoPerformers(videoId),
          ]);

          return [
            videoId,
            { tags: videoTags, performers: videoPerformers },
          ] as const;
        }),
      );
      setCatalogVideoMetadataById((currentMetadataById) => ({
        ...currentMetadataById,
        ...Object.fromEntries(metadataEntries),
      }));

      if (selectedVideo && videoIds.includes(selectedVideo.id)) {
        const selectedVideoMetadata = Object.fromEntries(metadataEntries)[
          selectedVideo.id
        ];
        setSelectedVideoTags(selectedVideoMetadata.tags);
        setSelectedVideoPerformers(selectedVideoMetadata.performers);
      }
    } catch (error) {
      setScanIssuesStatusMessage(errorMessage(error));
    }
  }

  async function metadataTagsForNames(tagNames: string[]) {
    const uniqueTagNames = uniqueMetadataNames(tagNames);
    const tags: CatalogTag[] = [];

    for (const tagName of uniqueTagNames) {
      const existingTag = findMetadataByName([...availableTags, ...tags], tagName);
      const tag = existingTag ?? (await createNamedTag(tagName));

      tags.push(tag);
    }

    return tags;
  }

  async function rejectMetadataSuggestionForSource({
    scanRootPath,
    sourcePathSegment,
    suggestedValue,
    suggestionKind,
  }: {
    scanRootPath: RejectMetadataSuggestionSourceRequest["scanRootPath"];
    sourcePathSegment: RejectMetadataSuggestionSourceRequest["sourcePathSegment"];
    suggestedValue: RejectMetadataSuggestionSourceRequest["suggestedValue"];
    suggestionKind: RejectMetadataSuggestionSourceRequest["suggestionKind"];
  }) {
    try {
      await rejectSuggestedMetadataSource({
        scanRootPath,
        sourcePathSegment,
        suggestedValue,
        suggestionKind,
      });
      await refreshScanIssues(false);
    } catch (error) {
      setScanIssuesStatusMessage(errorMessage(error));
    }
  }

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

  function selectCatalogView(nextCatalogView: CatalogView) {
    if (nextCatalogView === catalogView) {
      return;
    }

    setCatalogView(nextCatalogView);
    if (nextCatalogView === "favorites") {
      setCatalogVideoWorkspace("favorites");
    } else {
      setCatalogVideoWorkspace("videos");
    }
    resetCatalogSelection();
  }

  function resetCatalogSelection() {
    selectedVideoRequestId.current += 1;
    selectedVideoId.current = null;
    setSelectedVideo(null);
    setSelectedVideoTags([]);
    setSelectedVideoPerformers([]);
    setBatchSelectedVideoIds([]);
    setDetailStatusMessage("");
  }

  function reviewMetadataSuggestionVideo(videoId: number) {
    const catalogVideo = catalogVideos.find((video) => video.id === videoId);

    if (catalogVideo) {
      void selectVideoForDetail(catalogVideo);
    }
  }

  async function saveSelectedVideoTitle(title: string) {
    if (!selectedVideo) {
      return;
    }

    try {
      await renameVideo(selectedVideo.id, title);
      const updatedVideo = { ...selectedVideo, title };
      setSelectedVideo(updatedVideo);
      setCatalogVideos((currentVideos) =>
        currentVideos.map((catalogVideo) =>
          catalogVideo.id === updatedVideo.id ? updatedVideo : catalogVideo,
        ),
      );
      setDetailStatusMessage("");
    } catch (error) {
      setDetailStatusMessage(errorMessage(error));
    }
  }

  async function setSelectedVideoFavorite(isFavorite: boolean) {
    if (!selectedVideo) {
      return;
    }

    await setCatalogVideoFavorite(selectedVideo, isFavorite);
  }

  async function setCatalogVideoFavorite(
    video: CatalogVideo,
    isFavorite: boolean,
  ) {
    try {
      await setVideoFavorited(video.id, isFavorite);
      setSelectedVideo((currentSelectedVideo) =>
        currentSelectedVideo?.id === video.id
          ? { ...currentSelectedVideo, isFavorite }
          : currentSelectedVideo,
      );
      setCatalogVideos((currentVideos) =>
        currentVideos.map((catalogVideo) =>
          catalogVideo.id === video.id
            ? { ...catalogVideo, isFavorite }
            : catalogVideo,
        ),
      );
      setDetailStatusMessage("");
      setCatalogVideoActionStatusMessage("");
    } catch (error) {
      setDetailStatusMessage(errorMessage(error));
      setCatalogVideoActionStatusMessage(errorMessage(error));
    }
  }

  async function openVideoFromCatalog(video: CatalogVideo) {
    try {
      await openVideo(video.id);
      await refreshCatalogVideos();
      setCatalogVideoActionStatusMessage("");
    } catch (error) {
      setCatalogVideoActionStatusMessage(errorMessage(error));
    }
  }

  async function openVideoContainingFolderFromCatalog(video: CatalogVideo) {
    try {
      await openVideoContainingFolder(video.id);
      setCatalogVideoActionStatusMessage("");
    } catch (error) {
      setCatalogVideoActionStatusMessage(errorMessage(error));
    }
  }

  function setBatchVideoSelected(videoId: number, isSelected: boolean) {
    setBatchSelectedVideoIds((currentVideoIds) => {
      if (isSelected) {
        return currentVideoIds.includes(videoId)
          ? currentVideoIds
          : [...currentVideoIds, videoId];
      }

      return currentVideoIds.filter(
        (currentVideoId) => currentVideoId !== videoId,
      );
    });
  }

  async function appendTagToBatchSelectedVideos(tag: CatalogTag) {
    try {
      await Promise.all(
        batchSelectedVideoIds.map((videoId) =>
          attachTagToCatalogVideo(tag.id, videoId),
        ),
      );
      batchSelectedVideoIds.forEach((videoId) =>
        addTagToCatalogVideoMetadata(videoId, tag),
      );
      if (selectedVideo && batchSelectedVideoIds.includes(selectedVideo.id)) {
        setSelectedVideoTags((currentTags) =>
          appendUniqueMetadata(currentTags, tag),
        );
      }
      setCatalogVideoActionStatusMessage("");
    } catch (error) {
      setCatalogVideoActionStatusMessage(errorMessage(error));
    }
  }

  async function createOrAppendTagToBatchSelectedVideos(tagName: string) {
    const trimmedTagName = tagName.trim();

    if (trimmedTagName.length === 0) {
      setCatalogVideoActionStatusMessage(emptyMetadataInputMessage);
      return;
    }

    try {
      const existingTag = findMetadataByName(availableTags, trimmedTagName);
      const tag = existingTag ?? (await createNamedTag(trimmedTagName));

      await Promise.all(
        batchSelectedVideoIds.map((videoId) =>
          attachTagToCatalogVideo(tag.id, videoId),
        ),
      );
      setAvailableTags((currentTags) => appendUniqueMetadata(currentTags, tag));
      batchSelectedVideoIds.forEach((videoId) =>
        addTagToCatalogVideoMetadata(videoId, tag),
      );
      if (selectedVideo && batchSelectedVideoIds.includes(selectedVideo.id)) {
        setSelectedVideoTags((currentTags) =>
          appendUniqueMetadata(currentTags, tag),
        );
      }
      setCatalogVideoActionStatusMessage("");
    } catch (error) {
      setCatalogVideoActionStatusMessage(errorMessage(error));
    }
  }

  async function removeTagFromBatchSelectedVideos(tag: CatalogTag) {
    try {
      await Promise.all(
        batchSelectedVideoIds.map((videoId) =>
          detachTagFromCatalogVideo(tag.id, videoId),
        ),
      );
      batchSelectedVideoIds.forEach((videoId) =>
        removeTagFromCatalogVideoMetadata(videoId, tag),
      );
      if (selectedVideo && batchSelectedVideoIds.includes(selectedVideo.id)) {
        setSelectedVideoTags((currentTags) =>
          currentTags.filter((currentTag) => currentTag.id !== tag.id),
        );
      }
      setAvailableTags(await loadAvailableTags());
      setCatalogVideoActionStatusMessage("");
    } catch (error) {
      setCatalogVideoActionStatusMessage(errorMessage(error));
    }
  }

  async function attachTagToSelectedVideo(tag: CatalogTag) {
    if (!selectedVideo) {
      return;
    }

    const videoId = selectedVideo.id;

    try {
      await attachTagToCatalogVideo(tag.id, videoId);
      if (selectedVideoId.current === videoId) {
        setSelectedVideoTags((currentTags) =>
          appendUniqueMetadata(currentTags, tag),
        );
        setDetailStatusMessage("");
      }
      addTagToCatalogVideoMetadata(videoId, tag);
    } catch (error) {
      if (selectedVideoId.current === videoId) {
        setDetailStatusMessage(errorMessage(error));
      }
    }
  }

  async function createOrAttachTagToSelectedVideo(tagName: string) {
    if (!selectedVideo) {
      return;
    }

    const videoId = selectedVideo.id;
    const trimmedTagName = tagName.trim();

    if (trimmedTagName.length === 0) {
      setDetailStatusMessage(emptyMetadataInputMessage);
      return;
    }

    try {
      const existingTag = findMetadataByName(availableTags, trimmedTagName);
      const tag = existingTag ?? (await createNamedTag(trimmedTagName));

      await attachTagToCatalogVideo(tag.id, videoId);
      setAvailableTags((currentTags) => appendUniqueMetadata(currentTags, tag));
      if (selectedVideoId.current === videoId) {
        setSelectedVideoTags((currentTags) =>
          appendUniqueMetadata(currentTags, tag),
        );
        setDetailStatusMessage("");
      }
      addTagToCatalogVideoMetadata(videoId, tag);
    } catch (error) {
      if (selectedVideoId.current === videoId) {
        setDetailStatusMessage(errorMessage(error));
      }
    }
  }

  async function detachTagFromSelectedVideo(tag: CatalogTag) {
    if (!selectedVideo) {
      return;
    }

    const videoId = selectedVideo.id;

    try {
      await detachTagFromCatalogVideo(tag.id, videoId);
      if (selectedVideoId.current === videoId) {
        setSelectedVideoTags((currentTags) =>
          currentTags.filter((currentTag) => currentTag.id !== tag.id),
        );
        setDetailStatusMessage("");
      }
      removeTagFromCatalogVideoMetadata(videoId, tag);
      setAvailableTags(await loadAvailableTags());
    } catch (error) {
      if (selectedVideoId.current === videoId) {
        setDetailStatusMessage(errorMessage(error));
      }
    }
  }

  async function attachPerformerToSelectedVideo(performer: CatalogPerformer) {
    if (!selectedVideo) {
      return;
    }

    const videoId = selectedVideo.id;

    try {
      await attachPerformerToCatalogVideo(performer.id, videoId);
      if (selectedVideoId.current === videoId) {
        setSelectedVideoPerformers((currentPerformers) =>
          appendUniqueMetadata(currentPerformers, performer),
        );
        setDetailStatusMessage("");
      }
      addPerformerToCatalogVideoMetadata(videoId, performer);
    } catch (error) {
      if (selectedVideoId.current === videoId) {
        setDetailStatusMessage(errorMessage(error));
      }
    }
  }

  async function createOrAttachPerformerToSelectedVideo(performerName: string) {
    if (!selectedVideo) {
      return;
    }

    const videoId = selectedVideo.id;
    const trimmedPerformerName = performerName.trim();

    if (trimmedPerformerName.length === 0) {
      setDetailStatusMessage(emptyMetadataInputMessage);
      return;
    }

    try {
      const existingPerformer = findMetadataByName(
        availablePerformers,
        trimmedPerformerName,
      );
      const performer =
        existingPerformer ?? (await createNamedPerformer(trimmedPerformerName));

      await attachPerformerToCatalogVideo(performer.id, videoId);
      setAvailablePerformers((currentPerformers) =>
        appendUniqueMetadata(currentPerformers, performer),
      );
      if (selectedVideoId.current === videoId) {
        setSelectedVideoPerformers((currentPerformers) =>
          appendUniqueMetadata(currentPerformers, performer),
        );
        setDetailStatusMessage("");
      }
      addPerformerToCatalogVideoMetadata(videoId, performer);
    } catch (error) {
      if (selectedVideoId.current === videoId) {
        setDetailStatusMessage(errorMessage(error));
      }
    }
  }

  async function detachPerformerFromSelectedVideo(performer: CatalogPerformer) {
    if (!selectedVideo) {
      return;
    }

    const videoId = selectedVideo.id;

    try {
      await detachPerformerFromCatalogVideo(performer.id, videoId);
      if (selectedVideoId.current === videoId) {
        setSelectedVideoPerformers((currentPerformers) =>
          currentPerformers.filter(
            (currentPerformer) => currentPerformer.id !== performer.id,
          ),
        );
        setDetailStatusMessage("");
      }
      removePerformerFromCatalogVideoMetadata(videoId, performer);
      setAvailablePerformers(await loadAvailablePerformers());
    } catch (error) {
      if (selectedVideoId.current === videoId) {
        setDetailStatusMessage(errorMessage(error));
      }
    }
  }

  async function appendPerformerToBatchSelectedVideos(
    performer: CatalogPerformer,
  ) {
    try {
      await Promise.all(
        batchSelectedVideoIds.map((videoId) =>
          attachPerformerToCatalogVideo(performer.id, videoId),
        ),
      );
      batchSelectedVideoIds.forEach((videoId) =>
        addPerformerToCatalogVideoMetadata(videoId, performer),
      );
      if (selectedVideo && batchSelectedVideoIds.includes(selectedVideo.id)) {
        setSelectedVideoPerformers((currentPerformers) =>
          appendUniqueMetadata(currentPerformers, performer),
        );
      }
      setCatalogVideoActionStatusMessage("");
    } catch (error) {
      setCatalogVideoActionStatusMessage(errorMessage(error));
    }
  }

  async function createOrAppendPerformerToBatchSelectedVideos(
    performerName: string,
  ) {
    const trimmedPerformerName = performerName.trim();

    if (trimmedPerformerName.length === 0) {
      setCatalogVideoActionStatusMessage(emptyMetadataInputMessage);
      return;
    }

    try {
      const existingPerformer = findMetadataByName(
        availablePerformers,
        trimmedPerformerName,
      );
      const performer =
        existingPerformer ?? (await createNamedPerformer(trimmedPerformerName));

      await Promise.all(
        batchSelectedVideoIds.map((videoId) =>
          attachPerformerToCatalogVideo(performer.id, videoId),
        ),
      );
      setAvailablePerformers((currentPerformers) =>
        appendUniqueMetadata(currentPerformers, performer),
      );
      batchSelectedVideoIds.forEach((videoId) =>
        addPerformerToCatalogVideoMetadata(videoId, performer),
      );
      if (selectedVideo && batchSelectedVideoIds.includes(selectedVideo.id)) {
        setSelectedVideoPerformers((currentPerformers) =>
          appendUniqueMetadata(currentPerformers, performer),
        );
      }
      setCatalogVideoActionStatusMessage("");
    } catch (error) {
      setCatalogVideoActionStatusMessage(errorMessage(error));
    }
  }

  async function removePerformerFromBatchSelectedVideos(
    performer: CatalogPerformer,
  ) {
    try {
      await Promise.all(
        batchSelectedVideoIds.map((videoId) =>
          detachPerformerFromCatalogVideo(performer.id, videoId),
        ),
      );
      batchSelectedVideoIds.forEach((videoId) =>
        removePerformerFromCatalogVideoMetadata(videoId, performer),
      );
      if (selectedVideo && batchSelectedVideoIds.includes(selectedVideo.id)) {
        setSelectedVideoPerformers((currentPerformers) =>
          currentPerformers.filter(
            (currentPerformer) => currentPerformer.id !== performer.id,
          ),
        );
      }
      setAvailablePerformers(await loadAvailablePerformers());
      setCatalogVideoActionStatusMessage("");
    } catch (error) {
      setCatalogVideoActionStatusMessage(errorMessage(error));
    }
  }

  async function setBatchSelectedVideosFavorite(isFavorite: boolean) {
    try {
      await Promise.all(
        batchSelectedVideoIds.map((videoId) =>
          setVideoFavorited(videoId, isFavorite),
        ),
      );
      setCatalogVideos((currentVideos) =>
        currentVideos.map((catalogVideo) =>
          batchSelectedVideoIds.includes(catalogVideo.id)
            ? { ...catalogVideo, isFavorite }
            : catalogVideo,
        ),
      );
      setSelectedVideo((currentSelectedVideo) =>
        currentSelectedVideo &&
        batchSelectedVideoIds.includes(currentSelectedVideo.id)
          ? { ...currentSelectedVideo, isFavorite }
          : currentSelectedVideo,
      );
      setCatalogVideoActionStatusMessage("");
      setDetailStatusMessage("");
    } catch (error) {
      setCatalogVideoActionStatusMessage(errorMessage(error));
      setDetailStatusMessage(errorMessage(error));
    }
  }

  function addTagToCatalogVideoMetadata(videoId: number, tag: CatalogTag) {
    setCatalogVideoMetadataById((currentMetadataById) => {
      const currentMetadata = emptyCatalogVideoMetadata(
        currentMetadataById,
        videoId,
      );

      return {
        ...currentMetadataById,
        [videoId]: {
          ...currentMetadata,
          tags: appendUniqueMetadata(currentMetadata.tags, tag),
        },
      };
    });
  }

  function removeTagFromCatalogVideoMetadata(videoId: number, tag: CatalogTag) {
    setCatalogVideoMetadataById((currentMetadataById) => {
      const currentMetadata = emptyCatalogVideoMetadata(
        currentMetadataById,
        videoId,
      );

      return {
        ...currentMetadataById,
        [videoId]: {
          ...currentMetadata,
          tags: currentMetadata.tags.filter(
            (currentTag) => currentTag.id !== tag.id,
          ),
        },
      };
    });
  }

  function addPerformerToCatalogVideoMetadata(
    videoId: number,
    performer: CatalogPerformer,
  ) {
    setCatalogVideoMetadataById((currentMetadataById) => {
      const currentMetadata = emptyCatalogVideoMetadata(
        currentMetadataById,
        videoId,
      );

      return {
        ...currentMetadataById,
        [videoId]: {
          ...currentMetadata,
          performers: appendUniqueMetadata(
            currentMetadata.performers,
            performer,
          ),
        },
      };
    });
  }

  function removePerformerFromCatalogVideoMetadata(
    videoId: number,
    performer: CatalogPerformer,
  ) {
    setCatalogVideoMetadataById((currentMetadataById) => {
      const currentMetadata = emptyCatalogVideoMetadata(
        currentMetadataById,
        videoId,
      );

      return {
        ...currentMetadataById,
        [videoId]: {
          ...currentMetadata,
          performers: currentMetadata.performers.filter(
            (currentPerformer) => currentPerformer.id !== performer.id,
          ),
        },
      };
    });
  }

  const activeCatalogVideoFilters =
    catalogVideoWorkspace === "favorites"
      ? { ...catalogVideoFilters, favoritesOnly: true }
      : catalogVideoFilters;
  const filteredCatalogVideos = sortedCatalogVideos(
    catalogVideos.filter(
      (catalogVideo) =>
        catalogVideoMatchesFilters(
          catalogVideo,
          catalogVideoMetadataById[catalogVideo.id],
          activeCatalogVideoFilters,
        ),
    ),
    catalogVideoSort,
  );
  const batchSelectedVideos = catalogVideos.filter((catalogVideo) =>
    batchSelectedVideoIds.includes(catalogVideo.id),
  );
  const batchSelectedVideoMetadata = batchSelectedVideos.map(
    (catalogVideo) => catalogVideoMetadataById[catalogVideo.id],
  );
  const batchRemovableTags = uniqueMetadataValues(
    batchSelectedVideoMetadata.flatMap((metadata) => metadata?.tags ?? []),
  );
  const batchRemovablePerformers = uniqueMetadataValues(
    batchSelectedVideoMetadata.flatMap(
      (metadata) => metadata?.performers ?? [],
    ),
  );
  const missingVideos = catalogVideos.filter(
    (catalogVideo) => !catalogVideo.isAvailable,
  );

  return {
    catalogModuleProps: {
      availablePerformers,
      availableTags,
      batchRemovablePerformers,
      batchRemovableTags,
      batchSelectedVideoCount: batchSelectedVideos.length,
      catalogVideoActionStatusMessage,
      catalogVideoFilters: activeCatalogVideoFilters,
      catalogVideoMetadataById,
      catalogVideoSort,
      catalogVideos: filteredCatalogVideos,
      catalogVideosStatusMessage,
      catalogView,
      detailStatusMessage,
      metadataSuggestionGroups: [],
      onAcceptMetadataSuggestionVideos: acceptSelectedMetadataSuggestionVideos,
      onAppendPerformer: appendPerformerToBatchSelectedVideos,
      onAppendTag: appendTagToBatchSelectedVideos,
      onAttachPerformer: attachPerformerToSelectedVideo,
      onAttachTag: attachTagToSelectedVideo,
      onCatalogVideoFiltersChange: setCatalogVideoFilters,
      onCatalogVideoSortChange: setCatalogVideoSort,
      onCatalogViewChange: selectCatalogView,
      onCreateOrAppendPerformer: createOrAppendPerformerToBatchSelectedVideos,
      onCreateOrAppendTag: createOrAppendTagToBatchSelectedVideos,
      onCreateOrAttachPerformer: createOrAttachPerformerToSelectedVideo,
      onCreateOrAttachTag: createOrAttachTagToSelectedVideo,
      onDetachPerformer: detachPerformerFromSelectedVideo,
      onDetachTag: detachTagFromSelectedVideo,
      onOpenVideo: openVideoFromCatalog,
      onOpenVideoContainingFolder: openVideoContainingFolderFromCatalog,
      onRejectMetadataSuggestionSource: rejectMetadataSuggestionForSource,
      onRemovePerformer: removePerformerFromBatchSelectedVideos,
      onRemoveTag: removeTagFromBatchSelectedVideos,
      onReviewVideo: reviewMetadataSuggestionVideo,
      onSaveTitle: saveSelectedVideoTitle,
      onSelectVideo: selectVideoForDetail,
      onSetBatchFavorite: setBatchSelectedVideosFavorite,
      onSetBatchVideoSelected: setBatchVideoSelected,
      onSetFavorite: setCatalogVideoFavorite,
      onSetSelectedFavorite: setSelectedVideoFavorite,
      selectedPerformers: selectedVideoPerformers,
      selectedTags: selectedVideoTags,
      selectedVideo,
      selectedVideoIds: batchSelectedVideoIds,
    },
    catalogVideos,
    forgetMissingVideo,
    missingVideos,
    refreshCatalogVideos,
  };
}

function emptyCatalogVideoMetadata(
  metadataById: Record<number, CatalogVideoMetadata>,
  videoId: number,
) {
  return metadataById[videoId] ?? { tags: [], performers: [] };
}
