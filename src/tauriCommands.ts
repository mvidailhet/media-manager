import { invoke } from "@tauri-apps/api/core";

const localDesktopAppStatusCommand = "get_local_desktop_app_status";
const listCatalogVideosCommand = "list_catalog_videos";
const listScanRootsCommand = "list_scan_roots";
const addScanRootCommand = "add_scan_root";
const checkScanRootAvailabilityCommand = "check_scan_root_availability";
const updateScanRootInferenceRulesCommand = "update_scan_root_inference_rules";
const removeScanRootCommand = "remove_scan_root";
const forgetCatalogVideoCommand = "forget_catalog_video";
const listTagsCommand = "list_tags";
const createTagCommand = "create_tag";
const updateTagCommand = "update_tag";
const deleteTagCommand = "delete_tag";
const listPerformersCommand = "list_performers";
const createPerformerCommand = "create_performer";
const updatePerformerCommand = "update_performer";
const deletePerformerCommand = "delete_performer";
const attachTagToVideoCommand = "attach_tag_to_video";
const detachTagFromVideoCommand = "detach_tag_from_video";
const tagsForVideoCommand = "tags_for_video";
const attachPerformerToVideoCommand = "attach_performer_to_video";
const detachPerformerFromVideoCommand = "detach_performer_from_video";
const performersForVideoCommand = "performers_for_video";
const updateVideoTitleCommand = "update_video_title";
const setVideoFavoriteCommand = "set_video_favorite";
const openCatalogVideoCommand = "open_catalog_video";
const openCatalogVideoContainingFolderCommand =
  "open_catalog_video_containing_folder";
const startScanRootRefreshJobCommand = "start_scan_root_refresh_job";
const cancelScanRootRefreshJobCommand = "cancel_scan_root_refresh_job";
const listUnprocessableVideoCandidatesByScanRootCommand =
  "list_unprocessable_video_candidates_by_scan_root";
const listFailedPreviewStripsCommand = "list_failed_preview_strips";
const listMetadataSuggestionGroupsCommand = "list_metadata_suggestion_groups";
const acceptMetadataSuggestionForVideosCommand =
  "accept_metadata_suggestion_for_videos";
const rejectMetadataSuggestionSourceCommand =
  "reject_metadata_suggestion_source";
const retryFailedPreviewStripCommand = "retry_failed_preview_strip";
const ignoreFailedPreviewStripCommand = "ignore_failed_preview_strip";
const getPreviewStripQueueStatusCommand = "get_preview_strip_queue_status";
const pausePreviewStripQueueCommand = "pause_preview_strip_queue";
const resumePreviewStripQueueCommand = "resume_preview_strip_queue";
const processNextPreviewStripQueueItemCommand =
  "process_next_preview_strip_queue_item";
const ffmpegToolsStatusCommand = "get_ffmpeg_tools_status";
const saveFfmpegConfigurationCommand = "save_ffmpeg_configuration";

export interface CatalogVideo {
  id: number;
  title: string;
  durationMilliseconds: number;
  fileSizeBytes: number | null;
  fileLocationPath: string | null;
  fileLocations: CatalogVideoFileLocation[];
  isAvailable: boolean;
  isFavorite: boolean;
  lastOpenedAt: string | null;
  openCount: number;
  previewStrip: PreviewStripStatus;
}

export interface CatalogVideoFileLocation {
  path: string;
  fileSizeBytes: number;
  isPreferred: boolean;
}

export type PreviewStripStatus =
  | {
      status: "generated";
      path: string;
      frameCount: number;
      columnCount: number;
      rowCount: number;
    }
  | {
      status: "failed";
      failureReason: string;
    }
  | {
      status: "pending";
    };

export interface ScanRoot {
  path: string;
  isAvailable: boolean;
  lastScanCompletedAt?: string | null;
  inferenceRules: ScanRootInferenceRules;
}

export interface ScanRootInferenceRules {
  suggestTagsFromFolderNames: boolean;
  suggestTagsFromFilenameBrackets: boolean;
  ignoredFolderNames: string[];
  ignoredExactYearRange: ExactYearRange;
}

export interface ExactYearRange {
  startYear: number;
  endYear: number;
}

export interface ScanRootRefreshSummary {
  scannedVideoCount: number;
  unprocessableCandidateCount: number;
}

export type ScanRootRefreshJobStatus =
  | "discovery"
  | "scanning"
  | "metadataSuggestionUpdate"
  | "complete"
  | "cancelled"
  | "failed";

export interface ScanRootRefreshJobProgress {
  scanRootPath: string;
  status: ScanRootRefreshJobStatus;
  processedVideoCandidateCount: number;
  totalVideoCandidateCount: number | null;
  scannedVideoCount: number;
  unprocessableCandidateCount: number;
  message: string | null;
}

export interface PreviewStripGenerationSummary {
  generatedPreviewStripCount: number;
  failedPreviewStripCount: number;
}

