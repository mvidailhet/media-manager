import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Divider,
  Group,
  Loader,
  NativeSelect,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { open } from "@tauri-apps/plugin-dialog";

import {
  CatalogVideo,
  CatalogPerformer,
  CatalogTag,
  FailedPreviewStrip,
  FfmpegToolsStatus,
  PreviewStripQueueStatus,
  ScanRoot,
  ScanRootRemovalPolicy,
  UnprocessableVideoCandidate,
  addScanRoot,
  forgetCatalogVideo,
  getFfmpegToolsStatus,
  getLocalDesktopAppStatus,
  getPreviewStripQueueStatus,
  ignoreFailedPreviewStrip,
  listCatalogVideos,
  listPerformers,
  listFailedPreviewStrips,
  listScanRoots,
  listTags,
  listUnprocessableVideoCandidates,
  createPerformer,
  createTag,
  performersForVideo,
  pausePreviewStripQueue,
  processNextPreviewStripQueueItem,
  removeScanRoot,
  refreshAllScanRoots,
  refreshScanRoot,
  retryFailedPreviewStrip,
  resumePreviewStripQueue,
  saveFfmpegConfiguration,
  setVideoFavorite,
  tagsForVideo,
  updateVideoTitle,
  attachTagToVideo,
  detachTagFromVideo,
  attachPerformerToVideo,
  detachPerformerFromVideo,
} from "./tauriCommands";

const loadingStatusMessage = "Checking Rust command...";
const commandErrorMessage = "Rust command unavailable";
const ffmpegLoadingMessage = "Checking FFmpeg tools...";
const ffmpegErrorMessage = "FFmpeg status unavailable";
const catalogVideosLoadingMessage = "Loading Videos...";
const catalogVideosEmptyMessage = "No Videos in the Catalog.";
const catalogVideosErrorMessage = "Videos unavailable";
const scanRootsLoadingMessage = "Loading Scan Roots...";
const scanRootsErrorMessage = "Scan Roots unavailable";
const reviewQueueLoadingMessage = "Loading Review Queue...";
const reviewQueueErrorMessage = "Review Queue unavailable";
const scanRootRefreshStartedMessage = "Refreshing Scan Root...";
const previewStripQueueErrorMessage = "Preview Strip queue unavailable";
const millisecondsPerSecond = 1000;
const secondsPerMinute = 60;
const minutesPerHour = 60;
const bytesPerMegabyte = 1_000_000;
const firstPreviewStripFrameIndex = 0;
const previewStripPointerMinimum = 0;
const previewStripPointerMaximum = 1;
const percentageMultiplier = 100;
const previewStripQueuePollingIntervalMilliseconds = 250;
const emptyMetadataInputMessage = "Enter a name first.";
const minimumDurationMinutes = 0;
const maximumDurationMinutes = 24 * 60;

interface CatalogVideoMetadata {
  tags: CatalogTag[];
  performers: CatalogPerformer[];
}

interface CatalogVideoFilters {
  searchText: string;
  selectedTagIds: number[];
  selectedPerformerIds: number[];
  favoritesOnly: boolean;
  minimumDurationMinutes: number | "";
  maximumDurationMinutes: number | "";
}

type CatalogVideoSort = "titleAscending" | "fileSizeAscending" | "fileSizeDescending";
type CatalogVideoWorkspace = "videos" | "favorites";

