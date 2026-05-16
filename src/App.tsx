import { useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Code,
  Group,
  Paper,
  Stack,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import type {
  AcceptMetadataSuggestionForVideosRequest,
  CatalogPerformer,
  CatalogTag,
  CatalogVideo,
  RejectMetadataSuggestionSourceRequest,
} from "./modules/catalog/useCatalogMetadata";
import { useCatalogMetadata } from "./modules/catalog/useCatalogMetadata";
import { useCatalogVideos } from "./modules/catalog/useCatalogVideos";
import { WorkspaceHeader } from "./modules/catalog/WorkspaceHeader";
import { BatchMetadataEditPanel } from "./modules/catalog/BatchMetadataEditPanel";
import { CatalogVideosPanel } from "./modules/catalog/CatalogVideosPanel";
import { VideoDetailPanel } from "./modules/catalog/VideoDetailPanel";
import type {
  CatalogVideoFilters,
  CatalogView,
  CatalogVideoMetadata,
  CatalogVideoSort,
  CatalogVideoWorkspace,
} from "./modules/catalog/catalogTypes";
import { defaultCatalogVideoFilters } from "./modules/catalog/catalogTypes";
import {
  catalogVideoMatchesFilters,
  sortedCatalogVideos,
  workspaceCatalogVideos,
} from "./modules/catalog/catalogVideoFiltering";
import { MetadataSuggestionsPanel } from "./modules/catalog/MetadataSuggestionsPanel";
import { ReviewQueuePanel } from "./modules/scan/ScanIssuesPanel";
import { ScanRootsPanel } from "./modules/scan/ScanRootsPanel";
import { PreviewGenerationView } from "./modules/scan/PreviewGenerationView";
import {
  FfmpegStatusPanel,
  TauriStatusPanel,
} from "./modules/settings/SettingsStatusPanels";
import {
  commandErrorMessage,
  ffmpegErrorMessage,
  useSettingsStatus,
} from "./modules/settings/useSettingsStatus";
import { usePreviewGeneration } from "./modules/scan/usePreviewGeneration";
import { useReviewQueue } from "./modules/scan/useReviewQueue";
import type { ScanRoot, ScanRootRemovalPolicy } from "./modules/scan/useScanRoots";
import { useScanRoots } from "./modules/scan/useScanRoots";
import {
  appendUniqueMetadata,
  findMetadataByName,
  uniqueMetadataValues,
} from "./shared/metadata/metadataHelpers";
import { errorMessage } from "./shared/errors/errorMessage";

const scanRootsTab = "scanRoots";
const scanIssuesTab = "scanIssues";
const previewGenerationTab = "previewGeneration";

const emptyMetadataInputMessage = "Enter a name first.";
type AppModule = "catalog" | "scan" | "settings";

export default function App() {
  const [activeAppModule, setActiveAppModule] = useState<AppModule>("catalog");
  const [scanRootPendingRemoval, setScanRootPendingRemoval] =
    useState<ScanRoot | null>(null);
  const [missingVideoPendingForget, setMissingVideoPendingForget] =
    useState<CatalogVideo | null>(null);
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
  const [scanTab, setScanTab] = useState<string | null>(scanRootsTab);
  const [detailStatusMessage, setDetailStatusMessage] = useState("");
  const selectedVideoRequestId = useRef(0);
  const {
    catalogVideoActionStatusMessage,
    catalogVideos,
    catalogVideosStatusMessage,
    forgetMissingVideo,
    openVideo,
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
  const previewGeneration = usePreviewGeneration({
    refreshCatalogVideos,
    refreshReviewQueue: async () => reviewQueue.refreshReviewQueue(false),
  });
  const reviewQueue = useReviewQueue({
    refreshCatalogVideos,
    refreshPreviewStripQueueStatus:
      previewGeneration.refreshPreviewStripQueueStatus,
    setPreviewStripQueueStatus: previewGeneration.setPreviewStripQueueStatus,
  });
  const scanRootsState = useScanRoots({
    refreshCatalogVideos,
    refreshPreviewStripQueueStatus:
      previewGeneration.refreshPreviewStripQueueStatus,
    refreshReviewQueue: async () => reviewQueue.refreshReviewQueue(false),
  });
  const settingsStatus = useSettingsStatus({
    refreshReviewQueue: async () => reviewQueue.refreshReviewQueue(false),
  });
  const {
    pausePreviewQueue,
    previewStripQueueStatus,
    previewStripStatusMessage,
    resumePreviewQueue,
  } = previewGeneration;
  const {
    failedPreviewStrips,
    ignoreFailedPreview,
    metadataSuggestionGroups,
    refreshReviewQueue,
    retryFailedPreview,
    reviewQueueStatusMessage,
    setReviewQueueStatusMessage,
    unprocessableVideoCandidates,
  } = reviewQueue;
  const {
    addManualScanRoot,
    chooseScanRootFolder,
    manualScanRootPath,
    refreshEveryScanRoot,
    refreshSelectedScanRoot,
    removeSelectedScanRoot,
    saveScanRootInferenceRules,
    scanRoots,
    scanRootsStatusMessage,
    setManualScanRootPath,
  } = scanRootsState;
  const {
    ffmpegPath,
    ffmpegStatusMessage,
    ffmpegToolsStatus,
    ffprobePath,
    localDesktopAppStatus,
    saveConfiguredFfmpegPaths,
    setFfmpegPath,
    setFfprobePath,
  } = settingsStatus;

  async function acceptSelectedMetadataSuggestionVideos({
    acceptedMetadataKind,
    acceptedValue,
    scanRootPath,
    suggestedValue,
    sourcePathSegment,
    suggestionKind,
    videoIds,
  }: AcceptMetadataSuggestionForVideosRequest) {
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
      await refreshReviewQueue(false);
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

          return [videoId, { tags: videoTags, performers: videoPerformers }] as const;
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
      setReviewQueueStatusMessage(errorMessage(error));
    }
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
      await refreshReviewQueue(false);
    } catch (error) {
      setReviewQueueStatusMessage(errorMessage(error));
    }
  }

  async function confirmScanRootRemoval(removalPolicy: ScanRootRemovalPolicy) {
    if (!scanRootPendingRemoval) {
      return;
    }

    const removedScanRoot = scanRootPendingRemoval;

    const wasRemoved = await removeSelectedScanRoot(
      removedScanRoot,
      removalPolicy,
    );

    if (wasRemoved) {
      setScanRootPendingRemoval(null);
    }
  }

  async function confirmMissingVideoForget() {
    if (!missingVideoPendingForget) {
      return;
    }

    try {
      await forgetMissingVideo(missingVideoPendingForget.id);
      setMissingVideoPendingForget(null);
      setReviewQueueStatusMessage("");
      await refreshCatalogVideos();
    } catch (error) {
      setReviewQueueStatusMessage(errorMessage(error));
    }
  }

  async function selectVideoForDetail(catalogVideo: CatalogVideo) {
    const requestId = selectedVideoRequestId.current + 1;
    selectedVideoRequestId.current = requestId;
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
    } else if (nextCatalogView === "recentlyOpened") {
      setCatalogVideoWorkspace("recentlyOpened");
    } else {
      setCatalogVideoWorkspace("videos");
    }
    resetCatalogSelection();
  }

  function resetCatalogSelection() {
    selectedVideoRequestId.current += 1;
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

    try {
      await attachTagToCatalogVideo(tag.id, selectedVideo.id);
      setSelectedVideoTags((currentTags) =>
        appendUniqueMetadata(currentTags, tag),
      );
      addTagToCatalogVideoMetadata(selectedVideo.id, tag);
      setDetailStatusMessage("");
    } catch (error) {
      setDetailStatusMessage(errorMessage(error));
    }
  }

  async function createOrAttachTagToSelectedVideo(tagName: string) {
    if (!selectedVideo) {
      return;
    }

    const trimmedTagName = tagName.trim();

    if (trimmedTagName.length === 0) {
      setDetailStatusMessage(emptyMetadataInputMessage);
      return;
    }

    try {
      const existingTag = findMetadataByName(availableTags, trimmedTagName);
      const tag = existingTag ?? (await createNamedTag(trimmedTagName));

      await attachTagToCatalogVideo(tag.id, selectedVideo.id);
      setAvailableTags((currentTags) => appendUniqueMetadata(currentTags, tag));
      setSelectedVideoTags((currentTags) =>
        appendUniqueMetadata(currentTags, tag),
      );
      addTagToCatalogVideoMetadata(selectedVideo.id, tag);
      setDetailStatusMessage("");
    } catch (error) {
      setDetailStatusMessage(errorMessage(error));
    }
  }

  async function detachTagFromSelectedVideo(tag: CatalogTag) {
    if (!selectedVideo) {
      return;
    }

    try {
      await detachTagFromCatalogVideo(tag.id, selectedVideo.id);
      setSelectedVideoTags((currentTags) =>
        currentTags.filter((currentTag) => currentTag.id !== tag.id),
      );
      removeTagFromCatalogVideoMetadata(selectedVideo.id, tag);
      setAvailableTags(await loadAvailableTags());
      setDetailStatusMessage("");
    } catch (error) {
      setDetailStatusMessage(errorMessage(error));
    }
  }

  async function attachPerformerToSelectedVideo(performer: CatalogPerformer) {
    if (!selectedVideo) {
      return;
    }

    try {
      await attachPerformerToCatalogVideo(performer.id, selectedVideo.id);
      setSelectedVideoPerformers((currentPerformers) =>
        appendUniqueMetadata(currentPerformers, performer),
      );
      addPerformerToCatalogVideoMetadata(selectedVideo.id, performer);
      setDetailStatusMessage("");
    } catch (error) {
      setDetailStatusMessage(errorMessage(error));
    }
  }

  async function createOrAttachPerformerToSelectedVideo(performerName: string) {
    if (!selectedVideo) {
      return;
    }

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

      await attachPerformerToCatalogVideo(performer.id, selectedVideo.id);
      setAvailablePerformers((currentPerformers) =>
        appendUniqueMetadata(currentPerformers, performer),
      );
      setSelectedVideoPerformers((currentPerformers) =>
        appendUniqueMetadata(currentPerformers, performer),
      );
      addPerformerToCatalogVideoMetadata(selectedVideo.id, performer);
      setDetailStatusMessage("");
    } catch (error) {
      setDetailStatusMessage(errorMessage(error));
    }
  }

  async function detachPerformerFromSelectedVideo(performer: CatalogPerformer) {
    if (!selectedVideo) {
      return;
    }

    try {
      await detachPerformerFromCatalogVideo(performer.id, selectedVideo.id);
      setSelectedVideoPerformers((currentPerformers) =>
        currentPerformers.filter(
          (currentPerformer) => currentPerformer.id !== performer.id,
        ),
      );
      removePerformerFromCatalogVideoMetadata(selectedVideo.id, performer);
      setAvailablePerformers(await loadAvailablePerformers());
      setDetailStatusMessage("");
    } catch (error) {
      setDetailStatusMessage(errorMessage(error));
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
      const currentMetadata = currentMetadataById[videoId] ?? {
        tags: [],
        performers: [],
      };

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
      const currentMetadata = currentMetadataById[videoId] ?? {
        tags: [],
        performers: [],
      };

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
      const currentMetadata = currentMetadataById[videoId] ?? {
        tags: [],
        performers: [],
      };

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
      const currentMetadata = currentMetadataById[videoId] ?? {
        tags: [],
        performers: [],
      };

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

  const missingVideos = catalogVideos.filter(
    (catalogVideo) => !catalogVideo.isAvailable,
  );
  const activeCatalogVideoFilters =
    catalogVideoWorkspace === "favorites"
      ? { ...catalogVideoFilters, favoritesOnly: true }
      : catalogVideoFilters;
  const workspaceCatalogVideoSort =
    catalogVideoWorkspace === "recentlyOpened"
      ? "lastOpenedDescending"
      : catalogVideoSort;
  const filteredCatalogVideos = sortedCatalogVideos(
    workspaceCatalogVideos(catalogVideos, catalogVideoWorkspace).filter(
      (catalogVideo) =>
        catalogVideoMatchesFilters(
          catalogVideo,
          catalogVideoMetadataById[catalogVideo.id],
          activeCatalogVideoFilters,
        ),
    ),
    workspaceCatalogVideoSort,
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
  const unavailableScanRoots = scanRoots.filter(
    (scanRoot) => !scanRoot.isAvailable,
  );
  const isCatalogVideoListView = catalogView !== "metadataSuggestions";
  const scanIssuesAttentionCount =
    missingVideos.length +
    unavailableScanRoots.length +
    unprocessableVideoCandidates.length;
  const previewGenerationAttentionCount = failedPreviewStrips.length;
  const scanAttentionCount =
    scanIssuesAttentionCount + previewGenerationAttentionCount;
  const ffmpegToolAttentionCount = ffmpegToolsStatus
    ? [ffmpegToolsStatus.ffmpeg, ffmpegToolsStatus.ffprobe].filter(
        (toolStatus) => !toolStatus.isAvailable,
      ).length
    : ffmpegStatusMessage === ffmpegErrorMessage
      ? 1
      : 0;
  const settingsAttentionCount =
    (localDesktopAppStatus === commandErrorMessage ? 1 : 0) +
    ffmpegToolAttentionCount;
  const generatedPreviewStripCount = catalogVideos.filter(
    (catalogVideo) => catalogVideo.previewStrip.status === "generated",
  ).length;
  const generatingPreviewStripVideo = catalogVideos.find(
    (catalogVideo) =>
      catalogVideo.id === previewStripQueueStatus?.runningVideoId,
  );

  return (
    <Box component="main" className="app-shell">
      <Group component="nav" aria-label="Module navigation" gap="xs">
        <Button
          type="button"
          variant={activeAppModule === "catalog" ? "filled" : "default"}
          onClick={() => setActiveAppModule("catalog")}
        >
          Catalog
        </Button>
        <Button
          type="button"
          variant={activeAppModule === "scan" ? "filled" : "default"}
          onClick={() => setActiveAppModule("scan")}
        >
          <Group gap={6}>
            <span>Scan</span>
            {scanAttentionCount > 0 ? (
              <Badge size="sm" color="red">
                {scanAttentionCount}
              </Badge>
            ) : null}
          </Group>
        </Button>
        <Button
          type="button"
          variant={activeAppModule === "settings" ? "filled" : "default"}
          onClick={() => setActiveAppModule("settings")}
        >
          <Group gap={6}>
            <span>Settings</span>
            {settingsAttentionCount > 0 ? (
              <Badge size="sm" color="red">
                {settingsAttentionCount}
              </Badge>
            ) : null}
          </Group>
        </Button>
      </Group>
      {activeAppModule === "catalog" ? <WorkspaceHeader /> : null}
      <TauriStatusPanel localDesktopAppStatus={localDesktopAppStatus} />
      {activeAppModule === "catalog" ? (
        <>
          <Group component="nav" aria-label="Catalog navigation" gap="xs">
            <Button
              type="button"
              variant={catalogView === "allVideos" ? "filled" : "default"}
              onClick={() => selectCatalogView("allVideos")}
            >
              All Videos
            </Button>
            <Button
              type="button"
              variant={catalogView === "favorites" ? "filled" : "default"}
              onClick={() => selectCatalogView("favorites")}
            >
              Favorites
            </Button>
            <Button
              type="button"
              variant={catalogView === "recentlyOpened" ? "filled" : "default"}
              onClick={() => selectCatalogView("recentlyOpened")}
            >
              Recently Opened
            </Button>
            <Button
              type="button"
              variant={
                catalogView === "metadataSuggestions" ? "filled" : "default"
              }
              onClick={() => selectCatalogView("metadataSuggestions")}
            >
              Metadata Suggestions
            </Button>
          </Group>
          {isCatalogVideoListView ? (
            <CatalogVideosPanel
              availablePerformers={availablePerformers}
              availableTags={availableTags}
              catalogVideoActionStatusMessage={catalogVideoActionStatusMessage}
              catalogVideoFilters={activeCatalogVideoFilters}
              catalogVideoWorkspace={catalogVideoWorkspace}
              catalogVideoSort={workspaceCatalogVideoSort}
              catalogVideos={filteredCatalogVideos}
              catalogVideosStatusMessage={catalogVideosStatusMessage}
              onCatalogVideoFiltersChange={setCatalogVideoFilters}
              onCatalogVideoSortChange={setCatalogVideoSort}
              onPausePreviewQueue={pausePreviewQueue}
              onResumePreviewQueue={resumePreviewQueue}
              onOpenVideo={openVideoFromCatalog}
              onSetBatchVideoSelected={setBatchVideoSelected}
              onSelectVideo={selectVideoForDetail}
              onSetFavorite={setCatalogVideoFavorite}
              previewStripQueueStatus={previewStripQueueStatus}
              previewStripStatusMessage={previewStripStatusMessage}
              selectedVideoIds={batchSelectedVideoIds}
            />
          ) : (
            <Paper component="section" aria-label="Catalog Metadata Suggestions" p="md" maw={760}>
              <MetadataSuggestionsPanel
                availablePerformers={availablePerformers}
                availableTags={availableTags}
                metadataSuggestionGroups={metadataSuggestionGroups}
                onAcceptMetadataSuggestionVideos={
                  acceptSelectedMetadataSuggestionVideos
                }
                onRejectMetadataSuggestionSource={
                  rejectMetadataSuggestionForSource
                }
                onReviewVideo={reviewMetadataSuggestionVideo}
              />
            </Paper>
          )}
          {batchSelectedVideos.length > 0 ? (
            <BatchMetadataEditPanel
              availablePerformers={availablePerformers}
              availableTags={availableTags}
              onAppendPerformer={appendPerformerToBatchSelectedVideos}
              onAppendTag={appendTagToBatchSelectedVideos}
              onCreateOrAppendPerformer={
                createOrAppendPerformerToBatchSelectedVideos
              }
              onCreateOrAppendTag={createOrAppendTagToBatchSelectedVideos}
              onRemovePerformer={removePerformerFromBatchSelectedVideos}
              onRemoveTag={removeTagFromBatchSelectedVideos}
              onSetFavorite={setBatchSelectedVideosFavorite}
              removablePerformers={batchRemovablePerformers}
              removableTags={batchRemovableTags}
              selectedVideoCount={batchSelectedVideos.length}
            />
          ) : null}
          {selectedVideo ? (
            <VideoDetailPanel
              availablePerformers={availablePerformers}
              availableTags={availableTags}
              detailStatusMessage={detailStatusMessage}
              onAttachPerformer={attachPerformerToSelectedVideo}
              onAttachTag={attachTagToSelectedVideo}
              onCreateOrAttachPerformer={createOrAttachPerformerToSelectedVideo}
              onCreateOrAttachTag={createOrAttachTagToSelectedVideo}
              onDetachPerformer={detachPerformerFromSelectedVideo}
              onDetachTag={detachTagFromSelectedVideo}
              onSaveTitle={saveSelectedVideoTitle}
              onSetFavorite={setSelectedVideoFavorite}
              selectedPerformers={selectedVideoPerformers}
              selectedTags={selectedVideoTags}
              video={selectedVideo}
            />
          ) : null}
        </>
      ) : null}
      {activeAppModule === "scan" ? (
        <Tabs value={scanTab} onChange={setScanTab} keepMounted={false}>
          <Tabs.List aria-label="Scan module tabs">
            <Tabs.Tab value={scanRootsTab}>Scan Roots</Tabs.Tab>
            <Tabs.Tab value={scanIssuesTab}>
              <Group gap={6}>
                <span>Scan Issues</span>
                {scanIssuesAttentionCount > 0 ? (
                  <Badge size="sm" color="red">
                    {scanIssuesAttentionCount}
                  </Badge>
                ) : null}
              </Group>
            </Tabs.Tab>
            <Tabs.Tab value={previewGenerationTab}>
              <Group gap={6}>
                <span>Preview Generation</span>
                {previewGenerationAttentionCount > 0 ? (
                  <Badge size="sm" color="red">
                    {previewGenerationAttentionCount}
                  </Badge>
                ) : null}
              </Group>
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value={scanRootsTab}>
            <ScanRootsPanel
              manualScanRootPath={manualScanRootPath}
              scanRoots={scanRoots}
              scanRootsStatusMessage={scanRootsStatusMessage}
              onAddManualScanRoot={addManualScanRoot}
              onChooseScanRootFolder={chooseScanRootFolder}
              onManualScanRootPathChange={setManualScanRootPath}
              onRefreshEveryScanRoot={refreshEveryScanRoot}
              onRefreshSelectedScanRoot={refreshSelectedScanRoot}
              onRequestScanRootRemoval={setScanRootPendingRemoval}
              onSaveScanRootInferenceRules={saveScanRootInferenceRules}
            />
          </Tabs.Panel>

          <Tabs.Panel value={scanIssuesTab}>
            <ReviewQueuePanel
              metadataSuggestionsPanel={null}
              missingVideos={missingVideos}
              reviewQueueStatusMessage={reviewQueueStatusMessage}
              unavailableScanRoots={unavailableScanRoots}
              unprocessableVideoCandidates={unprocessableVideoCandidates}
              onRequestMissingVideoForget={setMissingVideoPendingForget}
            />
          </Tabs.Panel>

          <Tabs.Panel value={previewGenerationTab}>
            <PreviewGenerationView
              failedPreviewStrips={failedPreviewStrips}
              generatedPreviewStripCount={generatedPreviewStripCount}
              generatingPreviewStripTitle={generatingPreviewStripVideo?.title}
              onIgnoreFailedPreview={ignoreFailedPreview}
              onPausePreviewQueue={pausePreviewQueue}
              onResumePreviewQueue={resumePreviewQueue}
              onRetryFailedPreview={retryFailedPreview}
              previewStripQueueStatus={previewStripQueueStatus}
            />
          </Tabs.Panel>
        </Tabs>
      ) : null}

      {scanRootPendingRemoval ? (
        <Paper
          component="section"
          aria-label="Remove Scan Root confirmation"
          p="md"
          maw={760}
        >
          <Stack gap="sm">
            <Title order={2} size="h3">
              Remove Scan Root
            </Title>
            <Code className="wrapping-code">{scanRootPendingRemoval.path}</Code>
            <Group gap="xs">
              <Button
                type="button"
                onClick={() =>
                  void confirmScanRootRemoval("preserveMissingVideos")
                }
              >
                Preserve as Missing Videos
              </Button>
              <Button
                type="button"
                variant="light"
                color="red"
                onClick={() => void confirmScanRootRemoval("forgetFromCatalog")}
              >
                Forget From Catalog
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={() => setScanRootPendingRemoval(null)}
              >
                Cancel
              </Button>
            </Group>
          </Stack>
        </Paper>
      ) : null}

      {missingVideoPendingForget ? (
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
            <Text>{missingVideoPendingForget.title}</Text>
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
                onClick={() => setMissingVideoPendingForget(null)}
              >
                Cancel
              </Button>
            </Group>
          </Stack>
        </Paper>
      ) : null}

      {activeAppModule === "settings" ? (
        <FfmpegStatusPanel
          ffmpegPath={ffmpegPath}
          ffmpegStatusMessage={ffmpegStatusMessage}
          ffmpegToolsStatus={ffmpegToolsStatus}
          ffprobePath={ffprobePath}
          onFfmpegPathChange={setFfmpegPath}
          onFfprobePathChange={setFfprobePath}
          onSaveConfiguredFfmpegPaths={saveConfiguredFfmpegPaths}
        />
      ) : null}
    </Box>
  );
}
