import { useEffect, useRef, useState } from "react";

import {
  appendUniqueMetadata,
  findMetadataByName,
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
  CatalogVideoMetadata,
  CatalogView,
} from "./catalogTypes";
import type { CatalogProps } from "./Catalog";
import type { BatchTrashTarget } from "./SelectionPanel/batchTrashTypes";
import { useBatchMetadataController } from "./SelectionPanel/useBatchMetadataController";
import { useSelectedVideoController } from "./SelectionPanel/useSelectedVideoController";
import { useMetadataSuggestionsController } from "./MetadataSuggestionsPanel/useMetadataSuggestionsController";
import { useVideosPanelController } from "./VideosPanel/useVideosPanelController";

export type { CatalogVideo };

const emptyMetadataInputMessage = "Enter a name first.";
const moveToTrashDetailFailurePrefix =
  "Could not move this File Location to Trash";
const moveToTrashBatchResultPrefix = "Move to Trash finished";

type CatalogController = {
  catalogProps: CatalogProps;
  catalogVideos: CatalogVideo[];
  forgetMissingVideo: (videoId: number) => Promise<void>;
  missingVideos: CatalogVideo[];
  recordPerformerSecretStatusChange: (performer: CatalogPerformer) => void;
  recordTagSecretStatusChange: (tag: CatalogTag) => void;
  refreshCatalogVideos: () => Promise<CatalogVideo[]>;
  refreshMetadataSuggestionGroups: () => Promise<void>;
};

