import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Code,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { open } from "@tauri-apps/plugin-dialog";

import {
  CatalogPerformer,
  CatalogTag,
  CatalogVideo,
  FailedPreviewStrip,
  FfmpegToolsStatus,
  MetadataSuggestionGroup,
  PreviewStripQueueStatus,
  ScanRoot,
  ScanRootRemovalPolicy,
  ScanRootRefreshSummary,
  UnprocessableVideoCandidate,
  acceptMetadataSuggestionForVideos,
  addScanRoot,
  forgetCatalogVideo,
  getFfmpegToolsStatus,
  getLocalDesktopAppStatus,
  getPreviewStripQueueStatus,
  ignoreFailedPreviewStrip,
  listCatalogVideos,
  listMetadataSuggestionGroups,
  listPerformers,
  listFailedPreviewStrips,
  listScanRoots,
  listTags,
  listUnprocessableVideoCandidates,
  openCatalogVideo,
  createPerformer,
  createTag,
  performersForVideo,
  pausePreviewStripQueue,
  processNextPreviewStripQueueItem,
  removeScanRoot,
  refreshAllScanRoots,
  refreshScanRoot,
  rejectMetadataSuggestionSource,
  retryFailedPreviewStrip,
  resumePreviewStripQueue,
  saveFfmpegConfiguration,
  setVideoFavorite,
  tagsForVideo,
  updateVideoTitle,
  updateScanRootInferenceRules,
  attachTagToVideo,
  detachTagFromVideo,
  attachPerformerToVideo,
  detachPerformerFromVideo,
} from "./tauriCommands";
import type {
  AcceptMetadataSuggestionForVideosRequest,
  RejectMetadataSuggestionSourceRequest,
} from "./tauriCommands";
import { WorkspaceHeader } from "./modules/catalog/WorkspaceHeader";
import { BatchMetadataEditPanel } from "./modules/catalog/BatchMetadataEditPanel";
import { CatalogVideosPanel } from "./modules/catalog/CatalogVideosPanel";
import { VideoDetailPanel } from "./modules/catalog/VideoDetailPanel";
import type {
  CatalogVideoFilters,
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
import { FfmpegStatusPanel, TauriStatusPanel } from "./modules/settings/SettingsStatusPanels";
import { appendUniqueMetadata, findMetadataByName, uniqueMetadataValues } from "./shared/metadata/metadataHelpers";

const loadingStatusMessage = "Checking Rust command...";
const commandErrorMessage = "Rust command unavailable";
const ffmpegLoadingMessage = "Checking FFmpeg tools...";
const ffmpegErrorMessage = "FFmpeg status unavailable";
const catalogVideosLoadingMessage = "Loading Videos...";
const catalogVideosErrorMessage = "Videos unavailable";
const scanRootsLoadingMessage = "Loading Scan Roots...";
const scanRootsErrorMessage = "Scan Roots unavailable";
const reviewQueueLoadingMessage = "Loading Review Queue...";
const reviewQueueErrorMessage = "Review Queue unavailable";
const scanRootRefreshStartedMessage = "Refreshing Scan Root...";
const previewStripQueueErrorMessage = "Preview Strip queue unavailable";
const previewStripQueuePollingIntervalMilliseconds = 250;

const emptyMetadataInputMessage = "Enter a name first.";
function normalizeConfiguredPath(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

export default function App() {
  const [localDesktopAppStatus, setLocalDesktopAppStatus] =
    useState(loadingStatusMessage);
  const [ffmpegToolsStatus, setFfmpegToolsStatus] =
    useState<FfmpegToolsStatus | null>(null);
  const [ffmpegStatusMessage, setFfmpegStatusMessage] =
    useState(ffmpegLoadingMessage);
  const [catalogVideos, setCatalogVideos] = useState<CatalogVideo[]>([]);
  const [catalogVideosStatusMessage, setCatalogVideosStatusMessage] = useState(
    catalogVideosLoadingMessage,
  );
  const [catalogVideoActionStatusMessage, setCatalogVideoActionStatusMessage] =
    useState("");
  const [scanRoots, setScanRoots] = useState<ScanRoot[]>([]);
  const [scanRootsStatusMessage, setScanRootsStatusMessage] = useState(
    scanRootsLoadingMessage,
  );
  const [unprocessableVideoCandidates, setUnprocessableVideoCandidates] =
    useState<UnprocessableVideoCandidate[]>([]);
  const [failedPreviewStrips, setFailedPreviewStrips] = useState<
    FailedPreviewStrip[]
  >([]);
  const [metadataSuggestionGroups, setMetadataSuggestionGroups] = useState<
    MetadataSuggestionGroup[]
  >([]);
  const [reviewQueueStatusMessage, setReviewQueueStatusMessage] = useState(
    reviewQueueLoadingMessage,
  );
  const [manualScanRootPath, setManualScanRootPath] = useState("");
  const [scanRootPendingRemoval, setScanRootPendingRemoval] =
    useState<ScanRoot | null>(null);
  const [missingVideoPendingForget, setMissingVideoPendingForget] =
    useState<CatalogVideo | null>(null);
  const [ffmpegPath, setFfmpegPath] = useState("");
  const [ffprobePath, setFfprobePath] = useState("");
  const [previewStripStatusMessage, setPreviewStripStatusMessage] =
    useState("");
  const [previewStripQueueStatus, setPreviewStripQueueStatus] =
    useState<PreviewStripQueueStatus | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<CatalogVideo | null>(null);
  const [availableTags, setAvailableTags] = useState<CatalogTag[]>([]);
  const [availablePerformers, setAvailablePerformers] = useState<
    CatalogPerformer[]
  >([]);
  const [selectedVideoTags, setSelectedVideoTags] = useState<CatalogTag[]>([]);
  const [selectedVideoPerformers, setSelectedVideoPerformers] = useState<
    CatalogPerformer[]
  >([]);
  const [batchSelectedVideoIds, setBatchSelectedVideoIds] = useState<number[]>(
    [],
  );
  const [catalogVideoMetadataById, setCatalogVideoMetadataById] = useState<
    Record<number, CatalogVideoMetadata>
  >({});
  const [catalogVideoFilters, setCatalogVideoFilters] =
    useState<CatalogVideoFilters>(defaultCatalogVideoFilters);
  const [catalogVideoSort, setCatalogVideoSort] =
    useState<CatalogVideoSort>("titleAscending");
  const [catalogVideoWorkspace, setCatalogVideoWorkspace] =
    useState<CatalogVideoWorkspace>("videos");
  const [detailStatusMessage, setDetailStatusMessage] = useState("");
  const selectedVideoRequestId = useRef(0);

  async function loadCatalogVideos() {
    try {
      const storedCatalogVideos = await listCatalogVideos();

      setCatalogVideos(storedCatalogVideos);
      setCatalogVideosStatusMessage("");
      setCatalogVideoActionStatusMessage("");
    } catch {
      setCatalogVideosStatusMessage(catalogVideosErrorMessage);
    }
  }

  async function loadPreviewStripQueueStatus() {
    try {
      const queueStatus = await getPreviewStripQueueStatus();

      setPreviewStripQueueStatus(queueStatus);
    } catch {
      setPreviewStripStatusMessage(previewStripQueueErrorMessage);
    }
  }

  async function loadScanRoots(shouldClearStatusMessage = true) {
    try {
      const storedScanRoots = await listScanRoots();

      setScanRoots(storedScanRoots);
      if (shouldClearStatusMessage) {
        setScanRootsStatusMessage("");
      }
    } catch {
      setScanRootsStatusMessage(scanRootsErrorMessage);
    }
  }

  async function loadReviewQueue(shouldClearStatusMessage = true) {
    try {
      const [
        storedUnprocessableVideoCandidates,
        storedFailedPreviewStrips,
        storedMetadataSuggestionGroups,
      ] = await Promise.all([
        listUnprocessableVideoCandidates(),
        listFailedPreviewStrips(),
        listMetadataSuggestionGroups(),
      ]);

      setUnprocessableVideoCandidates(storedUnprocessableVideoCandidates);
      setFailedPreviewStrips(storedFailedPreviewStrips);
      setMetadataSuggestionGroups(storedMetadataSuggestionGroups);
      if (shouldClearStatusMessage) {
        setReviewQueueStatusMessage("");
      }
    } catch {
      setReviewQueueStatusMessage(reviewQueueErrorMessage);
    }
  }

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
      await acceptMetadataSuggestionForVideos({
        acceptedMetadataKind,
        acceptedValue,
        scanRootPath,
        suggestedValue,
        sourcePathSegment,
        suggestionKind,
        videoIds,
      });
      await loadReviewQueue(false);
      const [storedTags, storedPerformers] = await Promise.all([
        listTags(),
        listPerformers(),
      ]);
      setAvailableTags(storedTags);
      setAvailablePerformers(storedPerformers);
      const metadataEntries = await Promise.all(
        videoIds.map(async (videoId) => {
          const [videoTags, videoPerformers] = await Promise.all([
            tagsForVideo(videoId),
            performersForVideo(videoId),
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
      await rejectMetadataSuggestionSource({
        scanRootPath,
        sourcePathSegment,
        suggestedValue,
        suggestionKind,
      });
      await loadReviewQueue(false);
    } catch (error) {
      setReviewQueueStatusMessage(errorMessage(error));
    }
  }

  useEffect(() => {
    let canUpdateStatus = true;

    async function loadLocalDesktopAppStatus() {
      try {
        const status = await getLocalDesktopAppStatus();

        if (canUpdateStatus) {
          setLocalDesktopAppStatus(status);
        }
      } catch {
        if (canUpdateStatus) {
          setLocalDesktopAppStatus(commandErrorMessage);
        }
      }
    }

    void loadLocalDesktopAppStatus();

    return () => {
      canUpdateStatus = false;
    };
  }, []);

  useEffect(() => {
    let canUpdatePreviewStripQueue = true;

    async function loadInitialPreviewStripQueueStatus() {
      try {
        const queueStatus = await getPreviewStripQueueStatus();

        if (canUpdatePreviewStripQueue) {
          setPreviewStripQueueStatus(queueStatus);
        }
      } catch {
        if (canUpdatePreviewStripQueue) {
          setPreviewStripStatusMessage(previewStripQueueErrorMessage);
        }
      }
    }

    void loadInitialPreviewStripQueueStatus();

    return () => {
      canUpdatePreviewStripQueue = false;
    };
  }, []);

  useEffect(() => {
    let canProcessQueue = true;

    async function processPreviewStripQueue() {
      if (
        !previewStripQueueStatus ||
        previewStripQueueStatus.isPaused ||
        previewStripQueueStatus.runningCount > 0 ||
        previewStripQueueStatus.pendingCount === 0
      ) {
        return;
      }

      try {
        const queueStatus = await processNextPreviewStripQueueItem();

        if (canProcessQueue) {
          setPreviewStripQueueStatus(queueStatus);
        }
      } catch (error) {
        if (canProcessQueue) {
          setPreviewStripStatusMessage(errorMessage(error));
        }
      }
    }

    void processPreviewStripQueue();

    return () => {
      canProcessQueue = false;
    };
  }, [previewStripQueueStatus]);

  useEffect(() => {
    if (
      !previewStripQueueStatus ||
      previewStripQueueStatus.runningCount === 0
    ) {
      return;
    }

    let canUpdatePreviewStripQueue = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        const queueStatus = await getPreviewStripQueueStatus();

        if (!canUpdatePreviewStripQueue) {
          return;
        }

        setPreviewStripQueueStatus(queueStatus);
        if (queueStatus.runningCount === 0) {
          await loadCatalogVideos();
          await loadReviewQueue(false);
        }
      } catch (error) {
        if (canUpdatePreviewStripQueue) {
          setPreviewStripStatusMessage(errorMessage(error));
        }
      }
    }, previewStripQueuePollingIntervalMilliseconds);

    return () => {
      canUpdatePreviewStripQueue = false;
      window.clearTimeout(timeoutId);
    };
  }, [previewStripQueueStatus]);

  useEffect(() => {
    let canUpdateReviewQueue = true;

    async function loadInitialReviewQueue() {
      try {
        const [
          storedUnprocessableVideoCandidates,
          storedFailedPreviewStrips,
          storedMetadataSuggestionGroups,
        ] = await Promise.all([
          listUnprocessableVideoCandidates(),
          listFailedPreviewStrips(),
          listMetadataSuggestionGroups(),
        ]);

        if (canUpdateReviewQueue) {
          setUnprocessableVideoCandidates(storedUnprocessableVideoCandidates);
          setFailedPreviewStrips(storedFailedPreviewStrips);
          setMetadataSuggestionGroups(storedMetadataSuggestionGroups);
          setReviewQueueStatusMessage("");
        }
      } catch {
        if (canUpdateReviewQueue) {
          setReviewQueueStatusMessage(reviewQueueErrorMessage);
        }
      }
    }

    void loadInitialReviewQueue();

    return () => {
      canUpdateReviewQueue = false;
    };
  }, []);

  useEffect(() => {
    let canUpdateCatalogVideos = true;

    async function loadInitialCatalogVideos() {
      try {
        const storedCatalogVideos = await listCatalogVideos();

        if (canUpdateCatalogVideos) {
          setCatalogVideos(storedCatalogVideos);
          setCatalogVideosStatusMessage("");
        }
      } catch {
        if (canUpdateCatalogVideos) {
          setCatalogVideosStatusMessage(catalogVideosErrorMessage);
        }
      }
    }

    void loadInitialCatalogVideos();

    return () => {
      canUpdateCatalogVideos = false;
    };
  }, []);

  useEffect(() => {
    let canUpdateStatus = true;

    async function loadFfmpegToolsStatus() {
      try {
        const status = await getFfmpegToolsStatus();

        if (canUpdateStatus) {
          setFfmpegToolsStatus(status);
          setFfmpegPath(status.configuration.ffmpegPath ?? "");
          setFfprobePath(status.configuration.ffprobePath ?? "");
          setFfmpegStatusMessage("");
        }
      } catch {
        if (canUpdateStatus) {
          setFfmpegStatusMessage(ffmpegErrorMessage);
        }
      }
    }

    void loadFfmpegToolsStatus();

    return () => {
      canUpdateStatus = false;
    };
  }, []);

  useEffect(() => {
    let canUpdateScanRoots = true;

    async function loadScanRoots() {
      try {
        const storedScanRoots = await listScanRoots();

        if (canUpdateScanRoots) {
          setScanRoots(storedScanRoots);
          setScanRootsStatusMessage("");
        }
      } catch {
        if (canUpdateScanRoots) {
          setScanRootsStatusMessage(scanRootsErrorMessage);
        }
      }
    }

    void loadScanRoots();

    return () => {
      canUpdateScanRoots = false;
    };
  }, []);

  useEffect(() => {
    let canUpdateMetadata = true;

    async function loadMetadata() {
      try {
        const [storedTags, storedPerformers] = await Promise.all([
          listTags(),
          listPerformers(),
        ]);

        if (canUpdateMetadata) {
          setAvailableTags(storedTags);
          setAvailablePerformers(storedPerformers);
        }
      } catch {
        if (canUpdateMetadata) {
          setAvailableTags([]);
          setAvailablePerformers([]);
        }
      }
    }

    void loadMetadata();

    return () => {
      canUpdateMetadata = false;
    };
  }, []);

  useEffect(() => {
    let canUpdateCatalogVideoMetadata = true;

    async function loadCatalogVideoMetadata() {
      const metadataEntries = await Promise.all(
        catalogVideos.map(async (catalogVideo) => {
          const [videoTags, videoPerformers] = await Promise.all([
            tagsForVideo(catalogVideo.id),
            performersForVideo(catalogVideo.id),
          ]);

          return [
            catalogVideo.id,
            { tags: videoTags, performers: videoPerformers },
          ] as const;
        }),
      );

      if (canUpdateCatalogVideoMetadata) {
        setCatalogVideoMetadataById(Object.fromEntries(metadataEntries));
      }
    }

    if (catalogVideos.length === 0) {
      setCatalogVideoMetadataById({});
      return () => {
        canUpdateCatalogVideoMetadata = false;
      };
    }

    void loadCatalogVideoMetadata();

    return () => {
      canUpdateCatalogVideoMetadata = false;
    };
  }, [catalogVideos]);

  async function saveConfiguredFfmpegPaths(event: React.FormEvent) {
    event.preventDefault();

    try {
      const status = await saveFfmpegConfiguration({
        ffmpegPath: normalizeConfiguredPath(ffmpegPath),
        ffprobePath: normalizeConfiguredPath(ffprobePath),
      });

      setFfmpegToolsStatus(status);
      setFfmpegPath(status.configuration.ffmpegPath ?? "");
      setFfprobePath(status.configuration.ffprobePath ?? "");
      setFfmpegStatusMessage("");
      await loadReviewQueue(false);
    } catch {
      setFfmpegStatusMessage(ffmpegErrorMessage);
    }
  }

  async function chooseScanRootFolder() {
    try {
      const selectedFolder = await open({
        directory: true,
        multiple: false,
      });

      if (typeof selectedFolder === "string") {
        await persistScanRoot(selectedFolder);
      }
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  async function addManualScanRoot(event: React.FormEvent) {
    event.preventDefault();
    await persistScanRoot(manualScanRootPath);
  }

  async function persistScanRoot(path: string) {
    const scanRootPath = path.trim();

    if (!scanRootPath) {
      return;
    }

    try {
      const scanRoot = await addScanRoot(scanRootPath);
      const refreshSummary = await refreshScanRoot(scanRoot.path);

      setScanRoots((currentScanRoots) =>
        [...currentScanRoots, scanRoot].sort((left, right) =>
          left.path.localeCompare(right.path),
        ),
      );
      setManualScanRootPath("");
      setScanRootsStatusMessage(scanRootRefreshSummaryMessage(refreshSummary));
      await loadCatalogVideos();
      await loadReviewQueue(false);
      await loadPreviewStripQueueStatus();
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  async function confirmScanRootRemoval(removalPolicy: ScanRootRemovalPolicy) {
    if (!scanRootPendingRemoval) {
      return;
    }

    const removedScanRoot = scanRootPendingRemoval;

    try {
      await removeScanRoot(removedScanRoot.path, removalPolicy);
      setScanRoots((currentScanRoots) =>
        currentScanRoots.filter(
          (scanRoot) => scanRoot.path !== removedScanRoot.path,
        ),
      );
      setScanRootPendingRemoval(null);
      setScanRootsStatusMessage("");
      await loadCatalogVideos();
      await loadReviewQueue(false);
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  async function confirmMissingVideoForget() {
    if (!missingVideoPendingForget) {
      return;
    }

    try {
      await forgetCatalogVideo(missingVideoPendingForget.id);
      setMissingVideoPendingForget(null);
      setReviewQueueStatusMessage("");
      await loadCatalogVideos();
    } catch (error) {
      setReviewQueueStatusMessage(errorMessage(error));
    }
  }

  async function retryFailedPreview(failedPreviewStrip: FailedPreviewStrip) {
    try {
      const queueStatus = await retryFailedPreviewStrip(
        failedPreviewStrip.videoId,
      );

      setPreviewStripQueueStatus(queueStatus);
      setReviewQueueStatusMessage("");
      await loadCatalogVideos();
      await loadReviewQueue(false);
      await loadPreviewStripQueueStatus();
    } catch (error) {
      setReviewQueueStatusMessage(errorMessage(error));
    }
  }

  async function ignoreFailedPreview(failedPreviewStrip: FailedPreviewStrip) {
    try {
      const queueStatus = await ignoreFailedPreviewStrip(
        failedPreviewStrip.videoId,
      );

      setPreviewStripQueueStatus(queueStatus);
      setReviewQueueStatusMessage("");
      await loadReviewQueue(false);
    } catch (error) {
      setReviewQueueStatusMessage(errorMessage(error));
    }
  }

  async function refreshSelectedScanRoot(scanRoot: ScanRoot) {
    try {
      setScanRootsStatusMessage(scanRootRefreshStartedMessage);
      const refreshSummary = await refreshScanRoot(scanRoot.path);

      setScanRootsStatusMessage(scanRootRefreshSummaryMessage(refreshSummary));
      await loadScanRoots(false);
      await loadCatalogVideos();
      await loadReviewQueue(false);
      await loadPreviewStripQueueStatus();
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  async function saveScanRootInferenceRules(
    scanRoot: ScanRoot,
    inferenceRules: ScanRoot["inferenceRules"],
  ) {
    try {
      const updatedScanRoot = await updateScanRootInferenceRules(
        scanRoot.path,
        inferenceRules,
      );
      setScanRoots((currentScanRoots) =>
        currentScanRoots.map((currentScanRoot) =>
          currentScanRoot.path === updatedScanRoot.path
            ? updatedScanRoot
            : currentScanRoot,
        ),
      );
    } catch {
      setScanRootsStatusMessage(scanRootsErrorMessage);
    }
  }

  async function refreshEveryScanRoot() {
    try {
      setScanRootsStatusMessage(scanRootRefreshStartedMessage);
      const refreshSummary = await refreshAllScanRoots();

      setScanRootsStatusMessage(scanRootRefreshSummaryMessage(refreshSummary));
      await loadScanRoots(false);
      await loadCatalogVideos();
      await loadReviewQueue(false);
      await loadPreviewStripQueueStatus();
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  async function pausePreviewQueue() {
    try {
      const queueStatus = await pausePreviewStripQueue();

      setPreviewStripQueueStatus(queueStatus);
      setPreviewStripStatusMessage("");
    } catch (error) {
      setPreviewStripStatusMessage(errorMessage(error));
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
          listTags(),
          listPerformers(),
          tagsForVideo(catalogVideo.id),
          performersForVideo(catalogVideo.id),
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

  async function saveSelectedVideoTitle(title: string) {
    if (!selectedVideo) {
      return;
    }

    try {
      await updateVideoTitle(selectedVideo.id, title);
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
      await setVideoFavorite(video.id, isFavorite);
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
      await openCatalogVideo(video.id);
      await loadCatalogVideos();
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
          attachTagToVideo(tag.id, videoId),
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
      const tag = existingTag ?? (await createTag(trimmedTagName));

      await Promise.all(
        batchSelectedVideoIds.map((videoId) =>
          attachTagToVideo(tag.id, videoId),
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
          detachTagFromVideo(tag.id, videoId),
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
      setAvailableTags(await listTags());
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
      await attachTagToVideo(tag.id, selectedVideo.id);
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
      const tag = existingTag ?? (await createTag(trimmedTagName));

      await attachTagToVideo(tag.id, selectedVideo.id);
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
      await detachTagFromVideo(tag.id, selectedVideo.id);
      setSelectedVideoTags((currentTags) =>
        currentTags.filter((currentTag) => currentTag.id !== tag.id),
      );
      removeTagFromCatalogVideoMetadata(selectedVideo.id, tag);
      setAvailableTags(await listTags());
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
      await attachPerformerToVideo(performer.id, selectedVideo.id);
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
        existingPerformer ?? (await createPerformer(trimmedPerformerName));

      await attachPerformerToVideo(performer.id, selectedVideo.id);
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
      await detachPerformerFromVideo(performer.id, selectedVideo.id);
      setSelectedVideoPerformers((currentPerformers) =>
        currentPerformers.filter(
          (currentPerformer) => currentPerformer.id !== performer.id,
        ),
      );
      removePerformerFromCatalogVideoMetadata(selectedVideo.id, performer);
      setAvailablePerformers(await listPerformers());
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
          attachPerformerToVideo(performer.id, videoId),
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
        existingPerformer ?? (await createPerformer(trimmedPerformerName));

      await Promise.all(
        batchSelectedVideoIds.map((videoId) =>
          attachPerformerToVideo(performer.id, videoId),
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
          detachPerformerFromVideo(performer.id, videoId),
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
      setAvailablePerformers(await listPerformers());
      setCatalogVideoActionStatusMessage("");
    } catch (error) {
      setCatalogVideoActionStatusMessage(errorMessage(error));
    }
  }

  async function setBatchSelectedVideosFavorite(isFavorite: boolean) {
    try {
      await Promise.all(
        batchSelectedVideoIds.map((videoId) =>
          setVideoFavorite(videoId, isFavorite),
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

  async function resumePreviewQueue() {
    try {
      const queueStatus = await resumePreviewStripQueue();

      setPreviewStripQueueStatus(queueStatus);
      setPreviewStripStatusMessage("");
    } catch (error) {
      setPreviewStripStatusMessage(errorMessage(error));
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

  return (
    <Box component="main" className="app-shell">
      <WorkspaceHeader catalogVideoWorkspace={catalogVideoWorkspace} />
      <TauriStatusPanel localDesktopAppStatus={localDesktopAppStatus} />
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
        onCatalogVideoWorkspaceChange={setCatalogVideoWorkspace}
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
      <ReviewQueuePanel
        failedPreviewStrips={failedPreviewStrips}
        metadataSuggestionsPanel={
          <MetadataSuggestionsPanel
            availablePerformers={availablePerformers}
            availableTags={availableTags}
            metadataSuggestionGroups={metadataSuggestionGroups}
            onAcceptMetadataSuggestionVideos={
              acceptSelectedMetadataSuggestionVideos
            }
            onRejectMetadataSuggestionSource={rejectMetadataSuggestionForSource}
          />
        }
        missingVideos={missingVideos}
        onIgnoreFailedPreview={ignoreFailedPreview}
        reviewQueueStatusMessage={reviewQueueStatusMessage}
        onRetryFailedPreview={retryFailedPreview}
        unavailableScanRoots={unavailableScanRoots}
        unprocessableVideoCandidates={unprocessableVideoCandidates}
        onRequestMissingVideoForget={setMissingVideoPendingForget}
      />
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

      <FfmpegStatusPanel
        ffmpegPath={ffmpegPath}
        ffmpegStatusMessage={ffmpegStatusMessage}
        ffmpegToolsStatus={ffmpegToolsStatus}
        ffprobePath={ffprobePath}
        onFfmpegPathChange={setFfmpegPath}
        onFfprobePathChange={setFfprobePath}
        onSaveConfiguredFfmpegPaths={saveConfiguredFfmpegPaths}
      />
    </Box>
  );
}


function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function scanRootRefreshSummaryMessage(refreshSummary: ScanRootRefreshSummary) {
  return `${refreshSummary.scannedVideoCount} Videos scanned, ${refreshSummary.unprocessableCandidateCount} Unprocessable Video Candidates`;
}
