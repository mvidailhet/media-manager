import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { open } from "@tauri-apps/plugin-dialog";

import {
  CatalogVideo,
  FfmpegToolsStatus,
  ScanRoot,
  ScanRootRemovalPolicy,
  UnprocessableVideoCandidate,
  addScanRoot,
  forgetCatalogVideo,
  generateMissingPreviewStrips,
  getFfmpegToolsStatus,
  getLocalDesktopAppStatus,
  listCatalogVideos,
  listScanRoots,
  listUnprocessableVideoCandidates,
  removeScanRoot,
  refreshAllScanRoots,
  refreshScanRoot,
  saveFfmpegConfiguration
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
const previewStripGenerationStartedMessage = "Generating Preview Strips...";
const millisecondsPerSecond = 1000;
const secondsPerMinute = 60;
const minutesPerHour = 60;
const bytesPerMegabyte = 1_000_000;
const firstPreviewStripFrameIndex = 0;
const previewStripPointerMinimum = 0;
const previewStripPointerMaximum = 1;
const percentageMultiplier = 100;

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
    catalogVideosLoadingMessage
  );
  const [scanRoots, setScanRoots] = useState<ScanRoot[]>([]);
  const [scanRootsStatusMessage, setScanRootsStatusMessage] = useState(
    scanRootsLoadingMessage
  );
  const [unprocessableVideoCandidates, setUnprocessableVideoCandidates] =
    useState<UnprocessableVideoCandidate[]>([]);
  const [reviewQueueStatusMessage, setReviewQueueStatusMessage] = useState(
    reviewQueueLoadingMessage
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
  const [isGeneratingPreviewStrips, setIsGeneratingPreviewStrips] =
    useState(false);

  async function loadCatalogVideos() {
    try {
      const storedCatalogVideos = await listCatalogVideos();

      setCatalogVideos(storedCatalogVideos);
      setCatalogVideosStatusMessage("");
    } catch {
      setCatalogVideosStatusMessage(catalogVideosErrorMessage);
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
      const storedUnprocessableVideoCandidates =
        await listUnprocessableVideoCandidates();

      setUnprocessableVideoCandidates(storedUnprocessableVideoCandidates);
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
    let canUpdateReviewQueue = true;

    async function loadInitialReviewQueue() {
      try {
        const storedUnprocessableVideoCandidates =
          await listUnprocessableVideoCandidates();

        if (canUpdateReviewQueue) {
          setUnprocessableVideoCandidates(storedUnprocessableVideoCandidates);
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

  async function saveConfiguredFfmpegPaths(event: React.FormEvent) {
    event.preventDefault();

    try {
      const status = await saveFfmpegConfiguration({
        ffmpegPath: normalizeConfiguredPath(ffmpegPath),
        ffprobePath: normalizeConfiguredPath(ffprobePath)
      });

      setFfmpegToolsStatus(status);
      setFfmpegPath(status.configuration.ffmpegPath ?? "");
      setFfprobePath(status.configuration.ffprobePath ?? "");
      setFfmpegStatusMessage("");
    } catch {
      setFfmpegStatusMessage(ffmpegErrorMessage);
    }
  }

  async function chooseScanRootFolder() {
    const selectedFolder = await open({
      directory: true,
      multiple: false
    });

    if (typeof selectedFolder === "string") {
      await persistScanRoot(selectedFolder);
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
      setScanRoots((currentScanRoots) =>
        [...currentScanRoots, scanRoot].sort((left, right) =>
          left.path.localeCompare(right.path)
        )
      );
      setManualScanRootPath("");
      setScanRootsStatusMessage("");
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
          (scanRoot) => scanRoot.path !== removedScanRoot.path
        )
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

  async function refreshSelectedScanRoot(scanRoot: ScanRoot) {
    try {
      setScanRootsStatusMessage(scanRootRefreshStartedMessage);
      const refreshSummary = await refreshScanRoot(scanRoot.path);

      setScanRootsStatusMessage(
        `${refreshSummary.scannedVideoCount} Videos scanned, ${refreshSummary.unprocessableCandidateCount} Unprocessable Video Candidates`
      );
      await loadScanRoots(false);
      await loadCatalogVideos();
      await loadReviewQueue(false);
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  async function refreshEveryScanRoot() {
    try {
      setScanRootsStatusMessage(scanRootRefreshStartedMessage);
      const refreshSummary = await refreshAllScanRoots();

      setScanRootsStatusMessage(
        `${refreshSummary.scannedVideoCount} Videos scanned, ${refreshSummary.unprocessableCandidateCount} Unprocessable Video Candidates`
      );
      await loadScanRoots(false);
      await loadCatalogVideos();
      await loadReviewQueue(false);
    } catch (error) {
      setScanRootsStatusMessage(errorMessage(error));
    }
  }

  async function generatePendingPreviewStrips() {
    try {
      setIsGeneratingPreviewStrips(true);
      setPreviewStripStatusMessage(previewStripGenerationStartedMessage);
      const generationSummary = await generateMissingPreviewStrips();

      setPreviewStripStatusMessage(
        `${generationSummary.generatedPreviewStripCount} Preview Strips generated, ${generationSummary.failedPreviewStripCount} Preview Strips failed`
      );
      await loadCatalogVideos();
    } catch (error) {
      setPreviewStripStatusMessage(errorMessage(error));
    } finally {
      setIsGeneratingPreviewStrips(false);
    }
  }

  const missingVideos = catalogVideos.filter(
    (catalogVideo) => !catalogVideo.isAvailable
  );
  const unavailableScanRoots = scanRoots.filter(
    (scanRoot) => !scanRoot.isAvailable
  );

  return (
    <Box component="main" className="app-shell">
      <WorkspaceHeader />
      <TauriStatusPanel localDesktopAppStatus={localDesktopAppStatus} />
      <CatalogVideosPanel
        catalogVideos={catalogVideos}
        catalogVideosStatusMessage={catalogVideosStatusMessage}
        isGeneratingPreviewStrips={isGeneratingPreviewStrips}
        onGeneratePendingPreviewStrips={generatePendingPreviewStrips}
        previewStripStatusMessage={previewStripStatusMessage}
      />
      <ReviewQueuePanel
        missingVideos={missingVideos}
        reviewQueueStatusMessage={reviewQueueStatusMessage}
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

function WorkspaceHeader() {
  return (
    <Box component="section" maw={720} aria-labelledby="videos-view-title">
      <Text c="dimmed" fw={700} size="sm" tt="uppercase">
        Local Desktop App
      </Text>
      <Title id="videos-view-title" order={1} mt={8} mb={12}>
        Videos View
      </Title>
      <Text c="dimmed" lh={1.6}>
        A local catalog workspace for organizing videos without a network
        dependency.
      </Text>
    </Box>
  );
}

function TauriStatusPanel({
  localDesktopAppStatus
}: {
  localDesktopAppStatus: string;
}) {
  return (
    <Paper component="section" aria-label="Tauri command status" p="md" maw={420}>
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
  catalogVideos,
  catalogVideosStatusMessage,
  isGeneratingPreviewStrips,
  onGeneratePendingPreviewStrips,
  previewStripStatusMessage
}: {
  catalogVideos: CatalogVideo[];
  catalogVideosStatusMessage: string;
  isGeneratingPreviewStrips: boolean;
  onGeneratePendingPreviewStrips: () => void;
  previewStripStatusMessage: string;
}) {
  return (
    <Paper component="section" aria-label="Catalog Videos" p="md" maw={760}>
      <Stack gap="md">
        <Group justify="space-between" align="start">
          <SectionHeader label="Catalog results" title="Videos" />
          <Button
            type="button"
            disabled={isGeneratingPreviewStrips}
            variant="default"
            onClick={() => void onGeneratePendingPreviewStrips()}
          >
            Generate Preview Strips
          </Button>
        </Group>

        {catalogVideosStatusMessage ? (
          <Text>{catalogVideosStatusMessage}</Text>
        ) : null}
        {previewStripStatusMessage ? <Text>{previewStripStatusMessage}</Text> : null}

        {!catalogVideosStatusMessage && catalogVideos.length === 0 ? (
          <Text c="dimmed">{catalogVideosEmptyMessage}</Text>
        ) : null}

        {catalogVideos.length > 0 ? (
          <Stack gap="sm">
            {catalogVideos.map((catalogVideo) => (
              <CatalogVideoCard
                catalogVideo={catalogVideo}
                key={catalogVideo.id}
              />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

function CatalogVideoCard({ catalogVideo }: { catalogVideo: CatalogVideo }) {
  return (
    <Stack component="article" gap="sm">
      <Divider />
      <PreviewStripSurface catalogVideo={catalogVideo} />
      <Box>
        <Group gap="xs" align="center">
          <Title order={3} size="h4">
            {catalogVideo.title}
          </Title>
          <AvailabilityBadge isAvailable={catalogVideo.isAvailable} />
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

function PreviewStripSurface({ catalogVideo }: { catalogVideo: CatalogVideo }) {
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(
    firstPreviewStripFrameIndex
  );
  const previewStrip = catalogVideo.previewStrip;

  if (previewStrip.status === "generated") {
    const previewStripUrl = convertFileSrc(previewStrip.path);
    const framePosition = previewStripFramePosition(
      selectedFrameIndex,
      previewStrip.columnCount,
      previewStrip.rowCount
    );

    return (
      <Box
        aria-label={`Preview Strip for ${catalogVideo.title}`}
        className="preview-strip preview-strip-generated"
        role="img"
        style={{
          backgroundImage: `url(${previewStripUrl})`,
          backgroundPosition: `${framePosition.x}% ${framePosition.y}%`,
          backgroundSize: `${previewStrip.columnCount * percentageMultiplier}% ${previewStrip.rowCount * percentageMultiplier}%`
        }}
        onPointerLeave={() => setSelectedFrameIndex(firstPreviewStripFrameIndex)}
        onPointerMove={(event) =>
          setSelectedFrameIndex(
            previewStripFrameIndexFromPointer(event, previewStrip.frameCount)
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

  return (
    <Box className="preview-strip preview-strip-placeholder">
      <Badge color="gray" variant="light">
        Pending Preview Strip
      </Badge>
    </Box>
  );
}

function ReviewQueuePanel({
  missingVideos,
  onRequestMissingVideoForget,
  reviewQueueStatusMessage,
  unavailableScanRoots,
  unprocessableVideoCandidates
}: {
  missingVideos: CatalogVideo[];
  onRequestMissingVideoForget: (catalogVideo: CatalogVideo) => void;
  reviewQueueStatusMessage: string;
  unavailableScanRoots: ScanRoot[];
  unprocessableVideoCandidates: UnprocessableVideoCandidate[];
}) {
  return (
    <Paper component="section" aria-label="Review Queue" p="md" maw={760}>
      <Stack gap="md">
        <SectionHeader label="Scan issues" title="Review Queue" />

        {reviewQueueStatusMessage ? <Text>{reviewQueueStatusMessage}</Text> : null}

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <MissingVideosPanel
            missingVideos={missingVideos}
            onRequestMissingVideoForget={onRequestMissingVideoForget}
          />
          <UnavailableScanRootsPanel unavailableScanRoots={unavailableScanRoots} />
          <UnprocessableCandidatesPanel
            unprocessableVideoCandidates={unprocessableVideoCandidates}
          />
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}

function MissingVideosPanel({
  missingVideos,
  onRequestMissingVideoForget
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
  unavailableScanRoots
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
  unprocessableVideoCandidates
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

function ScanRootsPanel({
  manualScanRootPath,
  onAddManualScanRoot,
  onChooseScanRootFolder,
  onManualScanRootPathChange,
  onRefreshEveryScanRoot,
  onRefreshSelectedScanRoot,
  onRequestScanRootRemoval,
  scanRoots,
  scanRootsStatusMessage
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
            <Button type="button" variant="light" onClick={onChooseScanRootFolder}>
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
  scanRoot
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
  onSaveConfiguredFfmpegPaths
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
    <Paper component="section" aria-label="FFmpeg tools status" p="md" maw={760}>
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
              )
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
  toolStatus
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
  missingLabel = "Unavailable"
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
  frameCount: number
) {
  const previewStripBounds = event.currentTarget.getBoundingClientRect();
  const pointerOffset = event.clientX - previewStripBounds.left;
  const pointerRatio = pointerOffset / previewStripBounds.width;
  const boundedPointerRatio = Math.min(
    previewStripPointerMaximum,
    Math.max(previewStripPointerMinimum, pointerRatio)
  );
  const lastFrameIndex = frameCount - 1;

  return Math.round(boundedPointerRatio * lastFrameIndex);
}

function previewStripFramePosition(
  frameIndex: number,
  columnCount: number,
  rowCount: number
) {
  const columnIndex = frameIndex % columnCount;
  const rowIndex = Math.floor(frameIndex / columnCount);
  const lastColumnIndex = Math.max(columnCount - 1, 1);
  const lastRowIndex = Math.max(rowCount - 1, 1);

  return {
    x: (columnIndex / lastColumnIndex) * percentageMultiplier,
    y: (rowIndex / lastRowIndex) * percentageMultiplier
  };
}

function DefinitionTerm({
  children,
  label
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
