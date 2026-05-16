import { Box, Tabs } from "@mantine/core";
import { IconBulb, IconHistory, IconStar } from "@tabler/icons-react";

import type {
  AcceptMetadataSuggestionForVideosRequest,
  CatalogPerformer,
  CatalogTag,
  CatalogVideo,
  MetadataSuggestionGroup,
  RejectMetadataSuggestionSourceRequest,
} from "../../tauriCommands";
import { BatchMetadataEditPanel } from "./BatchMetadataEditPanel";
import { CatalogVideosPanel } from "./CatalogVideosPanel";
import type {
  CatalogVideoFilters,
  CatalogVideoSort,
  CatalogVideoWorkspace,
  CatalogView,
} from "./catalogTypes";
import { MetadataSuggestionsPanel } from "./MetadataSuggestionsPanel";
import { VideoDetailPanel } from "./VideoDetailPanel";

export type CatalogModuleProps = {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  batchRemovablePerformers: CatalogPerformer[];
  batchRemovableTags: CatalogTag[];
  batchSelectedVideoCount: number;
  catalogVideoActionStatusMessage: string;
  catalogVideoFilters: CatalogVideoFilters;
  catalogVideoSort: CatalogVideoSort;
  catalogVideoWorkspace: CatalogVideoWorkspace;
  catalogVideos: CatalogVideo[];
  catalogVideosStatusMessage: string;
  catalogView: CatalogView;
  detailStatusMessage: string;
  metadataSuggestionGroups: MetadataSuggestionGroup[];
  onAcceptMetadataSuggestionVideos: (
    request: AcceptMetadataSuggestionForVideosRequest,
  ) => void;
  onAppendPerformer: (performer: CatalogPerformer) => void;
  onAppendTag: (tag: CatalogTag) => void;
  onAttachPerformer: (performer: CatalogPerformer) => void;
  onAttachTag: (tag: CatalogTag) => void;
  onCatalogVideoFiltersChange: (filters: CatalogVideoFilters) => void;
  onCatalogVideoSortChange: (sort: CatalogVideoSort) => void;
  onCatalogViewChange: (catalogView: CatalogView) => void;
  onCreateOrAppendPerformer: (performerName: string) => void;
  onCreateOrAppendTag: (tagName: string) => void;
  onCreateOrAttachPerformer: (performerName: string) => void;
  onCreateOrAttachTag: (tagName: string) => void;
  onDetachPerformer: (performer: CatalogPerformer) => void;
  onDetachTag: (tag: CatalogTag) => void;
  onOpenVideo: (catalogVideo: CatalogVideo) => void;
  onRejectMetadataSuggestionSource: (
    request: RejectMetadataSuggestionSourceRequest,
  ) => void;
  onRemovePerformer: (performer: CatalogPerformer) => void;
  onRemoveTag: (tag: CatalogTag) => void;
  onReviewVideo: (videoId: number) => void;
  onSaveTitle: (title: string) => void;
  onSelectVideo: (catalogVideo: CatalogVideo) => void;
  onSetBatchFavorite: (isFavorite: boolean) => void;
  onSetBatchVideoSelected: (videoId: number, isSelected: boolean) => void;
  onSetFavorite: (catalogVideo: CatalogVideo, isFavorite: boolean) => void;
  onSetSelectedFavorite: (isFavorite: boolean) => void;
  selectedPerformers: CatalogPerformer[];
  selectedTags: CatalogTag[];
  selectedVideo: CatalogVideo | null;
  selectedVideoIds: number[];
};

const navigationIconSize = 20;

