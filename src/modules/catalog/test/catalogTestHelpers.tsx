import {
 fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, vi } from "vitest";

import {
  mockedOpen,
  mockedConvertFileSrc,
  mockedGetLocalDesktopAppStatus,
  mockedGetFfmpegToolsStatus,
  mockedSaveFfmpegConfiguration,
  mockedListFailedPreviewStrips,
  mockedListMetadataSuggestionGroups,
  mockedAcceptMetadataSuggestionForVideos,
  mockedRejectMetadataSuggestionSource,
  mockedListTags,
  mockedListPerformers,
  mockedTagsForVideo,
  mockedPerformersForVideo,
  mockedAttachTagToVideo,
  mockedDetachTagFromVideo,
  mockedAttachPerformerToVideo,
  mockedDetachPerformerFromVideo,
  mockedCreateTag,
  mockedCreatePerformer,
  mockedUpdateVideoTitle,
  mockedSetVideoFavorite,
  mockedOpenCatalogVideoContainingFolder,
  mockedOpenCatalogVideo,
  mockedOpenPlaybackWindow,
  mockedMoveCatalogVideoFileLocationToTrash,
  mockedRetryFailedPreviewStrip,
  mockedIgnoreFailedPreviewStrip,
  mockedListCatalogVideos,
  mockedListScanRoots,
  mockedAddScanRoot,
  mockedForgetCatalogVideo,
  mockedGetPreviewStripQueueStatus,
  mockedPausePreviewStripQueue,
  mockedProcessNextPreviewStripQueueItem,
  mockedRemoveScanRoot,
  mockedResumePreviewStripQueue,
  mockedUpdateScanRootInferenceRules,
  availableFfmpegToolsStatus,
  pendingPreviewStrip,
  defaultInferenceRules,
  deferredPromise,
  renderApp,
  resetAppTestHarness,
  openScanModule,
  openSettingsModule,
  openMetadataSuggestionsView,
  openMissingVideosTab,
  openPreviewGenerationTab,
} from "../../../test/AppTestHarness";
import { previewStripAutoplayFrameIntervalMilliseconds } from "../components/VideoPreview/previewStripFrame";


export function expandMetadataSuggestionBranch(
    metadataSuggestions: HTMLElement,
    scanRootPath: string,
    folderPath: string,
  ) {
    fireEvent.click(
      getMetadataSuggestionTreeLabel(metadataSuggestions, scanRootPath),
    );
    for (const folderName of folderPath.split("/").filter(Boolean)) {
      fireEvent.click(
        getMetadataSuggestionTreeLabel(metadataSuggestions, folderName),
      );
    }
  }

export function getMetadataSuggestionTreeLabel(
    metadataSuggestions: HTMLElement,
    label: string,
  ) {
    return within(metadataSuggestions).getByText((_content, element) => {
      return element?.tagName === "P" && element.textContent === label;
    });
  }

export function getMetadataSuggestionBadge(
    metadataSuggestions: HTMLElement,
    suggestedValue: string,
  ) {
    const suggestionBadge = within(metadataSuggestions)
      .getAllByText(suggestedValue)
      .map((element) => element.closest(".mantine-Badge-root"))
      .find((element): element is HTMLElement => element instanceof HTMLElement);

    if (!suggestionBadge) {
      throw new Error(`Missing Metadata Suggestion badge for ${suggestedValue}`);
    }

    return suggestionBadge;
  }

export async function showAdvancedSearch(catalogVideos: HTMLElement) {
    fireEvent.click(
      within(catalogVideos).getByRole("button", {
        name: "Advanced search",
        expanded: false,
      }),
    );

    await within(catalogVideos).findByRole("button", {
      name: "Advanced search",
      expanded: true,
    });
  }

export async function findSecretMetadataVisibilityCheckbox(
    catalogVideos: HTMLElement,
  ) {
    await showAdvancedSearch(catalogVideos);

    return within(catalogVideos).findByRole("checkbox", {
      name: "Hide secret tags and performers",
    });
  }