export interface PreviewStripQueueStatus {
  pendingCount: number;
  runningCount: number;
  runningVideoId: number | null;
  failedCount: number;
  isPaused: boolean;
}

export interface UnprocessableVideoCandidate {
  path: string;
  reason: string;
  fileSizeBytes: number;
}

export interface UnprocessableVideoCandidateGroup {
  scanRootPath: string;
  candidateCount: number;
  candidates: UnprocessableVideoCandidate[];
}

export interface FailedPreviewStrip {
  videoId: number;
  title: string;
  failureReason: string;
}

export interface MetadataSuggestionGroup {
  suggestedValue: string;
  suggestionKind: string;
  sources: MetadataSuggestionSourceGroup[];
}

export interface MetadataSuggestionSourceGroup {
  scanRootPath: string;
  sourcePathSegment: string;
  videos: MetadataSuggestionVideo[];
}

export interface MetadataSuggestionVideo {
  videoId: number;
  title: string;
  fileLocationPath: string;
}

export interface AcceptMetadataSuggestionForVideosRequest {
  scanRootPath: string;
  suggestedValue: string;
  sourcePathSegment: string;
  suggestionKind: string;
  acceptedMetadataKind?: string;
  acceptedValue?: string;
  videoIds: number[];
}

export interface RejectMetadataSuggestionSourceRequest {
  scanRootPath: string;
  sourcePathSegment: string;
  suggestedValue: string;
  suggestionKind: string;
}

export interface CatalogTag {
  id: number;
  name: string;
}

export interface CatalogPerformer {
  id: number;
  name: string;
}

export type VideoExtensionAllowlist = {
  extensions: string[];
};

export type ScanRootRemovalPolicy =
  | "preserveMissingVideos"
  | "forgetFromCatalog";

export type FfmpegConfiguration = {
  ffmpegPath: string | null;
  ffprobePath: string | null;
};

export type FfmpegToolStatus = {
  binaryName: string;
  isAvailable: boolean;
  resolvedPath: string | null;
  statusMessage: string;
};

export type FfmpegToolsStatus = {
  ffmpeg: FfmpegToolStatus;
  ffprobe: FfmpegToolStatus;
  configuration: FfmpegConfiguration;
};

export async function getLocalDesktopAppStatus(): Promise<string> {
  return invoke<string>(localDesktopAppStatusCommand);
}

export async function listCatalogVideos(): Promise<CatalogVideo[]> {
  return invoke<CatalogVideo[]>(listCatalogVideosCommand);
}

export async function listScanRoots(): Promise<ScanRoot[]> {
  return invoke<ScanRoot[]>(listScanRootsCommand);
}

export async function addScanRoot(path: string): Promise<ScanRoot> {
  return invoke<ScanRoot>(addScanRootCommand, { path });
}

export async function checkScanRootAvailability(path: string): Promise<ScanRoot> {
  return invoke<ScanRoot>(checkScanRootAvailabilityCommand, { path });
}

export async function updateScanRootInferenceRules(
  path: string,
  inferenceRules: ScanRootInferenceRules,
): Promise<ScanRoot> {
  return invoke<ScanRoot>(updateScanRootInferenceRulesCommand, {
    inferenceRules,
    path,
  });
}

export async function removeScanRoot(
  path: string,
  removalPolicy: ScanRootRemovalPolicy,
): Promise<void> {
  return invoke<void>(removeScanRootCommand, { path, removalPolicy });
}

export async function forgetCatalogVideo(videoId: number): Promise<void> {
  return invoke<void>(forgetCatalogVideoCommand, { videoId });
}

export async function listTags(): Promise<CatalogTag[]> {
  return invoke<CatalogTag[]>(listTagsCommand);
}

export async function createTag(name: string): Promise<CatalogTag> {
  return invoke<CatalogTag>(createTagCommand, { name });
}

export async function updateTag(
  tagId: number,
  name: string,
): Promise<CatalogTag> {
  return invoke<CatalogTag>(updateTagCommand, { tagId, name });
}

export async function deleteTag(tagId: number): Promise<void> {
  return invoke<void>(deleteTagCommand, { tagId });
}

export async function listPerformers(): Promise<CatalogPerformer[]> {
  return invoke<CatalogPerformer[]>(listPerformersCommand);
}

export async function createPerformer(name: string): Promise<CatalogPerformer> {
  return invoke<CatalogPerformer>(createPerformerCommand, { name });
}

export async function updatePerformer(
  performerId: number,
  name: string,
): Promise<CatalogPerformer> {
  return invoke<CatalogPerformer>(updatePerformerCommand, {
    performerId,
    name,
  });
}

export async function deletePerformer(performerId: number): Promise<void> {
  return invoke<void>(deletePerformerCommand, { performerId });
}

export async function attachTagToVideo(
  tagId: number,
  videoId: number,
): Promise<void> {
  return invoke<void>(attachTagToVideoCommand, { tagId, videoId });
}