export type VideoSelectionModifiers = {
  isCommandPressed: boolean;
  isShiftPressed: boolean;
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

function preferredFileLocationTrashTargets(
  catalogVideos: CatalogVideo[],
): BatchTrashTarget[] {
  return catalogVideos.flatMap((catalogVideo) => {
    const preferredFileLocation = catalogVideo.fileLocations.find(
      (fileLocation) => fileLocation.isPreferred && fileLocation.isReachable,
    );

    if (!preferredFileLocation) {
      return [];
    }

    return [
      {
        path: preferredFileLocation.path,
        videoId: catalogVideo.id,
      },
    ];
  });
}

function skippedBatchTrashPaths(catalogVideos: CatalogVideo[]) {
  return catalogVideos
    .filter((catalogVideo) => {
      return !catalogVideo.fileLocations.some(
        (fileLocation) => fileLocation.isPreferred && fileLocation.isReachable,
      );
    })
    .flatMap((catalogVideo) =>
      catalogVideo.fileLocations
        .filter((fileLocation) => fileLocation.isPreferred)
        .map((fileLocation) => fileLocation.path),
    );
}

function moveToTrashFailureMessage(prefix: string, path: string, error: unknown) {
  return `${prefix}: ${path} (${errorMessage(error)}).`;
}

function pluralizedCount(count: number, singular: string, plural: string) {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}

function joinedPathSummary(label: string, paths: string[]) {
  if (paths.length === 0) {
    return "";
  }

  return `${label}: ${paths.join(", ")}.`;
}

function failedPathSummary(
  failedTrashResults: { path: string; reason: unknown }[],
) {
  if (failedTrashResults.length === 0) {
    return "";
  }

  const failedPaths = failedTrashResults.map(
    (failedTrashResult) =>
      `${failedTrashResult.path} (${errorMessage(failedTrashResult.reason)})`,
  );

  return `Failed: ${failedPaths.join(", ")}.`;
}

function batchMoveToTrashResultMessage({
  failedTrashResults,
  movedPaths,
  skippedPaths,
}: {
  failedTrashResults: { path: string; reason: unknown }[];
  movedPaths: string[];
  skippedPaths: string[];
}) {
  const resultCounts = [
    pluralizedCount(movedPaths.length, "moved", "moved"),
    pluralizedCount(skippedPaths.length, "skipped", "skipped"),
    pluralizedCount(failedTrashResults.length, "failed", "failed"),
  ].join(", ");
  const resultDetails = [
    joinedPathSummary("Moved", movedPaths),
    joinedPathSummary("Skipped", skippedPaths),
    failedPathSummary(failedTrashResults),
  ]
    .filter(Boolean)
    .join(" ");

  return `${moveToTrashBatchResultPrefix}: ${resultCounts}. ${resultDetails}`;
}

function tagRemainsOnUnselectedVideo({
  catalogVideoMetadataById,
  selectedVideoIds,
  tag,
}: {
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata | undefined>;
  selectedVideoIds: number[];
  tag: CatalogTag;
}) {
  return Object.entries(catalogVideoMetadataById).some(
    ([videoId, metadata]) =>
      !selectedVideoIds.includes(Number(videoId)) &&
      (metadata?.tags.some((currentTag) => currentTag.id === tag.id) ?? false),
  );
}

function performerRemainsOnUnselectedVideo({
  catalogVideoMetadataById,
  performer,
  selectedVideoIds,
}: {
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata | undefined>;
  performer: CatalogPerformer;
  selectedVideoIds: number[];
}) {
  return Object.entries(catalogVideoMetadataById).some(
    ([videoId, metadata]) =>
      !selectedVideoIds.includes(Number(videoId)) &&
      (metadata?.performers.some(
        (currentPerformer) => currentPerformer.id === performer.id,
      ) ??
        false),
  );
}

export function useCatalogModuleController(): CatalogController {
  const [catalogView, setCatalogView] = useState<CatalogView>("videos");
  const {
    catalogVideoActionStatusMessage,
    catalogVideos,
    catalogVideosStatusMessage,
    forgetMissingVideo,
    moveVideoFileLocationToTrash,
    openVideo,
    openVideoContainingFolder,
    playVideoInApp,
    refreshCatalogVideos: loadCatalogVideos,
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
  const {
    catalogVideoFilters,
    catalogVideoSort,
    matchingCatalogVideos,
    setCatalogVideoFilters,
    setCatalogVideoSort,
  } = useVideosPanelController({
    availablePerformers,
    availableTags,
    catalogVideoMetadataById,
    catalogVideos,
  });
  const {
    batchRemovablePerformers,
    batchRemovableTags,
    batchSelectedVideoIds,
    batchSelectedVideos,
    resetBatchSelection,
    setBatchSelectedVideoIds,
    setBatchVideoSelected,
  } = useBatchMetadataController({
    catalogVideoMetadataById,
    catalogVideos,
  });
  const {
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
  } = useSelectedVideoController({
    loadAvailablePerformers,
    loadAvailableTags,
    loadVideoPerformers,
    loadVideoTags,
    setAvailablePerformers,
    setAvailableTags,
    setCatalogVideoMetadataById,
  });
  const {
    metadataSuggestionGroups,
    refreshMetadataSuggestionGroups,
  } = useMetadataSuggestionsController();
  const [selectionAnchorVideoId, setSelectionAnchorVideoId] = useState<
    number | null
  >(null);
  const latestBatchSelectedVideoIds = useRef(batchSelectedVideoIds);
  const latestSelectedVideo = useRef(selectedVideo);
  const latestSelectionAnchorVideoId = useRef(selectionAnchorVideoId);

  useEffect(() => {
    latestBatchSelectedVideoIds.current = batchSelectedVideoIds;
  }, [batchSelectedVideoIds]);

  useEffect(() => {
    latestSelectedVideo.current = selectedVideo;
  }, [selectedVideo]);

  useEffect(() => {
    latestSelectionAnchorVideoId.current = selectionAnchorVideoId;
  }, [selectionAnchorVideoId]);

  useEffect(() => {
    if (catalogView !== "metadataSuggestions") {
      return;
    }

    if (metadataSuggestionGroups.length > 0) {
      return;
    }

    setCatalogView("videos");
    resetCatalogSelection();
  }, [catalogView, metadataSuggestionGroups.length]);

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
      await refreshMetadataSuggestionGroups();
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
      setDetailStatusMessage(errorMessage(error));
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
      await refreshMetadataSuggestionGroups();
    } catch (error) {
      setDetailStatusMessage(errorMessage(error));
    }
  }

  function selectCatalogView(nextCatalogView: CatalogView) {
    if (nextCatalogView === catalogView) {
      return;
    }

    setCatalogView(nextCatalogView);
    resetCatalogSelection();
  }

  function resetCatalogSelection() {
    setSelectionAnchorVideoId(null);
    resetSelectedVideo();
    resetBatchSelection();
  }

  async function refreshCatalogVideos() {
    const refreshedVideos = await loadCatalogVideos();

    preserveCatalogSelection(refreshedVideos);

    return refreshedVideos;
  }

  function preserveCatalogSelection(refreshedVideos: CatalogVideo[]) {
    const selectedVideoIds = latestSelectedVideoIds();

    if (selectedVideoIds.length === 0) {
      return;
    }

    const refreshedVideosById = new Map(
      refreshedVideos.map((catalogVideo) => [catalogVideo.id, catalogVideo]),
    );
    const survivingSelectedVideos = selectedVideoIds.flatMap((videoId) => {
      const refreshedVideo = refreshedVideosById.get(videoId);

      return refreshedVideo ? [refreshedVideo] : [];
    });

    if (survivingSelectedVideos.length === 0) {
      resetCatalogSelection();
      return;
    }

    if (survivingSelectedVideos.length === 1) {
      selectVideoForDetailOnly(survivingSelectedVideos[0]);
      return;
    }

    setSelectedVideo((currentSelectedVideo) => {
      if (!currentSelectedVideo) {
        return currentSelectedVideo;
      }

      return refreshedVideosById.get(currentSelectedVideo.id) ?? null;
    });
    setBatchSelectedVideoIds(
      survivingSelectedVideos.map((catalogVideo) => catalogVideo.id),
    );
    setSelectionAnchorVideoId(() => {
      const currentAnchorVideoId = latestSelectionAnchorVideoId.current;

      if (
        currentAnchorVideoId !== null &&
        refreshedVideosById.has(currentAnchorVideoId)
      ) {
        return currentAnchorVideoId;
      }

      return survivingSelectedVideos[survivingSelectedVideos.length - 1].id;
    });
  }

  function clearCatalogSelection() {
    resetCatalogSelection();
  }

  function selectVideoForDetailOnly(catalogVideo: CatalogVideo) {
    resetBatchSelection();
    setSelectionAnchorVideoId(catalogVideo.id);
    void selectVideoForDetail(catalogVideo);
  }

  function selectVideosForBatchOnly(videoIds: number[], anchorVideoId: number) {
    resetSelectedVideo();
    setBatchSelectedVideoIds(videoIds);
    setSelectionAnchorVideoId(anchorVideoId);
  }

  function resolveVideoSelection(videoIds: number[], anchorVideoId: number) {
    const uniqueVideoIds = Array.from(new Set(videoIds));

    if (uniqueVideoIds.length === 0) {
      resetCatalogSelection();
      return;
    }

    const singleSelectedVideo = catalogVideos.find(
      (catalogVideo) => catalogVideo.id === uniqueVideoIds[0],
    );

    if (uniqueVideoIds.length === 1 && singleSelectedVideo) {
      selectVideoForDetailOnly(singleSelectedVideo);
      return;
    }

    selectVideosForBatchOnly(uniqueVideoIds, anchorVideoId);
  }

  function selectVideoFromVideosView(
    catalogVideo: CatalogVideo,
    modifiers: VideoSelectionModifiers,
  ) {
    if (modifiers.isShiftPressed) {
      const rangeVideoIds = videoSelectionRange(catalogVideo.id);
      const nextVideoIds = modifiers.isCommandPressed
        ? [...currentSelectedVideoIds(), ...rangeVideoIds]
        : rangeVideoIds;

      resolveVideoSelection(nextVideoIds, catalogVideo.id);
      return;
    }

    if (modifiers.isCommandPressed) {
      toggleVideoFromVideosView(catalogVideo);
      return;
    }

    selectVideoForDetailOnly(catalogVideo);
  }

  function toggleVideoFromVideosView(catalogVideo: CatalogVideo) {
    const currentVideoIds = currentSelectedVideoIds();
    const isAlreadySelected = currentVideoIds.includes(catalogVideo.id);
    const nextVideoIds = isAlreadySelected
      ? currentVideoIds.filter((videoId) => videoId !== catalogVideo.id)
      : [...currentVideoIds, catalogVideo.id];

    resolveVideoSelection(nextVideoIds, catalogVideo.id);
  }

  function replaceSelectedVideosFromDrag(
    videoIds: number[],
    modifiers: VideoSelectionModifiers,
  ) {
    const nextVideoIds = modifiers.isCommandPressed
      ? toggledVideoIds(currentSelectedVideoIds(), videoIds)
      : videoIds;
    const anchorVideoId =
      nextVideoIds[nextVideoIds.length - 1] ?? selectionAnchorVideoId;

    if (anchorVideoId === null) {
      resetCatalogSelection();
      return;
    }

    resolveVideoSelection(nextVideoIds, anchorVideoId);
  }

  function toggledVideoIds(currentVideoIds: number[], touchedVideoIds: number[]) {
    const touchedVideoIdSet = new Set(touchedVideoIds);
    const remainingVideoIds = currentVideoIds.filter(
      (videoId) => !touchedVideoIdSet.has(videoId),
    );
    const addedVideoIds = touchedVideoIds.filter(
      (videoId) => !currentVideoIds.includes(videoId),
    );

    return [...remainingVideoIds, ...addedVideoIds];
  }

  function currentSelectedVideoIds() {
    if (batchSelectedVideoIds.length > 0) {
      return batchSelectedVideoIds;
    }

    return selectedVideo ? [selectedVideo.id] : [];
  }

  function latestSelectedVideoIds() {
    if (latestBatchSelectedVideoIds.current.length > 0) {
      return latestBatchSelectedVideoIds.current;
    }

    return latestSelectedVideo.current ? [latestSelectedVideo.current.id] : [];
  }

  function videoSelectionRange(targetVideoId: number) {
    const visibleVideoIds = matchingCatalogVideos.map(
      (catalogVideo) => catalogVideo.id,
    );
    const fallbackAnchorVideoId =
      selectionAnchorVideoId ?? selectedVideo?.id ?? targetVideoId;
    const anchorIndex = visibleVideoIds.indexOf(fallbackAnchorVideoId);
    const targetIndex = visibleVideoIds.indexOf(targetVideoId);

    if (anchorIndex === -1 || targetIndex === -1) {
      return [targetVideoId];
    }

    const rangeStartIndex = Math.min(anchorIndex, targetIndex);
    const rangeEndIndex = Math.max(anchorIndex, targetIndex);

    return visibleVideoIds.slice(rangeStartIndex, rangeEndIndex + 1);
  }

  function changeCatalogVideoFilters(filters: typeof catalogVideoFilters) {
    setCatalogVideoFilters(filters);
  }

  function removeTagFromCatalogVideoFilters(tag: CatalogTag) {
    setCatalogVideoFilters((currentFilters) => ({
      ...currentFilters,
      selectedTagIds: currentFilters.selectedTagIds.filter(
        (selectedTagId) => selectedTagId !== tag.id,
      ),
    }));
  }

  function removePerformerFromCatalogVideoFilters(performer: CatalogPerformer) {
    setCatalogVideoFilters((currentFilters) => ({
      ...currentFilters,
      selectedPerformerIds: currentFilters.selectedPerformerIds.filter(
        (selectedPerformerId) => selectedPerformerId !== performer.id,
      ),
    }));
  }

  function changeCatalogVideoSort(sort: typeof catalogVideoSort) {
    setCatalogVideoSort(sort);
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

  async function openVideoFromCatalog(video: CatalogVideo, startAtSeconds: number) {
    try {
      await openVideo(video.id, startAtSeconds);
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

  async function playVideoInAppFromCatalog(video: CatalogVideo) {
    try {
      await playVideoInApp(video.id);
      setCatalogVideoActionStatusMessage("");
    } catch (error) {
      setCatalogVideoActionStatusMessage(errorMessage(error));
    }
  }

  async function moveSelectedVideoFileLocationToTrash(path: string) {
    if (!selectedVideo) {
      return;
    }

    const videoId = selectedVideo.id;

    try {
      await moveVideoFileLocationToTrash(videoId, path);
      const refreshedVideos = await refreshCatalogVideos();
      const refreshedSelectedVideo = refreshedVideos.find(
        (catalogVideo) => catalogVideo.id === videoId,
      );

      if (refreshedSelectedVideo) {
        setSelectedVideo(refreshedSelectedVideo);
      } else {
        resetSelectedVideo();
      }

      setDetailStatusMessage("");
      setCatalogVideoActionStatusMessage("");
    } catch (error) {
      const trashFailureMessage = moveToTrashFailureMessage(
        moveToTrashDetailFailurePrefix,
        path,
        error,
      );

      setDetailStatusMessage(trashFailureMessage);
      setCatalogVideoActionStatusMessage(trashFailureMessage);
    }
  }

  async function moveBatchPreferredFileLocationsToTrash() {
    const trashTargets = batchPreferredFileLocationTrashTargets;
    const skippedPaths = skippedBatchTrashPaths(batchSelectedVideos);

    try {
      const trashResults = await Promise.allSettled(
        trashTargets.map((target) =>
          moveVideoFileLocationToTrash(target.videoId, target.path),
        ),
      );
      const movedPaths = trashTargets.flatMap((target, targetIndex) => {
        const trashResult = trashResults[targetIndex];

        return trashResult?.status === "fulfilled" ? [target.path] : [];
      });
      const failedTrashResults = trashTargets.flatMap((target, targetIndex) => {
        const trashResult = trashResults[targetIndex];

        if (trashResult?.status !== "rejected") {
          return [];
        }

        return [
          {
            path: target.path,
            reason: trashResult.reason,
          },
        ];
      });

      await refreshCatalogVideos();
      resetCatalogSelection();

      const trashResultMessage = batchMoveToTrashResultMessage({
        failedTrashResults,
        movedPaths,
        skippedPaths,
      });

      setCatalogVideoActionStatusMessage(trashResultMessage);
      setDetailStatusMessage(trashResultMessage);
    } catch (error) {
      setCatalogVideoActionStatusMessage(errorMessage(error));
      setDetailStatusMessage(errorMessage(error));
    }
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
      const removedTagFromEveryKnownVideo = !tagRemainsOnUnselectedVideo({
        catalogVideoMetadataById,
        selectedVideoIds: batchSelectedVideoIds,
        tag,
      });
      batchSelectedVideoIds.forEach((videoId) =>
        removeTagFromCatalogVideoMetadata(videoId, tag),
      );
      if (selectedVideo && batchSelectedVideoIds.includes(selectedVideo.id)) {
        setSelectedVideoTags((currentTags) =>
          currentTags.filter((currentTag) => currentTag.id !== tag.id),
        );
      }
      removeTagFromCatalogVideoFilters(tag);
      const storedTags = await loadAvailableTags();
      setAvailableTags(
        removedTagFromEveryKnownVideo
          ? storedTags.filter((storedTag) => storedTag.id !== tag.id)
          : storedTags,
      );
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
      removeTagFromCatalogVideoFilters(tag);
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
      removePerformerFromCatalogVideoFilters(performer);
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
      const removedPerformerFromEveryKnownVideo =
        !performerRemainsOnUnselectedVideo({
          catalogVideoMetadataById,
          performer,
          selectedVideoIds: batchSelectedVideoIds,
        });
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
      removePerformerFromCatalogVideoFilters(performer);
      const storedPerformers = await loadAvailablePerformers();
      setAvailablePerformers(
        removedPerformerFromEveryKnownVideo
          ? storedPerformers.filter(
              (storedPerformer) => storedPerformer.id !== performer.id,
            )
          : storedPerformers,
      );
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

  function recordTagSecretStatusChange(tag: CatalogTag) {
    setAvailableTags((currentTags) =>
      currentTags.map((currentTag) =>
        currentTag.id === tag.id ? tag : currentTag,
      ),
    );
    setCatalogVideoMetadataById((currentMetadataById) =>
      Object.fromEntries(
        Object.entries(currentMetadataById).map(([videoId, metadata]) => [
          videoId,
          {
            ...metadata,
            tags: metadata.tags.map((currentTag) =>
              currentTag.id === tag.id ? tag : currentTag,
            ),
          },
        ]),
      ),
    );
  }

  function recordPerformerSecretStatusChange(performer: CatalogPerformer) {
    setAvailablePerformers((currentPerformers) =>
      currentPerformers.map((currentPerformer) =>
        currentPerformer.id === performer.id ? performer : currentPerformer,
      ),
    );
    setCatalogVideoMetadataById((currentMetadataById) =>
      Object.fromEntries(
        Object.entries(currentMetadataById).map(([videoId, metadata]) => [
          videoId,
          {
            ...metadata,
            performers: metadata.performers.map((currentPerformer) =>
              currentPerformer.id === performer.id ? performer : currentPerformer,
            ),
          },
        ]),
      ),
    );
  }

  const missingVideos = catalogVideos.filter(
    (catalogVideo) => catalogVideo.fileLocations.length === 0,
  );
  const batchSelectedVideosAllFavorite =
    batchSelectedVideos.length > 0 &&
    batchSelectedVideos.every((catalogVideo) => catalogVideo.isFavorite);
  const batchPreferredFileLocationTrashTargets =
    preferredFileLocationTrashTargets(batchSelectedVideos);

  return {
    catalogProps: {
      availablePerformers,
      availableTags,
      batchRemovablePerformers,
      batchRemovableTags,
      batchSelectedVideosAllFavorite,
      batchSelectedVideoCount: batchSelectedVideos.length,
      batchTrashTargets: batchPreferredFileLocationTrashTargets,
      allCatalogVideos: catalogVideos,
      catalogVideoActionStatusMessage,
      catalogVideoFilters,
      catalogVideoMetadataById,
      catalogVideoSort,
      catalogVideos: matchingCatalogVideos,
      catalogVideosStatusMessage,
      catalogView,
      detailStatusMessage,
      metadataSuggestionGroups,
      onAcceptMetadataSuggestionVideos: acceptSelectedMetadataSuggestionVideos,
      onAppendPerformer: appendPerformerToBatchSelectedVideos,
      onAppendTag: appendTagToBatchSelectedVideos,
      onAttachPerformer: attachPerformerToSelectedVideo,
      onAttachTag: attachTagToSelectedVideo,
      onCatalogVideoFiltersChange: changeCatalogVideoFilters,
      onCatalogVideoSortChange: changeCatalogVideoSort,
      onCatalogViewChange: selectCatalogView,
      onCreateOrAppendPerformer: createOrAppendPerformerToBatchSelectedVideos,
      onCreateOrAppendTag: createOrAppendTagToBatchSelectedVideos,
      onCreateOrAttachPerformer: createOrAttachPerformerToSelectedVideo,
      onCreateOrAttachTag: createOrAttachTagToSelectedVideo,
      onDetachPerformer: detachPerformerFromSelectedVideo,
      onDetachTag: detachTagFromSelectedVideo,
      onOpenVideo: openVideoFromCatalog,
      onOpenVideoContainingFolder: openVideoContainingFolderFromCatalog,
      onPlayVideoInApp: playVideoInAppFromCatalog,
      onMoveSelectedVideoFileLocationToTrash:
        moveSelectedVideoFileLocationToTrash,
      onMoveBatchPreferredFileLocationsToTrash:
        moveBatchPreferredFileLocationsToTrash,
      onRejectMetadataSuggestionSource: rejectMetadataSuggestionForSource,
      onRemovePerformer: removePerformerFromBatchSelectedVideos,
      onRemoveTag: removeTagFromBatchSelectedVideos,
      onReviewVideo: reviewMetadataSuggestionVideo,
      onSaveTitle: saveSelectedVideoTitle,
      onClearVideoSelection: clearCatalogSelection,
      onReplaceSelectedVideos: replaceSelectedVideosFromDrag,
      onSelectVideo: selectVideoFromVideosView,
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
    recordPerformerSecretStatusChange,
    recordTagSecretStatusChange,
    refreshCatalogVideos,
    refreshMetadataSuggestionGroups,
  };
}

function emptyCatalogVideoMetadata(
  metadataById: Record<number, CatalogVideoMetadata>,
  videoId: number,
) {
  return metadataById[videoId] ?? { tags: [], performers: [] };
}