export function expandFolderFilterBranch(catalogVideos: HTMLElement, label: string) {
    fireEvent.click(
      within(catalogVideos).getByText((_content, element) => {
        return element?.tagName === "P" && element.textContent === label;
      }),
    );
  }

export function clickFolderFilterCheckbox(catalogVideos: HTMLElement, label: string) {
    const folderCheckbox = within(catalogVideos)
      .getAllByLabelText(label)
      .find((element) => element.getAttribute("role") === "checkbox");

    if (!folderCheckbox) {
      throw new Error(`Missing folder filter checkbox for ${label}`);
    }

    fireEvent.click(folderCheckbox);
  }

export function catalogVideoFixture(id: number, title: string) {
    return {
      id,
      title,
      durationMilliseconds: 1800000,
      fileSizeBytes: 50740352,
      fileLocationPath: `/Volumes/Archive/Videos/${title.toLowerCase().replace(/ /g, "-")}.mp4`,
      fileLocations: [],
      isAvailable: true,
      isFavorite: false,
      lastOpenedAt: null,
      openCount: 0,
      previewStrip: pendingPreviewStrip,
    };
  }

export function catalogVideoBatch(count: number) {
    return Array.from({ length: count }, (_value, index) =>
      catalogVideoFixture(index + 1, `Archive Clip ${String(index + 1).padStart(3, "0")}`),
    );
  }

export async function visibleCatalogVideos() {
    return await screen.findByRole("region", { name: "Catalog Videos" });
  }

export async function expandPrimaryPerformerAccordion(
    catalogVideos: HTMLElement,
    performerName = "Unassigned",
  ) {
    const accordionButton = await within(catalogVideos).findByRole("button", {
      name: `${performerName} Primary Performer Accordion`,
    });

    if (accordionButton.getAttribute("aria-expanded") === "true") {
      return;
    }

    fireEvent.click(accordionButton);
    await waitFor(() => expect(accordionButton).toHaveAttribute("aria-expanded", "true"));
  }

export async function findExpandedVideoCard(
    catalogVideos: HTMLElement,
    videoTitle: string,
  ) {
    return await waitFor(() => {
      const videoCard = within(catalogVideos)
        .getAllByRole("article", { name: videoTitle })
        .find((element) => element.tagName === "ARTICLE");

      if (!videoCard) {
        throw new Error(`Missing expanded Video card for ${videoTitle}`);
      }

      return videoCard;
    });
  }

export { fireEvent, screen, waitFor, within, vi, mockedOpen, mockedConvertFileSrc, mockedGetLocalDesktopAppStatus, mockedGetFfmpegToolsStatus, mockedSaveFfmpegConfiguration, mockedListFailedPreviewStrips, mockedListMetadataSuggestionGroups, mockedAcceptMetadataSuggestionForVideos, mockedRejectMetadataSuggestionSource, mockedListTags, mockedListPerformers, mockedTagsForVideo, mockedPerformersForVideo, mockedAttachTagToVideo, mockedDetachTagFromVideo, mockedAttachPerformerToVideo, mockedDetachPerformerFromVideo, mockedCreateTag, mockedCreatePerformer, mockedUpdateVideoTitle, mockedSetVideoFavorite, mockedOpenCatalogVideoContainingFolder, mockedOpenCatalogVideo, mockedOpenPlaybackWindow, mockedMoveCatalogVideoFileLocationToTrash, mockedRetryFailedPreviewStrip, mockedIgnoreFailedPreviewStrip, mockedListCatalogVideos, mockedListScanRoots, mockedAddScanRoot, mockedForgetCatalogVideo, mockedGetPreviewStripQueueStatus, mockedPausePreviewStripQueue, mockedProcessNextPreviewStripQueueItem, mockedRemoveScanRoot, mockedResumePreviewStripQueue, mockedUpdateScanRootInferenceRules, availableFfmpegToolsStatus, pendingPreviewStrip, defaultInferenceRules, deferredPromise, renderApp, resetAppTestHarness, openScanModule, openSettingsModule, openMetadataSuggestionsView, openMissingVideosTab, openPreviewGenerationTab, previewStripAutoplayFrameIntervalMilliseconds };