export async function detachTagFromVideo(
  tagId: number,
  videoId: number,
): Promise<void> {
  return invoke<void>(detachTagFromVideoCommand, { tagId, videoId });
}

export async function tagsForVideo(videoId: number): Promise<CatalogTag[]> {
  return invoke<CatalogTag[]>(tagsForVideoCommand, { videoId });
}

export async function attachPerformerToVideo(
  performerId: number,
  videoId: number,
): Promise<void> {
  return invoke<void>(attachPerformerToVideoCommand, { performerId, videoId });
}

export async function detachPerformerFromVideo(
  performerId: number,
  videoId: number,
): Promise<void> {
  return invoke<void>(detachPerformerFromVideoCommand, {
    performerId,
    videoId,
  });
}

export async function performersForVideo(
  videoId: number,
): Promise<CatalogPerformer[]> {
  return invoke<CatalogPerformer[]>(performersForVideoCommand, { videoId });
}

export async function updateVideoTitle(
  videoId: number,
  title: string,
): Promise<void> {
  return invoke<void>(updateVideoTitleCommand, { videoId, title });
}

export async function setVideoFavorite(
  videoId: number,
  isFavorite: boolean,
): Promise<void> {
  return invoke<void>(setVideoFavoriteCommand, { videoId, isFavorite });
}

export async function openCatalogVideo(videoId: number): Promise<void> {
  return invoke<void>(openCatalogVideoCommand, { videoId });
}

export async function openCatalogVideoContainingFolder(
  videoId: number,
): Promise<void> {
  return invoke<void>(openCatalogVideoContainingFolderCommand, { videoId });
}

export async function startScanRootRefreshJob(
  path: string,
  videoExtensionAllowlist?: VideoExtensionAllowlist,
): Promise<void> {
  return invoke<void>(startScanRootRefreshJobCommand, {
    path,
    videoExtensionAllowlist: videoExtensionAllowlist ?? null,
  });
}

export async function cancelScanRootRefreshJob(path: string): Promise<void> {
  return invoke<void>(cancelScanRootRefreshJobCommand, { path });
}

export async function listUnprocessableVideoCandidatesByScanRoot(): Promise<
  UnprocessableVideoCandidateGroup[]
> {
  return invoke<UnprocessableVideoCandidateGroup[]>(
    listUnprocessableVideoCandidatesByScanRootCommand,
  );
}

export async function listFailedPreviewStrips(): Promise<FailedPreviewStrip[]> {
  return invoke<FailedPreviewStrip[]>(listFailedPreviewStripsCommand);
}

export async function listMetadataSuggestionGroups(): Promise<
  MetadataSuggestionGroup[]
> {
  return invoke<MetadataSuggestionGroup[]>(listMetadataSuggestionGroupsCommand);
}

export async function acceptMetadataSuggestionForVideos(
  request: AcceptMetadataSuggestionForVideosRequest,
): Promise<void> {
  return invoke<void>(acceptMetadataSuggestionForVideosCommand, { ...request });
}

export async function rejectMetadataSuggestionSource(
  request: RejectMetadataSuggestionSourceRequest,
): Promise<void> {
  return invoke<void>(rejectMetadataSuggestionSourceCommand, { ...request });
}

export async function retryFailedPreviewStrip(
  videoId: number,
): Promise<PreviewStripQueueStatus> {
  return invoke<PreviewStripQueueStatus>(retryFailedPreviewStripCommand, {
    videoId,
  });
}

export async function ignoreFailedPreviewStrip(
  videoId: number,
): Promise<PreviewStripQueueStatus> {
  return invoke<PreviewStripQueueStatus>(ignoreFailedPreviewStripCommand, {
    videoId,
  });
}

export async function getPreviewStripQueueStatus(): Promise<PreviewStripQueueStatus> {
  return invoke<PreviewStripQueueStatus>(getPreviewStripQueueStatusCommand);
}

export async function pausePreviewStripQueue(): Promise<PreviewStripQueueStatus> {
  return invoke<PreviewStripQueueStatus>(pausePreviewStripQueueCommand);
}

export async function resumePreviewStripQueue(): Promise<PreviewStripQueueStatus> {
  return invoke<PreviewStripQueueStatus>(resumePreviewStripQueueCommand);
}

export async function processNextPreviewStripQueueItem(): Promise<PreviewStripQueueStatus> {
  return invoke<PreviewStripQueueStatus>(
    processNextPreviewStripQueueItemCommand,
  );
}

export async function getFfmpegToolsStatus(): Promise<FfmpegToolsStatus> {
  return invoke<FfmpegToolsStatus>(ffmpegToolsStatusCommand);
}

export async function saveFfmpegConfiguration(
  configuration: FfmpegConfiguration,
): Promise<FfmpegToolsStatus> {
  return invoke<FfmpegToolsStatus>(saveFfmpegConfigurationCommand, {
    configuration,
  });
}