const defaultCatalogVideoFilters: CatalogVideoFilters = {
  searchText: "",
  selectedTagIds: [],
  selectedPerformerIds: [],
  favoritesOnly: false,
  minimumDurationMinutes: "",
  maximumDurationMinutes: "",
};

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
  const [scanRoots, setScanRoots] = useState<ScanRoot[]>([]);
  const [scanRootsStatusMessage, setScanRootsStatusMessage] = useState(
    scanRootsLoadingMessage,
  );
  const [unprocessableVideoCandidates, setUnprocessableVideoCandidates] =
    useState<UnprocessableVideoCandidate[]>([]);
  const [failedPreviewStrips, setFailedPreviewStrips] = useState<
    FailedPreviewStrip[]
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
      const [storedUnprocessableVideoCandidates, storedFailedPreviewStrips] =
        await Promise.all([
          listUnprocessableVideoCandidates(),
          listFailedPreviewStrips(),
        ]);

      setUnprocessableVideoCandidates(storedUnprocessableVideoCandidates);
      setFailedPreviewStrips(storedFailedPreviewStrips);
      if (shouldClearStatusMessage) {
        setReviewQueueStatusMessage("");
      }
    } catch {
      setReviewQueueStatusMessage(reviewQueueErrorMessage);
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
    if (!previewStripQueueStatus || previewStripQueueStatus.runningCount === 0) {
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
        const [storedUnprocessableVideoCandidates, storedFailedPreviewStrips] =
          await Promise.all([
            listUnprocessableVideoCandidates(),
            listFailedPreviewStrips(),
          ]);

        if (canUpdateReviewQueue) {
          setUnprocessableVideoCandidates(storedUnprocessableVideoCandidates);
          setFailedPreviewStrips(storedFailedPreviewStrips);
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
      const updatedVideo = { ...video, isFavorite };
      setSelectedVideo((currentSelectedVideo) =>
        currentSelectedVideo?.id === updatedVideo.id
          ? updatedVideo
          : currentSelectedVideo,
      );
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
  const filteredCatalogVideos = sortedCatalogVideos(
    catalogVideos.filter((catalogVideo) =>
      catalogVideoMatchesFilters(
        catalogVideo,
        catalogVideoMetadataById[catalogVideo.id],
        activeCatalogVideoFilters,
      ),
    ),
    catalogVideoSort,
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
        catalogVideoFilters={catalogVideoFilters}
        catalogVideoWorkspace={catalogVideoWorkspace}
        catalogVideoSort={catalogVideoSort}
        catalogVideos={filteredCatalogVideos}
        catalogVideosStatusMessage={catalogVideosStatusMessage}
        onCatalogVideoFiltersChange={setCatalogVideoFilters}
        onCatalogVideoSortChange={setCatalogVideoSort}
        onCatalogVideoWorkspaceChange={setCatalogVideoWorkspace}
        onPausePreviewQueue={pausePreviewQueue}
        onResumePreviewQueue={resumePreviewQueue}
        onSelectVideo={selectVideoForDetail}
        onSetFavorite={setCatalogVideoFavorite}
        previewStripQueueStatus={previewStripQueueStatus}
        previewStripStatusMessage={previewStripStatusMessage}
      />
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

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <Box>
      <Text c="dimmed" fw={700} size="sm" tt="uppercase">
        {label}
      </Text>
      <Title order={2} size="h3" mt={6}>
        {title}
      </Title>
    </Box>
  );
}

function WorkspaceHeader({
  catalogVideoWorkspace,
}: {
  catalogVideoWorkspace: CatalogVideoWorkspace;
}) {
  const workspaceTitle =
    catalogVideoWorkspace === "favorites" ? "Favorites View" : "Videos View";

  return (
    <Box component="section" maw={720} aria-labelledby="videos-view-title">
      <Text c="dimmed" fw={700} size="sm" tt="uppercase">
        Local Desktop App
      </Text>
      <Title id="videos-view-title" order={1} mt={8} mb={12}>
        {workspaceTitle}
      </Title>
      <Text c="dimmed" lh={1.6}>
        A local catalog workspace for organizing videos without a network
        dependency.
      </Text>
    </Box>
  );
}

function TauriStatusPanel({
  localDesktopAppStatus,
}: {
  localDesktopAppStatus: string;
}) {
  return (
    <Paper
      component="section"
      aria-label="Tauri command status"
      p="md"
      maw={420}
    >
      <Stack gap={8}>
        <Text c="dimmed" fw={700} size="sm" tt="uppercase">
          Tauri bridge
        </Text>
        <Text c="teal" fw={700}>
          {localDesktopAppStatus}
        </Text>
      </Stack>
    </Paper>
  );
}

function CatalogVideosPanel({
  availablePerformers,
  availableTags,
  catalogVideoFilters,
  catalogVideoWorkspace,
  catalogVideoSort,
  catalogVideos,
  catalogVideosStatusMessage,
  onCatalogVideoFiltersChange,
  onCatalogVideoSortChange,
  onCatalogVideoWorkspaceChange,
  onPausePreviewQueue,
  onResumePreviewQueue,
  onSelectVideo,
  onSetFavorite,
  previewStripQueueStatus,
  previewStripStatusMessage,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  catalogVideoFilters: CatalogVideoFilters;
  catalogVideoWorkspace: CatalogVideoWorkspace;
  catalogVideoSort: CatalogVideoSort;
  catalogVideos: CatalogVideo[];
  catalogVideosStatusMessage: string;
  onCatalogVideoFiltersChange: (filters: CatalogVideoFilters) => void;
  onCatalogVideoSortChange: (sort: CatalogVideoSort) => void;
  onCatalogVideoWorkspaceChange: (workspace: CatalogVideoWorkspace) => void;
  onPausePreviewQueue: () => void;
  onResumePreviewQueue: () => void;
  onSelectVideo: (catalogVideo: CatalogVideo) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  previewStripQueueStatus: PreviewStripQueueStatus | null;
  previewStripStatusMessage: string;
}) {
  const panelTitle =
    catalogVideoWorkspace === "favorites" ? "Favorite Videos" : "Videos";

  return (
    <Paper component="section" aria-label="Catalog Videos" p="md" maw={760}>
      <Stack gap="md">
        <Group justify="space-between" align="start">
          <SectionHeader label="Catalog results" title={panelTitle} />
          <Group gap="xs">
            <Button
              type="button"
              variant={
                catalogVideoWorkspace === "videos" ? "filled" : "default"
              }
              onClick={() => onCatalogVideoWorkspaceChange("videos")}
            >
              Videos View
            </Button>
            <Button
              type="button"
              variant={
                catalogVideoWorkspace === "favorites" ? "filled" : "default"
              }
              onClick={() => onCatalogVideoWorkspaceChange("favorites")}
            >
              Favorites View
            </Button>
          </Group>
        </Group>

        <PreviewStripQueuePanel
          onPausePreviewQueue={onPausePreviewQueue}
          onResumePreviewQueue={onResumePreviewQueue}
          previewStripQueueStatus={previewStripQueueStatus}
        />

        <CatalogVideoFiltersPanel
          availablePerformers={availablePerformers}
          availableTags={availableTags}
          filters={catalogVideoFilters}
          onFiltersChange={onCatalogVideoFiltersChange}
        />

        <NativeSelect
          label="Sort Videos"
          value={catalogVideoSort}
          data={[
            { value: "titleAscending", label: "Title" },
            { value: "fileSizeAscending", label: "File Size ascending" },
            { value: "fileSizeDescending", label: "File Size descending" },
          ]}
          onChange={(event) =>
            onCatalogVideoSortChange(event.currentTarget.value as CatalogVideoSort)
          }
        />

        {catalogVideosStatusMessage ? (
          <Text>{catalogVideosStatusMessage}</Text>
        ) : null}
        {previewStripStatusMessage ? (
          <Text>{previewStripStatusMessage}</Text>
        ) : null}

        {!catalogVideosStatusMessage && catalogVideos.length === 0 ? (
          <Text c="dimmed">{catalogVideosEmptyMessage}</Text>
        ) : null}

        {catalogVideos.length > 0 ? (
          <Stack gap="sm">
            {catalogVideos.map((catalogVideo) => (
              <CatalogVideoCard
                catalogVideo={catalogVideo}
                key={catalogVideo.id}
                onSelectVideo={onSelectVideo}
                onSetFavorite={onSetFavorite}
                runningPreviewStripVideoId={
                  previewStripQueueStatus?.runningVideoId ?? null
                }
              />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

function CatalogVideoFiltersPanel({
  availablePerformers,
  availableTags,
  filters,
  onFiltersChange,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  filters: CatalogVideoFilters;
  onFiltersChange: (filters: CatalogVideoFilters) => void;
}) {
  function updateFilters(updatedFilters: Partial<CatalogVideoFilters>) {
    onFiltersChange({ ...filters, ...updatedFilters });
  }

  return (
    <Stack gap="sm" aria-label="Video Search Filters">
      <TextInput
        label="Search Videos"
        value={filters.searchText}
        onChange={(event) =>
          updateFilters({ searchText: event.currentTarget.value })
        }
      />
      <Group gap="md" align="end">
        <NumberInput
          label="Minimum duration minutes"
          min={minimumDurationMinutes}
          max={maximumDurationMinutes}
          value={filters.minimumDurationMinutes}
          onChange={(value) =>
            updateFilters({
              minimumDurationMinutes: numberFilterValue(value),
            })
          }
        />
        <NumberInput
          label="Maximum duration minutes"
          min={minimumDurationMinutes}
          max={maximumDurationMinutes}
          value={filters.maximumDurationMinutes}
          onChange={(value) =>
            updateFilters({
              maximumDurationMinutes: numberFilterValue(value),
            })
          }
        />
        <Checkbox
          label="Favorites only"
          checked={filters.favoritesOnly}
          onChange={(event) =>
            updateFilters({ favoritesOnly: event.currentTarget.checked })
          }
        />
      </Group>
      {availableTags.length > 0 ? (
        <Checkbox.Group
          label="Tags"
          value={filters.selectedTagIds.map(String)}
          onChange={(selectedValues) =>
            updateFilters({ selectedTagIds: selectedValues.map(Number) })
          }
        >
          <Group gap="sm" mt="xs">
            {availableTags.map((tag) => (
              <Checkbox key={tag.id} value={String(tag.id)} label={tag.name} />
            ))}
          </Group>
        </Checkbox.Group>
      ) : null}
      {availablePerformers.length > 0 ? (
        <Checkbox.Group
          label="Performers"
          value={filters.selectedPerformerIds.map(String)}
          onChange={(selectedValues) =>
            updateFilters({ selectedPerformerIds: selectedValues.map(Number) })
          }
        >
          <Group gap="sm" mt="xs">
            {availablePerformers.map((performer) => (
              <Checkbox
                key={performer.id}
                value={String(performer.id)}
                label={performer.name}
              />
            ))}
          </Group>
        </Checkbox.Group>
      ) : null}
    </Stack>
  );
}

function PreviewStripQueuePanel({
  onPausePreviewQueue,
  onResumePreviewQueue,
  previewStripQueueStatus,
}: {
  onPausePreviewQueue: () => void;
  onResumePreviewQueue: () => void;
  previewStripQueueStatus: PreviewStripQueueStatus | null;
}) {
  if (!previewStripQueueStatus) {
    return null;
  }
  const queueActivityLabel = previewStripQueueActivityLabel(
    previewStripQueueStatus,
  );

  return (
    <Group gap="xs" align="center">
      <Badge color={previewStripQueueStatus.isPaused ? "yellow" : "teal"}>
        {queueActivityLabel}
      </Badge>
      <Badge variant="light">
        {previewStripQueueStatus.pendingCount} pending
      </Badge>
      <Badge variant="light">
        {previewStripQueueStatus.runningCount} running
      </Badge>
      <Badge color="red" variant="light">
        {previewStripQueueStatus.failedCount} failed
      </Badge>
      {previewStripQueueStatus.isPaused ? (
        <Button
          type="button"
          size="xs"
          variant="default"
          onClick={() => void onResumePreviewQueue()}
        >
          Resume Preview Queue
        </Button>
      ) : (
        <Button
          type="button"
          size="xs"
          variant="default"
          onClick={() => void onPausePreviewQueue()}
        >
          Pause Preview Queue
        </Button>
      )}
    </Group>
  );
}

function previewStripQueueActivityLabel(
  previewStripQueueStatus: PreviewStripQueueStatus,
) {
  if (previewStripQueueStatus.isPaused) {
    return "Paused";
  }

  if (
    previewStripQueueStatus.runningCount === 0 &&
    previewStripQueueStatus.pendingCount === 0
  ) {
    return "Idle";
  }

  return "Running";
}

function CatalogVideoCard({
  catalogVideo,
  onSelectVideo,
  onSetFavorite,
  runningPreviewStripVideoId,
}: {
  catalogVideo: CatalogVideo;
  onSelectVideo: (catalogVideo: CatalogVideo) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  runningPreviewStripVideoId: number | null;
}) {
  const isGeneratingPreviewStrip = catalogVideo.id === runningPreviewStripVideoId;
  const favoriteButtonLabel = catalogVideo.isFavorite
    ? `Unmark ${catalogVideo.title} as Favorite`
    : `Mark ${catalogVideo.title} as Favorite`;

  return (
    <Stack component="article" gap="sm">
      <Divider />
      <PreviewStripSurface
        catalogVideo={catalogVideo}
        isGeneratingPreviewStrip={isGeneratingPreviewStrip}
      />
      <Box>
        <Group gap="xs" align="center">
          <Button
            type="button"
            variant="subtle"
            px={0}
            onClick={() => void onSelectVideo(catalogVideo)}
          >
            {catalogVideo.title}
          </Button>
          {catalogVideo.isFavorite ? (
            <Badge color="yellow">Favorite</Badge>
          ) : null}
          <AvailabilityBadge isAvailable={catalogVideo.isAvailable} />
          <Button
            type="button"
            size="xs"
            variant={catalogVideo.isFavorite ? "light" : "default"}
            onClick={() =>
              void onSetFavorite(catalogVideo, !catalogVideo.isFavorite)
            }
          >
            {favoriteButtonLabel}
          </Button>
        </Group>
        <Text c="dimmed">
          {formatDuration(catalogVideo.durationMilliseconds)}
        </Text>
      </Box>
      <Box component="dl" className="definition-list">
        <DefinitionTerm label="File Location">
          {catalogVideo.fileLocationPath ? (
            <Code className="wrapping-code">
              {catalogVideo.fileLocationPath}
            </Code>
          ) : (
            "Missing"
          )}
        </DefinitionTerm>
        <DefinitionTerm label="File Size">
          {formatFileSize(catalogVideo.fileSizeBytes)}
        </DefinitionTerm>
      </Box>
    </Stack>
  );
}

function PreviewStripSurface({
  catalogVideo,
  isGeneratingPreviewStrip,
}: {
  catalogVideo: CatalogVideo;
  isGeneratingPreviewStrip: boolean;
}) {
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(
    firstPreviewStripFrameIndex,
  );
  const previewStrip = catalogVideo.previewStrip;

  if (previewStrip.status === "generated") {
    const previewStripUrl = convertFileSrc(previewStrip.path);
    const framePosition = previewStripFramePosition(
      selectedFrameIndex,
      previewStrip.columnCount,
      previewStrip.rowCount,
    );

    return (
      <Box
        aria-label={`Preview Strip for ${catalogVideo.title}`}
        className="preview-strip preview-strip-generated"
        role="img"
        style={{
          backgroundImage: `url(${previewStripUrl})`,
          backgroundPosition: `${framePosition.x}% ${framePosition.y}%`,
          backgroundSize: `${previewStrip.columnCount * percentageMultiplier}% ${previewStrip.rowCount * percentageMultiplier}%`,
        }}
        onPointerLeave={() =>
          setSelectedFrameIndex(firstPreviewStripFrameIndex)
        }
        onPointerMove={(event) =>
          setSelectedFrameIndex(
            previewStripFrameIndexFromPointer(event, previewStrip.frameCount),
          )
        }
      />
    );
  }

  if (previewStrip.status === "failed") {
    return (
      <Box className="preview-strip preview-strip-placeholder">
        <Badge color="red" variant="light">
          Failed Preview Strip
        </Badge>
      </Box>
    );
  }

  if (isGeneratingPreviewStrip) {
    return (
      <Box className="preview-strip preview-strip-placeholder">
        <Group gap="xs">
          <Loader size="xs" />
          <Badge color="teal" variant="light">
            Generating Preview Strip
          </Badge>
        </Group>
      </Box>
    );
  }

  return (
    <Box className="preview-strip preview-strip-placeholder">
      <Badge color="gray" variant="light">
        Pending Preview Strip
      </Badge>
    </Box>
  );
}

function VideoDetailPanel({
  availablePerformers,
  availableTags,
  detailStatusMessage,
  onAttachPerformer,
  onAttachTag,
  onCreateOrAttachPerformer,
  onCreateOrAttachTag,
  onDetachPerformer,
  onDetachTag,
  onSaveTitle,
  onSetFavorite,
  selectedPerformers,
  selectedTags,
  video,
}: {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  detailStatusMessage: string;
  onAttachPerformer: (performer: CatalogPerformer) => void;
  onAttachTag: (tag: CatalogTag) => void;
  onCreateOrAttachPerformer: (name: string) => void;
  onCreateOrAttachTag: (name: string) => void;
  onDetachPerformer: (performer: CatalogPerformer) => void;
  onDetachTag: (tag: CatalogTag) => void;
  onSaveTitle: (title: string) => void;
  onSetFavorite: (isFavorite: boolean) => void;
  selectedPerformers: CatalogPerformer[];
  selectedTags: CatalogTag[];
  video: CatalogVideo;
}) {
  const [title, setTitle] = useState(video.title);
  const selectedTagIds = new Set(selectedTags.map((tag) => tag.id));
  const selectedPerformerIds = new Set(
    selectedPerformers.map((performer) => performer.id),
  );
  const attachableTags = availableTags.filter(
    (tag) => !selectedTagIds.has(tag.id),
  );
  const attachablePerformers = availablePerformers.filter(
    (performer) => !selectedPerformerIds.has(performer.id),
  );
  const fileLocations = video.fileLocations;

  useEffect(() => {
    setTitle(video.title);
  }, [video.id, video.title]);

  return (
    <Paper component="section" aria-label="Video Detail Panel" p="md" maw={760}>
      <Stack gap="md">
        <SectionHeader label="Selected Video" title="Video Detail Panel" />
        {detailStatusMessage ? <Text>{detailStatusMessage}</Text> : null}
        <Group align="end">
          <TextInput
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
          <Button type="button" onClick={() => void onSaveTitle(title)}>
            Save Title
          </Button>
        </Group>
        <Checkbox
          checked={video.isFavorite}
          label="Favorite"
          onChange={(event) => void onSetFavorite(event.currentTarget.checked)}
        />

        <Group gap="xl" align="start">
          <MetadataChecklist
            attachableItems={attachableTags}
            availableItems={availableTags}
            label="Tags"
            onAttach={onAttachTag}
            onCreateOrAttach={onCreateOrAttachTag}
            onDetach={onDetachTag}
            selectedItems={selectedTags}
          />
          <MetadataChecklist
            attachableItems={attachablePerformers}
            availableItems={availablePerformers}
            label="Performers"
            onAttach={onAttachPerformer}
            onCreateOrAttach={onCreateOrAttachPerformer}
            onDetach={onDetachPerformer}
            selectedItems={selectedPerformers}
          />
        </Group>

        <Box component="dl" className="definition-list">
          <DefinitionTerm label="Duration">
            {formatDuration(video.durationMilliseconds)}
          </DefinitionTerm>
          <DefinitionTerm label="File Size">
            {formatFileSize(video.fileSizeBytes)}
          </DefinitionTerm>
        </Box>

        <Stack gap="xs">
          <Title order={3} size="h4">
            File Locations
          </Title>
          {fileLocations.length > 0 ? (
            fileLocations.map((fileLocation) => (
              <Group key={fileLocation.path} gap="xs" align="center">
                <Code className="wrapping-code">{fileLocation.path}</Code>
                <Text c="dimmed">
                  {formatFileSize(fileLocation.fileSizeBytes)}
                </Text>
                {fileLocation.isPreferred ? (
                  <Badge>Preferred File Location</Badge>
                ) : null}
              </Group>
            ))
          ) : (
            <Text c="dimmed">Missing</Text>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

function MetadataChecklist<T extends { id: number; name: string }>({
  attachableItems,
  availableItems,
  label,
  onAttach,
  onCreateOrAttach,
  onDetach,
  selectedItems,
}: {
  attachableItems: T[];
  availableItems: T[];
  label: string;
  onAttach: (item: T) => void;
  onCreateOrAttach: (name: string) => void;
  onDetach: (item: T) => void;
  selectedItems: T[];
}) {
  const [newItemName, setNewItemName] = useState("");
  const trimmedNewItemName = newItemName.trim();
  const exactAvailableMatch = findMetadataByName(
    availableItems,
    trimmedNewItemName,
  );
  const exactAttachableMatch = findMetadataByName(
    attachableItems,
    trimmedNewItemName,
  );
  const isAlreadyAttached =
    exactAvailableMatch !== undefined && exactAttachableMatch === undefined;
  const nearMatch = findNearMetadataMatch(availableItems, trimmedNewItemName);
  const actionLabel = isAlreadyAttached
    ? `${singularMetadataLabel(label)} already attached`
    : exactAttachableMatch
    ? `Attach existing ${singularMetadataLabel(label)}`
    : `Create and attach ${singularMetadataLabel(label)}`;

  return (
    <Stack component="section" gap="xs" aria-label={label}>
      <Title order={3} size="h4">
        {label}
      </Title>
      <TextInput
        label={`New ${singularMetadataLabel(label)}`}
        value={newItemName}
        onChange={(event) => setNewItemName(event.currentTarget.value)}
      />
      {nearMatch ? <Text size="sm">Near match: {nearMatch.name}</Text> : null}
      <Button
        type="button"
        size="xs"
        variant="default"
        disabled={isAlreadyAttached}
        onClick={() => {
          void onCreateOrAttach(trimmedNewItemName);
          setNewItemName("");
        }}
      >
        {actionLabel}
      </Button>
      {selectedItems.map((item) => (
        <Button
          key={item.id}
          type="button"
          size="xs"
          variant="light"
          onClick={() => void onDetach(item)}
        >
          Remove {item.name}
        </Button>
      ))}
      {attachableItems.map((item) => (
        <Button
          key={item.id}
          type="button"
          size="xs"
          variant="default"
          onClick={() => void onAttach(item)}
        >
          Attach {item.name}
        </Button>
      ))}
    </Stack>
  );
}

function appendUniqueMetadata<T extends { id: number }>(items: T[], item: T) {
  if (items.some((currentItem) => currentItem.id === item.id)) {
    return items;
  }

  return [...items, item];
}

function findMetadataByName<T extends { name: string }>(items: T[], name: string) {
  const normalizedName = normalizedMetadataName(name);

  return items.find((item) => normalizedMetadataName(item.name) === normalizedName);
}

function findNearMetadataMatch<T extends { name: string }>(items: T[], name: string) {
  const normalizedName = normalizedMetadataName(name);

  if (normalizedName.length === 0) {
    return null;
  }

  return (
    items.find((item) => {
      const normalizedItemName = normalizedMetadataName(item.name);

      return (
        normalizedItemName !== normalizedName &&
        (normalizedItemName.includes(normalizedName) ||
          normalizedName.includes(normalizedItemName))
      );
    }) ?? null
  );
}

function normalizedMetadataName(name: string) {
  return name.trim().toLocaleLowerCase();
}

function singularMetadataLabel(label: string) {
  return label === "Tags" ? "Tag" : "Performer";
}

function ReviewQueuePanel({
  failedPreviewStrips,
  missingVideos,
  onIgnoreFailedPreview,
  onRequestMissingVideoForget,
  onRetryFailedPreview,
  reviewQueueStatusMessage,
  unavailableScanRoots,
  unprocessableVideoCandidates,
}: {
  failedPreviewStrips: FailedPreviewStrip[];
  missingVideos: CatalogVideo[];
  onIgnoreFailedPreview: (failedPreviewStrip: FailedPreviewStrip) => void;
  onRequestMissingVideoForget: (catalogVideo: CatalogVideo) => void;
  onRetryFailedPreview: (failedPreviewStrip: FailedPreviewStrip) => void;
  reviewQueueStatusMessage: string;
  unavailableScanRoots: ScanRoot[];
  unprocessableVideoCandidates: UnprocessableVideoCandidate[];
}) {
  return (
    <Paper component="section" aria-label="Review Queue" p="md" maw={760}>
      <Stack gap="md">
        <SectionHeader label="Scan issues" title="Review Queue" />

        {reviewQueueStatusMessage ? (
          <Text>{reviewQueueStatusMessage}</Text>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <MissingVideosPanel
            missingVideos={missingVideos}
            onRequestMissingVideoForget={onRequestMissingVideoForget}
          />
          <UnavailableScanRootsPanel
            unavailableScanRoots={unavailableScanRoots}
          />
          <UnprocessableCandidatesPanel
            unprocessableVideoCandidates={unprocessableVideoCandidates}
          />
          <FailedPreviewStripsPanel
            failedPreviewStrips={failedPreviewStrips}
            onIgnoreFailedPreview={onIgnoreFailedPreview}
            onRetryFailedPreview={onRetryFailedPreview}
          />
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}

function MissingVideosPanel({
  missingVideos,
  onRequestMissingVideoForget,
}: {
  missingVideos: CatalogVideo[];
  onRequestMissingVideoForget: (catalogVideo: CatalogVideo) => void;
}) {
  return (
    <Stack component="section" gap="xs" aria-labelledby="missing-videos-title">
      <Title order={3} id="missing-videos-title" size="h4">
        Missing Videos
      </Title>
      {missingVideos.length > 0 ? (
        <Stack gap="sm">
          {missingVideos.map((missingVideo) => (
            <Stack component="article" gap="xs" key={missingVideo.id}>
              <Divider />
              <Box>
                <Title order={4} size="h5">
                  {missingVideo.title}
                </Title>
                <Text c="dimmed">
                  {formatDuration(missingVideo.durationMilliseconds)}
                </Text>
              </Box>
              <Button
                type="button"
                size="xs"
                variant="light"
                onClick={() => onRequestMissingVideoForget(missingVideo)}
              >
                Forget From Catalog
              </Button>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed">No Missing Videos.</Text>
      )}
    </Stack>
  );
}

function UnavailableScanRootsPanel({
  unavailableScanRoots,
}: {
  unavailableScanRoots: ScanRoot[];
}) {
  return (
    <Stack
      component="section"
      gap="xs"
      aria-labelledby="unavailable-scan-roots-title"
    >
      <Title order={3} id="unavailable-scan-roots-title" size="h4">
        Unavailable Scan Roots
      </Title>
      {unavailableScanRoots.length > 0 ? (
        <Stack gap="sm">
          {unavailableScanRoots.map((scanRoot) => (
            <Stack component="article" gap="xs" key={scanRoot.path}>
              <Divider />
              <Code className="wrapping-code">{scanRoot.path}</Code>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed">No Unavailable Scan Roots.</Text>
      )}
    </Stack>
  );
}

function UnprocessableCandidatesPanel({
  unprocessableVideoCandidates,
}: {
  unprocessableVideoCandidates: UnprocessableVideoCandidate[];
}) {
  return (
    <Stack
      component="section"
      gap="xs"
      aria-labelledby="unprocessable-candidates-title"
    >
      <Title order={3} id="unprocessable-candidates-title" size="h4">
        Unprocessable Video Candidates
      </Title>
      {unprocessableVideoCandidates.length > 0 ? (
        <Stack gap="sm">
          {unprocessableVideoCandidates.map((candidate) => (
            <Stack component="article" gap="xs" key={candidate.path}>
              <Divider />
              <Code className="wrapping-code">{candidate.path}</Code>
              <Box component="dl" className="definition-list">
                <DefinitionTerm label="Failure Reason">
                  {candidate.reason}
                </DefinitionTerm>
                <DefinitionTerm label="File Size">
                  {formatFileSize(candidate.fileSizeBytes)}
                </DefinitionTerm>
              </Box>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed">No Unprocessable Video Candidates.</Text>
      )}
    </Stack>
  );
}

function FailedPreviewStripsPanel({
  failedPreviewStrips,
  onIgnoreFailedPreview,
  onRetryFailedPreview,
}: {
  failedPreviewStrips: FailedPreviewStrip[];
  onIgnoreFailedPreview: (failedPreviewStrip: FailedPreviewStrip) => void;
  onRetryFailedPreview: (failedPreviewStrip: FailedPreviewStrip) => void;
}) {
  return (
    <Stack
      component="section"
      gap="xs"
      aria-labelledby="failed-preview-strips-title"
    >
      <Title order={3} id="failed-preview-strips-title" size="h4">
        Failed Preview Strips
      </Title>
      {failedPreviewStrips.length > 0 ? (
        <Stack gap="sm">
          {failedPreviewStrips.map((failedPreviewStrip) => (
            <Stack
              component="article"
              gap="xs"
              key={failedPreviewStrip.videoId}
            >
              <Divider />
              <Box>
                <Title order={4} size="h5">
                  {failedPreviewStrip.title}
                </Title>
                <Box component="dl" className="definition-list">
                  <DefinitionTerm label="Failure Reason">
                    {failedPreviewStrip.failureReason}
                  </DefinitionTerm>
                </Box>
              </Box>
              <Group gap="xs">
                <Button
                  type="button"
                  size="xs"
                  variant="light"
                  aria-label={`Retry Failed Preview Strip for ${failedPreviewStrip.title}`}
                  onClick={() => void onRetryFailedPreview(failedPreviewStrip)}
                >
                  Retry
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="default"
                  aria-label={`Ignore Failed Preview Strip for ${failedPreviewStrip.title}`}
                  onClick={() => void onIgnoreFailedPreview(failedPreviewStrip)}
                >
                  Ignore
                </Button>
              </Group>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed">No Failed Preview Strips.</Text>
      )}
    </Stack>
  );
}

function ScanRootsPanel({
  manualScanRootPath,
  onAddManualScanRoot,
  onChooseScanRootFolder,
  onManualScanRootPathChange,
  onRefreshEveryScanRoot,
  onRefreshSelectedScanRoot,
  onRequestScanRootRemoval,
  scanRoots,
  scanRootsStatusMessage,
}: {
  manualScanRootPath: string;
  onAddManualScanRoot: (event: React.FormEvent) => void;
  onChooseScanRootFolder: () => void;
  onManualScanRootPathChange: (path: string) => void;
  onRefreshEveryScanRoot: () => void;
  onRefreshSelectedScanRoot: (scanRoot: ScanRoot) => void;
  onRequestScanRootRemoval: (scanRoot: ScanRoot) => void;
  scanRoots: ScanRoot[];
  scanRootsStatusMessage: string;
}) {
  return (
    <Paper component="section" aria-label="Scan Roots" p="md" maw={760}>
      <Stack gap="md">
        <Group justify="space-between" align="start">
          <SectionHeader label="Catalog sources" title="Scan Roots" />
          <Group gap="xs">
            <Button
              type="button"
              variant="light"
              onClick={onChooseScanRootFolder}
            >
              Choose folder
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => void onRefreshEveryScanRoot()}
            >
              Refresh all Scan Roots
            </Button>
          </Group>
        </Group>

        {scanRootsStatusMessage ? <Text>{scanRootsStatusMessage}</Text> : null}

        <Box component="form" onSubmit={onAddManualScanRoot}>
          <Group align="end">
            <TextInput
              className="path-input"
              label="Manual path"
              value={manualScanRootPath}
              onChange={(event) =>
                onManualScanRootPathChange(event.target.value)
              }
              placeholder="/Volumes/Archive/Videos"
            />
            <Button type="submit">Add path</Button>
          </Group>
        </Box>

        {scanRoots.length > 0 ? (
          <Stack gap="sm">
            {scanRoots.map((scanRoot) => (
              <ScanRootCard
                key={scanRoot.path}
                onRefreshSelectedScanRoot={onRefreshSelectedScanRoot}
                onRequestScanRootRemoval={onRequestScanRootRemoval}
                scanRoot={scanRoot}
              />
            ))}
          </Stack>
        ) : (
          <Text c="dimmed">No Scan Roots added.</Text>
        )}
      </Stack>
    </Paper>
  );
}

function ScanRootCard({
  onRefreshSelectedScanRoot,
  onRequestScanRootRemoval,
  scanRoot,
}: {
  onRefreshSelectedScanRoot: (scanRoot: ScanRoot) => void;
  onRequestScanRootRemoval: (scanRoot: ScanRoot) => void;
  scanRoot: ScanRoot;
}) {
  return (
    <Group component="article" gap="sm" justify="space-between">
      <Group gap="xs">
        <Code className="wrapping-code">{scanRoot.path}</Code>
        <AvailabilityBadge isAvailable={scanRoot.isAvailable} />
      </Group>
      <Group gap="xs">
        <Button
          type="button"
          size="xs"
          variant="default"
          onClick={() => void onRefreshSelectedScanRoot(scanRoot)}
        >
          Refresh
        </Button>
        <Button
          type="button"
          size="xs"
          variant="light"
          color="red"
          onClick={() => onRequestScanRootRemoval(scanRoot)}
        >
          Remove
        </Button>
      </Group>
    </Group>
  );
}

function FfmpegStatusPanel({
  ffmpegPath,
  ffmpegStatusMessage,
  ffmpegToolsStatus,
  ffprobePath,
  onFfmpegPathChange,
  onFfprobePathChange,
  onSaveConfiguredFfmpegPaths,
}: {
  ffmpegPath: string;
  ffmpegStatusMessage: string;
  ffmpegToolsStatus: FfmpegToolsStatus | null;
  ffprobePath: string;
  onFfmpegPathChange: (path: string) => void;
  onFfprobePathChange: (path: string) => void;
  onSaveConfiguredFfmpegPaths: (event: React.FormEvent) => void;
}) {
  return (
    <Paper
      component="section"
      aria-label="FFmpeg tools status"
      p="md"
      maw={760}
    >
      <Stack gap="md">
        <SectionHeader label="Video tooling" title="FFmpeg status" />

        {ffmpegStatusMessage ? <Text>{ffmpegStatusMessage}</Text> : null}

        {ffmpegToolsStatus ? (
          <Stack gap="sm">
            {[ffmpegToolsStatus.ffmpeg, ffmpegToolsStatus.ffprobe].map(
              (toolStatus) => (
                <FfmpegToolStatusCard
                  key={toolStatus.binaryName}
                  toolStatus={toolStatus}
                />
              ),
            )}
          </Stack>
        ) : null}

        <Box component="form" onSubmit={onSaveConfiguredFfmpegPaths}>
          <Stack gap="sm">
            <TextInput
              label="FFmpeg path"
              value={ffmpegPath}
              onChange={(event) => onFfmpegPathChange(event.target.value)}
              placeholder="Use PATH discovery"
            />
            <TextInput
              label="ffprobe path"
              value={ffprobePath}
              onChange={(event) => onFfprobePathChange(event.target.value)}
              placeholder="Use PATH discovery"
            />
            <Button type="submit" w="fit-content">
              Save paths
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

function FfmpegToolStatusCard({
  toolStatus,
}: {
  toolStatus: FfmpegToolsStatus["ffmpeg"];
}) {
  return (
    <Group component="article" gap="md" justify="space-between" align="start">
      <Box>
        <Title order={3} size="h4">
          {toolStatus.binaryName}
        </Title>
        <Text c="dimmed" lh={1.5}>
          {toolStatus.statusMessage}
        </Text>
        {toolStatus.resolvedPath ? (
          <Code className="wrapping-code" mt={8}>
            {toolStatus.resolvedPath}
          </Code>
        ) : null}
      </Box>
      <AvailabilityBadge
        isAvailable={toolStatus.isAvailable}
        missingLabel="Missing"
      />
    </Group>
  );
}

function AvailabilityBadge({
  isAvailable,
  missingLabel = "Unavailable",
}: {
  isAvailable: boolean;
  missingLabel?: string;
}) {
  return (
    <Badge color={isAvailable ? "teal" : "red"} variant="light">
      {isAvailable ? "Available" : missingLabel}
    </Badge>
  );
}

function previewStripFrameIndexFromPointer(
  event: React.PointerEvent<HTMLElement>,
  frameCount: number,
) {
  const previewStripBounds = event.currentTarget.getBoundingClientRect();
  const pointerOffset = event.clientX - previewStripBounds.left;
  const pointerRatio = pointerOffset / previewStripBounds.width;
  const boundedPointerRatio = Math.min(
    previewStripPointerMaximum,
    Math.max(previewStripPointerMinimum, pointerRatio),
  );
  const lastFrameIndex = frameCount - 1;

  return Math.round(boundedPointerRatio * lastFrameIndex);
}

function previewStripFramePosition(
  frameIndex: number,
  columnCount: number,
  rowCount: number,
) {
  const columnIndex = frameIndex % columnCount;
  const rowIndex = Math.floor(frameIndex / columnCount);
  const lastColumnIndex = Math.max(columnCount - 1, 1);
  const lastRowIndex = Math.max(rowCount - 1, 1);

  return {
    x: (columnIndex / lastColumnIndex) * percentageMultiplier,
    y: (rowIndex / lastRowIndex) * percentageMultiplier,
  };
}

function DefinitionTerm({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Box>
      <Text component="dt" c="dimmed" fw={700} size="xs" tt="uppercase">
        {label}
      </Text>
      <Text component="dd" className="definition-value">
        {children}
      </Text>
    </Box>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function scanRootRefreshSummaryMessage(refreshSummary: {
  scannedVideoCount: number;
  unprocessableCandidateCount: number;
}) {
  return `${refreshSummary.scannedVideoCount} Videos scanned, ${refreshSummary.unprocessableCandidateCount} Unprocessable Video Candidates`;
}

function numberFilterValue(value: string | number) {
  return typeof value === "number" ? value : "";
}

function catalogVideoMatchesFilters(
  catalogVideo: CatalogVideo,
  metadata: CatalogVideoMetadata | undefined,
  filters: CatalogVideoFilters,
) {
  return (
    catalogVideoMatchesSearchText(catalogVideo, filters.searchText) &&
    catalogVideoMatchesFavoriteFilter(catalogVideo, filters.favoritesOnly) &&
    catalogVideoMatchesDurationFilter(catalogVideo, filters) &&
    catalogVideoMatchesTagFilter(metadata, filters.selectedTagIds) &&
    catalogVideoMatchesPerformerFilter(metadata, filters.selectedPerformerIds)
  );
}

function catalogVideoMatchesSearchText(
  catalogVideo: CatalogVideo,
  searchText: string,
) {
  const normalizedSearchText = searchText.trim().toLocaleLowerCase();

  if (normalizedSearchText.length === 0) {
    return true;
  }

  const searchableValues = [
    catalogVideo.title,
    currentFilename(catalogVideo.fileLocationPath),
  ].map((value) => value.toLocaleLowerCase());

  return searchableValues.some((value) => value.includes(normalizedSearchText));
}

function currentFilename(fileLocationPath: string | null) {
  if (!fileLocationPath) {
    return "";
  }

  const pathParts = fileLocationPath.split(/[/\\]/);

  return pathParts[pathParts.length - 1] ?? "";
}

function catalogVideoMatchesFavoriteFilter(
  catalogVideo: CatalogVideo,
  favoritesOnly: boolean,
) {
  return !favoritesOnly || catalogVideo.isFavorite;
}

function catalogVideoMatchesDurationFilter(
  catalogVideo: CatalogVideo,
  filters: CatalogVideoFilters,
) {
  const durationMinutes =
    catalogVideo.durationMilliseconds / millisecondsPerSecond / secondsPerMinute;
  const minimumMinutes = filters.minimumDurationMinutes;
  const maximumMinutes = filters.maximumDurationMinutes;

  if (minimumMinutes !== "" && durationMinutes < minimumMinutes) {
    return false;
  }

  if (maximumMinutes !== "" && durationMinutes > maximumMinutes) {
    return false;
  }

  return true;
}

function catalogVideoMatchesTagFilter(
  metadata: CatalogVideoMetadata | undefined,
  selectedTagIds: number[],
) {
  if (selectedTagIds.length === 0) {
    return true;
  }

  const videoTagIds = new Set(metadata?.tags.map((tag) => tag.id) ?? []);

  return selectedTagIds.every((tagId) => videoTagIds.has(tagId));
}

function catalogVideoMatchesPerformerFilter(
  metadata: CatalogVideoMetadata | undefined,
  selectedPerformerIds: number[],
) {
  if (selectedPerformerIds.length === 0) {
    return true;
  }

  const videoPerformerIds = new Set(
    metadata?.performers.map((performer) => performer.id) ?? [],
  );

  return selectedPerformerIds.some((performerId) =>
    videoPerformerIds.has(performerId),
  );
}

function sortedCatalogVideos(
  catalogVideos: CatalogVideo[],
  catalogVideoSort: CatalogVideoSort,
) {
  return [...catalogVideos].sort((firstVideo, secondVideo) => {
    const fileSizeNullSortResult = fileSizeNullSortOrder(firstVideo, secondVideo);

    if (fileSizeNullSortResult !== 0 && catalogVideoSort !== "titleAscending") {
      return fileSizeNullSortResult;
    }

    if (catalogVideoSort === "fileSizeAscending") {
      return firstVideo.fileSizeBytes! - secondVideo.fileSizeBytes!;
    }

    if (catalogVideoSort === "fileSizeDescending") {
      return secondVideo.fileSizeBytes! - firstVideo.fileSizeBytes!;
    }

    return firstVideo.title.localeCompare(secondVideo.title);
  });
}

function fileSizeNullSortOrder(
  firstVideo: CatalogVideo,
  secondVideo: CatalogVideo,
) {
  if (firstVideo.fileSizeBytes === null && secondVideo.fileSizeBytes === null) {
    return 0;
  }

  if (firstVideo.fileSizeBytes === null) {
    return 1;
  }

  if (secondVideo.fileSizeBytes === null) {
    return -1;
  }

  return 0;
}

function formatDuration(durationMilliseconds: number) {
  const totalSeconds = Math.round(durationMilliseconds / millisecondsPerSecond);
  const totalMinutes = Math.floor(totalSeconds / secondsPerMinute);
  const hours = Math.floor(totalMinutes / minutesPerHour);
  const minutes = totalMinutes % minutesPerHour;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function formatFileSize(fileSizeBytes: number | null) {
  if (fileSizeBytes === null) {
    return "Unknown";
  }

  const megabytes = fileSizeBytes / bytesPerMegabyte;

  return `${megabytes.toFixed(1)} MB`;
}
