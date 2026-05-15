import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addScanRoot,
  forgetCatalogVideo,
  getPreviewStripQueueStatus,
  getFfmpegToolsStatus,
  getLocalDesktopAppStatus,
  ignoreFailedPreviewStrip,
  attachPerformerToVideo,
  attachTagToVideo,
  createPerformer,
  createTag,
  deletePerformer,
  deleteTag,
  detachPerformerFromVideo,
  detachTagFromVideo,
  performersForVideo,
  listFailedPreviewStrips,
  listMetadataSuggestionGroups,
  listPerformers,
  listTags,
  listUnprocessableVideoCandidates,
  listCatalogVideos,
  listScanRoots,
  pausePreviewStripQueue,
  removeScanRoot,
  refreshAllScanRoots,
  refreshScanRoot,
  retryFailedPreviewStrip,
  resumePreviewStripQueue,
  saveFfmpegConfiguration,
  setVideoFavorite,
  openCatalogVideo,
  updatePerformer,
  updateScanRootInferenceRules,
  tagsForVideo,
  updateVideoTitle,
  updateTag,
} from "./tauriCommands";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

describe("Tauri commands", () => {
  beforeEach(() => {
    mockedInvoke.mockResolvedValue("Local command response");
  });

  it("calls the typed Rust command for the Local Desktop App status", async () => {
    const status = await getLocalDesktopAppStatus();

    expect(status).toBe("Local command response");
    expect(mockedInvoke).toHaveBeenCalledWith("get_local_desktop_app_status");
  });

  it("calls the typed Rust command for listed Catalog Videos", async () => {
    mockedInvoke.mockResolvedValue([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        previewStrip: {
          status: "pending",
        },
      },
    ]);

    const videos = await listCatalogVideos();

    expect(videos).toEqual([
      {
        id: 1,
        title: "Family Trip",
        durationMilliseconds: 3723000,
        fileSizeBytes: 80740352,
        fileLocationPath: "/Volumes/Archive/Videos/family-trip.mp4",
        isAvailable: true,
        previewStrip: {
          status: "pending",
        },
      },
    ]);
    expect(mockedInvoke).toHaveBeenCalledWith("list_catalog_videos");
  });

  it("calls the typed Rust command for opening a Catalog Video", async () => {
    await openCatalogVideo(7);

    expect(mockedInvoke).toHaveBeenCalledWith("open_catalog_video", {
      videoId: 7,
    });
  });

  it("calls the typed Rust command for persisted Scan Roots", async () => {
    mockedInvoke.mockResolvedValue([
      {
        inferenceRules: {
          ignoredExactYearRange: {
            endYear: 2099,
            startYear: 1900,
          },
          ignoredFolderNames: ["Misc", "Unsorted"],
          suggestPerformersFromChildFolders: false,
          suggestTagsFromChildFolders: true,
        },
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
    ]);

    const scanRoots = await listScanRoots();

    expect(scanRoots).toEqual([
      {
        inferenceRules: {
          ignoredExactYearRange: {
            endYear: 2099,
            startYear: 1900,
          },
          ignoredFolderNames: ["Misc", "Unsorted"],
          suggestPerformersFromChildFolders: false,
          suggestTagsFromChildFolders: true,
        },
        isAvailable: true,
        path: "/Volumes/Archive/Videos",
      },
    ]);
    expect(mockedInvoke).toHaveBeenCalledWith("list_scan_roots");
  });

  it("adds a Scan Root through the Rust command", async () => {
    await addScanRoot("/Volumes/Archive/Videos");

    expect(mockedInvoke).toHaveBeenCalledWith("add_scan_root", {
      path: "/Volumes/Archive/Videos",
    });
  });

  it("updates Scan Root Inference Rules through the Rust command", async () => {
    await updateScanRootInferenceRules("/Volumes/Archive/Videos", {
      ignoredExactYearRange: {
        endYear: 2099,
        startYear: 1900,
      },
      ignoredFolderNames: ["Misc", "Temp"],
      suggestPerformersFromChildFolders: false,
      suggestTagsFromChildFolders: true,
    });

    expect(mockedInvoke).toHaveBeenCalledWith(
      "update_scan_root_inference_rules",
      {
        inferenceRules: {
          ignoredExactYearRange: {
            endYear: 2099,
            startYear: 1900,
          },
          ignoredFolderNames: ["Misc", "Temp"],
          suggestPerformersFromChildFolders: false,
          suggestTagsFromChildFolders: true,
        },
        path: "/Volumes/Archive/Videos",
      },
    );
  });

  it("removes a Scan Root through the Rust command with the selected catalog policy", async () => {
    await removeScanRoot("/Volumes/Archive/Videos", "preserveMissingVideos");

    expect(mockedInvoke).toHaveBeenCalledWith("remove_scan_root", {
      path: "/Volumes/Archive/Videos",
      removalPolicy: "preserveMissingVideos",
    });
  });

  it("forgets one Catalog Video through the Rust command", async () => {
    await forgetCatalogVideo(7);

    expect(mockedInvoke).toHaveBeenCalledWith("forget_catalog_video", {
      videoId: 7,
    });
  });

  it("refreshes one selected Scan Root through the Rust command", async () => {
    mockedInvoke.mockResolvedValue({
      scannedVideoCount: 1,
      unprocessableCandidateCount: 0,
    });

    const refreshSummary = await refreshScanRoot("/Volumes/Archive/Videos");

    expect(refreshSummary).toEqual({
      scannedVideoCount: 1,
      unprocessableCandidateCount: 0,
    });
    expect(mockedInvoke).toHaveBeenCalledWith("refresh_scan_root", {
      path: "/Volumes/Archive/Videos",
      videoExtensionAllowlist: null,
    });
  });

  it("passes a configured Video Extension Allowlist to Scan Root refresh", async () => {
    const videoExtensionAllowlist = {
      extensions: [".mp4", ".flv"],
    };

    await refreshScanRoot("/Volumes/Archive/Videos", videoExtensionAllowlist);

    expect(mockedInvoke).toHaveBeenCalledWith("refresh_scan_root", {
      path: "/Volumes/Archive/Videos",
      videoExtensionAllowlist,
    });
  });

  it("refreshes all Scan Roots through the Rust command", async () => {
    mockedInvoke.mockResolvedValue({
      scannedVideoCount: 3,
      unprocessableCandidateCount: 1,
    });

    const refreshSummary = await refreshAllScanRoots();

    expect(refreshSummary).toEqual({
      scannedVideoCount: 3,
      unprocessableCandidateCount: 1,
    });
    expect(mockedInvoke).toHaveBeenCalledWith("refresh_all_scan_roots", {
      videoExtensionAllowlist: null,
    });
  });

  it("calls the typed Rust command for Unprocessable Video Candidates", async () => {
    mockedInvoke.mockResolvedValue([
      {
        path: "/Volumes/Archive/Videos/broken.mkv",
        reason: "missing moov atom",
        fileSizeBytes: 1024,
      },
    ]);

    const candidates = await listUnprocessableVideoCandidates();

    expect(candidates).toEqual([
      {
        path: "/Volumes/Archive/Videos/broken.mkv",
        reason: "missing moov atom",
        fileSizeBytes: 1024,
      },
    ]);
    expect(mockedInvoke).toHaveBeenCalledWith(
      "list_unprocessable_video_candidates",
    );
  });

  it("calls the typed Rust command for Failed Preview Strips", async () => {
    mockedInvoke.mockResolvedValue([
      {
        videoId: 7,
        title: "Broken Trip",
        failureReason: "ffmpeg failed",
      },
    ]);

    const failedPreviewStrips = await listFailedPreviewStrips();

    expect(failedPreviewStrips).toEqual([
      {
        videoId: 7,
        title: "Broken Trip",
        failureReason: "ffmpeg failed",
      },
    ]);
    expect(mockedInvoke).toHaveBeenCalledWith("list_failed_preview_strips");
  });

  it("calls the typed Rust command for Metadata Suggestion groups", async () => {
    mockedInvoke.mockResolvedValue([
      {
        suggestedValue: "Family",
        suggestionKind: "tag",
        sources: [
          {
            scanRootPath: "/Volumes/Archive/Videos",
            sourcePathSegment: "  Family  ",
            videos: [
              {
                videoId: 7,
                title: "Family Trip",
                fileLocationPath:
                  "/Volumes/Archive/Videos/Family/family-trip.mp4",
              },
            ],
          },
        ],
      },
    ]);

    const suggestionGroups = await listMetadataSuggestionGroups();

    expect(suggestionGroups).toEqual([
      {
        suggestedValue: "Family",
        suggestionKind: "tag",
        sources: [
          {
            scanRootPath: "/Volumes/Archive/Videos",
            sourcePathSegment: "  Family  ",
            videos: [
              {
                videoId: 7,
                title: "Family Trip",
                fileLocationPath:
                  "/Volumes/Archive/Videos/Family/family-trip.mp4",
              },
            ],
          },
        ],
      },
    ]);
    expect(mockedInvoke).toHaveBeenCalledWith(
      "list_metadata_suggestion_groups",
    );
  });

  it("retries and ignores Failed Preview Strips through Rust commands", async () => {
    mockedInvoke.mockResolvedValue({
      pendingCount: 1,
      runningCount: 0,
      failedCount: 0,
      isPaused: false,
    });

    const retryQueueStatus = await retryFailedPreviewStrip(7);
    const ignoreQueueStatus = await ignoreFailedPreviewStrip(7);

    expect(retryQueueStatus).toEqual({
      pendingCount: 1,
      runningCount: 0,
      failedCount: 0,
      isPaused: false,
    });
    expect(ignoreQueueStatus).toEqual({
      pendingCount: 1,
      runningCount: 0,
      failedCount: 0,
      isPaused: false,
    });

    expect(mockedInvoke).toHaveBeenCalledWith("retry_failed_preview_strip", {
      videoId: 7,
    });
    expect(mockedInvoke).toHaveBeenCalledWith("ignore_failed_preview_strip", {
      videoId: 7,
    });
  });

  it("calls the typed Rust command for Preview Strip queue status", async () => {
    mockedInvoke.mockResolvedValue({
      pendingCount: 2,
      runningCount: 1,
      runningVideoId: 7,
      failedCount: 0,
      isPaused: false,
    });

    const queueStatus = await getPreviewStripQueueStatus();

    expect(queueStatus).toEqual({
      pendingCount: 2,
      runningCount: 1,
      runningVideoId: 7,
      failedCount: 0,
      isPaused: false,
    });
    expect(mockedInvoke).toHaveBeenCalledWith("get_preview_strip_queue_status");
  });

  it("pauses and resumes the Preview Strip queue through Rust commands", async () => {
    await pausePreviewStripQueue();
    await resumePreviewStripQueue();

    expect(mockedInvoke).toHaveBeenCalledWith("pause_preview_strip_queue");
    expect(mockedInvoke).toHaveBeenCalledWith("resume_preview_strip_queue");
  });

  it("calls the typed Rust command for FFmpeg tools status", async () => {
    await getFfmpegToolsStatus();

    expect(mockedInvoke).toHaveBeenCalledWith("get_ffmpeg_tools_status");
  });

  it("persists FFmpeg binary path configuration through the Rust command", async () => {
    const configuration = {
      ffmpegPath: "/opt/homebrew/bin/ffmpeg",
      ffprobePath: "/opt/homebrew/bin/ffprobe",
    };

    await saveFfmpegConfiguration(configuration);

    expect(mockedInvoke).toHaveBeenCalledWith("save_ffmpeg_configuration", {
      configuration,
    });
  });

  it("calls typed Rust commands for Tag primitives", async () => {
    mockedInvoke.mockResolvedValue([{ id: 4, name: "Travel" }]);

    const listedTags = await listTags();
    mockedInvoke.mockResolvedValue({ id: 4, name: "Travel" });
    const createdTag = await createTag("Travel");
    const updatedTag = await updateTag(4, "Archive");
    await deleteTag(4);

    expect(listedTags).toEqual([{ id: 4, name: "Travel" }]);
    expect(createdTag).toEqual({ id: 4, name: "Travel" });
    expect(updatedTag).toEqual({ id: 4, name: "Travel" });
    expect(mockedInvoke).toHaveBeenCalledWith("list_tags");
    expect(mockedInvoke).toHaveBeenCalledWith("create_tag", { name: "Travel" });
    expect(mockedInvoke).toHaveBeenCalledWith("update_tag", {
      tagId: 4,
      name: "Archive",
    });
    expect(mockedInvoke).toHaveBeenCalledWith("delete_tag", { tagId: 4 });
  });

  it("calls typed Rust commands for Performer primitives", async () => {
    mockedInvoke.mockResolvedValue([{ id: 9, name: "Blair" }]);

    const listedPerformers = await listPerformers();
    mockedInvoke.mockResolvedValue({ id: 9, name: "Blair" });
    const createdPerformer = await createPerformer("Blair");
    const updatedPerformer = await updatePerformer(9, "Alex");
    await deletePerformer(9);

    expect(listedPerformers).toEqual([{ id: 9, name: "Blair" }]);
    expect(createdPerformer).toEqual({ id: 9, name: "Blair" });
    expect(updatedPerformer).toEqual({ id: 9, name: "Blair" });
    expect(mockedInvoke).toHaveBeenCalledWith("list_performers");
    expect(mockedInvoke).toHaveBeenCalledWith("create_performer", {
      name: "Blair",
    });
    expect(mockedInvoke).toHaveBeenCalledWith("update_performer", {
      performerId: 9,
      name: "Alex",
    });
    expect(mockedInvoke).toHaveBeenCalledWith("delete_performer", {
      performerId: 9,
    });
  });

  it("calls typed Rust commands for Video metadata links", async () => {
    await attachTagToVideo(4, 1);
    await detachTagFromVideo(4, 1);
    await attachPerformerToVideo(9, 1);
    await detachPerformerFromVideo(9, 1);
    await tagsForVideo(1);
    await performersForVideo(1);

    expect(mockedInvoke).toHaveBeenCalledWith("attach_tag_to_video", {
      tagId: 4,
      videoId: 1,
    });
    expect(mockedInvoke).toHaveBeenCalledWith("detach_tag_from_video", {
      tagId: 4,
      videoId: 1,
    });
    expect(mockedInvoke).toHaveBeenCalledWith("tags_for_video", { videoId: 1 });
    expect(mockedInvoke).toHaveBeenCalledWith("attach_performer_to_video", {
      performerId: 9,
      videoId: 1,
    });
    expect(mockedInvoke).toHaveBeenCalledWith("detach_performer_from_video", {
      performerId: 9,
      videoId: 1,
    });
    expect(mockedInvoke).toHaveBeenCalledWith("performers_for_video", {
      videoId: 1,
    });
  });

  it("calls typed Rust commands for Video Detail metadata edits", async () => {
    await updateVideoTitle(1, "Family Archive");
    await setVideoFavorite(1, true);

    expect(mockedInvoke).toHaveBeenCalledWith("update_video_title", {
      videoId: 1,
      title: "Family Archive",
    });
    expect(mockedInvoke).toHaveBeenCalledWith("set_video_favorite", {
      videoId: 1,
      isFavorite: true,
    });
  });
});