export function CatalogModule({
  availablePerformers,
  availableTags,
  batchRemovablePerformers,
  batchRemovableTags,
  batchSelectedVideoCount,
  catalogVideoActionStatusMessage,
  catalogVideoFilters,
  catalogVideoSort,
  catalogVideoWorkspace,
  catalogVideos,
  catalogVideosStatusMessage,
  catalogView,
  detailStatusMessage,
  metadataSuggestionGroups,
  onAcceptMetadataSuggestionVideos,
  onAppendPerformer,
  onAppendTag,
  onAttachPerformer,
  onAttachTag,
  onCatalogVideoFiltersChange,
  onCatalogVideoSortChange,
  onCatalogViewChange,
  onCreateOrAppendPerformer,
  onCreateOrAppendTag,
  onCreateOrAttachPerformer,
  onCreateOrAttachTag,
  onDetachPerformer,
  onDetachTag,
  onOpenVideo,
  onRejectMetadataSuggestionSource,
  onRemovePerformer,
  onRemoveTag,
  onReviewVideo,
  onSaveTitle,
  onSelectVideo,
  onSetBatchFavorite,
  onSetBatchVideoSelected,
  onSetFavorite,
  onSetSelectedFavorite,
  selectedPerformers,
  selectedTags,
  selectedVideo,
  selectedVideoIds,
}: CatalogModuleProps) {
  const isCatalogVideoListView = catalogView !== "metadataSuggestions";

  return (
    <>
      <Tabs
        value={catalogView}
        onChange={(value) => onCatalogViewChange(value as CatalogView)}
        keepMounted={false}
      >
        <Tabs.List aria-label="Catalog navigation">
          <Tabs.Tab value="allVideos">All Videos</Tabs.Tab>
          <Tabs.Tab
            value="favorites"
            leftSection={<IconStar size={navigationIconSize} />}
          >
            Favorites
          </Tabs.Tab>
          <Tabs.Tab
            value="recentlyOpened"
            leftSection={<IconHistory size={navigationIconSize} />}
          >
            Recently Opened
          </Tabs.Tab>
          <Tabs.Tab
            value="metadataSuggestions"
            leftSection={<IconBulb size={navigationIconSize} />}
          >
            Metadata Suggestions
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {isCatalogVideoListView ? (
        <CatalogVideosPanel
          availablePerformers={availablePerformers}
          availableTags={availableTags}
          catalogVideoActionStatusMessage={catalogVideoActionStatusMessage}
          catalogVideoFilters={catalogVideoFilters}
          catalogVideoWorkspace={catalogVideoWorkspace}
          catalogVideoSort={catalogVideoSort}
          catalogVideos={catalogVideos}
          catalogVideosStatusMessage={catalogVideosStatusMessage}
          onCatalogVideoFiltersChange={onCatalogVideoFiltersChange}
          onCatalogVideoSortChange={onCatalogVideoSortChange}
          onOpenVideo={onOpenVideo}
          onSetBatchVideoSelected={onSetBatchVideoSelected}
          onSelectVideo={onSelectVideo}
          onSetFavorite={onSetFavorite}
          selectedVideoIds={selectedVideoIds}
        />
      ) : (
        <Box
          component="section"
          aria-label="Catalog Metadata Suggestions"
          p="md"
          maw={760}
        >
          <MetadataSuggestionsPanel
            availablePerformers={availablePerformers}
            availableTags={availableTags}
            metadataSuggestionGroups={metadataSuggestionGroups}
            onAcceptMetadataSuggestionVideos={onAcceptMetadataSuggestionVideos}
            onRejectMetadataSuggestionSource={onRejectMetadataSuggestionSource}
            onReviewVideo={onReviewVideo}
          />
        </Box>
      )}
      {batchSelectedVideoCount > 0 ? (
        <BatchMetadataEditPanel
          availablePerformers={availablePerformers}
          availableTags={availableTags}
          onAppendPerformer={onAppendPerformer}
          onAppendTag={onAppendTag}
          onCreateOrAppendPerformer={onCreateOrAppendPerformer}
          onCreateOrAppendTag={onCreateOrAppendTag}
          onRemovePerformer={onRemovePerformer}
          onRemoveTag={onRemoveTag}
          onSetFavorite={onSetBatchFavorite}
          removablePerformers={batchRemovablePerformers}
          removableTags={batchRemovableTags}
          selectedVideoCount={batchSelectedVideoCount}
        />
      ) : null}
      {selectedVideo ? (
        <VideoDetailPanel
          availablePerformers={availablePerformers}
          availableTags={availableTags}
          detailStatusMessage={detailStatusMessage}
          onAttachPerformer={onAttachPerformer}
          onAttachTag={onAttachTag}
          onCreateOrAttachPerformer={onCreateOrAttachPerformer}
          onCreateOrAttachTag={onCreateOrAttachTag}
          onDetachPerformer={onDetachPerformer}
          onDetachTag={onDetachTag}
          onSaveTitle={onSaveTitle}
          onSetFavorite={onSetSelectedFavorite}
          selectedPerformers={selectedPerformers}
          selectedTags={selectedTags}
          video={selectedVideo}
        />
      ) : null}
    </>
  );
}
