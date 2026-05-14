import { useEffect, useState } from "react";
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
const millisecondsPerSecond = 1000;
const secondsPerMinute = 60;
const minutesPerHour = 60;
const bytesPerMegabyte = 1_000_000;

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

  const missingVideos = catalogVideos.filter(
    (catalogVideo) => !catalogVideo.isAvailable
  );
  const unavailableScanRoots = scanRoots.filter(
    (scanRoot) => !scanRoot.isAvailable
  );

  return (
    <Box component="main" className="app-shell">
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

      <Paper component="section" aria-label="Catalog Videos" p="md" maw={760}>
        <Stack gap="md">
          <SectionHeader label="Catalog results" title="Videos" />

          {catalogVideosStatusMessage ? (
            <Text>{catalogVideosStatusMessage}</Text>
          ) : null}

          {!catalogVideosStatusMessage && catalogVideos.length === 0 ? (
            <Text c="dimmed">{catalogVideosEmptyMessage}</Text>
          ) : null}

          {catalogVideos.length > 0 ? (
            <Stack gap="sm">
              {catalogVideos.map((catalogVideo) => (
                <Stack component="article" gap="sm" key={catalogVideo.id}>
                  <Divider />
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
                        <Code>{catalogVideo.fileLocationPath}</Code>
                      ) : (
                        "Missing"
                      )}
                    </DefinitionTerm>
                    <DefinitionTerm label="File Size">
                      {formatFileSize(catalogVideo.fileSizeBytes)}
                    </DefinitionTerm>
                  </Box>
                </Stack>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      <Paper component="section" aria-label="Review Queue" p="md" maw={760}>
        <Stack gap="md">
          <SectionHeader label="Scan issues" title="Review Queue" />

          {reviewQueueStatusMessage ? <Text>{reviewQueueStatusMessage}</Text> : null}

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
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
                        onClick={() => setMissingVideoPendingForget(missingVideo)}
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
                      <Code>{scanRoot.path}</Code>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Text c="dimmed">No Unavailable Scan Roots.</Text>
              )}
            </Stack>

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
                      <Code>{candidate.path}</Code>
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
          </SimpleGrid>
        </Stack>
      </Paper>

      <Paper component="section" aria-label="Scan Roots" p="md" maw={760}>
        <Stack gap="md">
          <Group justify="space-between" align="start">
            <SectionHeader label="Catalog sources" title="Scan Roots" />
            <Group gap="xs">
              <Button type="button" variant="light" onClick={chooseScanRootFolder}>
                Choose folder
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={() => void refreshEveryScanRoot()}
              >
                Refresh all Scan Roots
              </Button>
            </Group>
          </Group>

          {scanRootsStatusMessage ? <Text>{scanRootsStatusMessage}</Text> : null}

          <Box component="form" onSubmit={addManualScanRoot}>
            <Group align="end">
              <TextInput
                className="path-input"
                label="Manual path"
                value={manualScanRootPath}
                onChange={(event) => setManualScanRootPath(event.target.value)}
                placeholder="/Volumes/Archive/Videos"
              />
              <Button type="submit">Add path</Button>
            </Group>
          </Box>

          {scanRoots.length > 0 ? (
            <Stack gap="sm">
              {scanRoots.map((scanRoot) => (
                <Group
                  component="article"
                  gap="sm"
                  justify="space-between"
                  key={scanRoot.path}
                >
                  <Group gap="xs">
                    <Code>{scanRoot.path}</Code>
                    <AvailabilityBadge isAvailable={scanRoot.isAvailable} />
                  </Group>
                  <Group gap="xs">
                    <Button
                      type="button"
                      size="xs"
                      variant="default"
                      onClick={() => void refreshSelectedScanRoot(scanRoot)}
                    >
                      Refresh
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="light"
                      color="red"
                      onClick={() => setScanRootPendingRemoval(scanRoot)}
                    >
                      Remove
                    </Button>
                  </Group>
                </Group>
              ))}
            </Stack>
          ) : (
            <Text c="dimmed">No Scan Roots added.</Text>
          )}
        </Stack>
      </Paper>

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
            <Code>{scanRootPendingRemoval.path}</Code>
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

      <Paper component="section" aria-label="FFmpeg tools status" p="md" maw={760}>
        <Stack gap="md">
          <SectionHeader label="Video tooling" title="FFmpeg status" />

          {ffmpegStatusMessage ? <Text>{ffmpegStatusMessage}</Text> : null}

          {ffmpegToolsStatus ? (
            <Stack gap="sm">
              {[ffmpegToolsStatus.ffmpeg, ffmpegToolsStatus.ffprobe].map(
                (toolStatus) => (
                  <Group
                    component="article"
                    gap="md"
                    justify="space-between"
                    align="start"
                    key={toolStatus.binaryName}
                  >
                    <Box>
                      <Title order={3} size="h4">
                        {toolStatus.binaryName}
                      </Title>
                      <Text c="dimmed" lh={1.5}>
                        {toolStatus.statusMessage}
                      </Text>
                      {toolStatus.resolvedPath ? (
                        <Code mt={8}>{toolStatus.resolvedPath}</Code>
                      ) : null}
                    </Box>
                    <AvailabilityBadge
                      isAvailable={toolStatus.isAvailable}
                      missingLabel="Missing"
                    />
                  </Group>
                )
              )}
            </Stack>
          ) : null}

          <Box component="form" onSubmit={saveConfiguredFfmpegPaths}>
            <Stack gap="sm">
              <TextInput
                label="FFmpeg path"
                value={ffmpegPath}
                onChange={(event) => setFfmpegPath(event.target.value)}
                placeholder="Use PATH discovery"
              />
              <TextInput
                label="ffprobe path"
                value={ffprobePath}
                onChange={(event) => setFfprobePath(event.target.value)}
                placeholder="Use PATH discovery"
              />
              <Button type="submit" w="fit-content">
                Save paths
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>
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
