import type {
  CatalogPerformer,
  CatalogTag,
  CatalogVideo,
  MetadataSuggestionGroup,
  RejectMetadataSuggestionSourceRequest,
} from "../../tauriCommands";
import type { BatchMetadataValue } from "./BatchEditPanel";
import type {
  CatalogMetadataSuggestionAcceptanceRequest,
  CatalogVideoMetadata,
  CatalogVideoFilters,
  CatalogVideoSort,
  CatalogView,
} from "./catalogTypes";
import { CatalogToolbar } from "./components/CatalogToolbar";
import { MetadataSuggestionsSection } from "./components/MetadataSuggestionsSection";
import { VideosPanel } from "./VideosPanel";

export type CatalogProps = {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  batchRemovablePerformers: BatchMetadataValue<CatalogPerformer>[];
  batchRemovableTags: BatchMetadataValue<CatalogTag>[];
  batchSelectedVideoCount: number;
  catalogVideoActionStatusMessage: string;
  catalogVideoFilters: CatalogVideoFilters;
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  catalogVideoSort: CatalogVideoSort;
  catalogVideos: CatalogVideo[];
  catalogVideosStatusMessage: string;
  catalogView: CatalogView;
  detailStatusMessage: string;
  metadataSuggestionGroups: MetadataSuggestionGroup[];
  onAcceptMetadataSuggestionVideos: (
    request: CatalogMetadataSuggestionAcceptanceRequest,
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
  onOpenVideo: (catalogVideo: CatalogVideo, startAtSeconds: number) => void;
  onOpenVideoContainingFolder: (catalogVideo: CatalogVideo) => void;
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

export function Catalog({
  availablePerformers,
  availableTags,
  catalogVideoActionStatusMessage,
  catalogVideoFilters,
  catalogVideoMetadataById,
  catalogVideoSort,
  catalogVideos,
  catalogVideosStatusMessage,
  catalogView,
  metadataSuggestionGroups,
  onAcceptMetadataSuggestionVideos,
  onCatalogVideoFiltersChange,
  onCatalogVideoSortChange,
  onCatalogViewChange,
  onRejectMetadataSuggestionSource,
  onReviewVideo,
  onSelectVideo,
  onSetBatchVideoSelected,
  onSetFavorite,
  selectedVideo,
  selectedVideoIds,
}: CatalogProps) {
  const isVideosView = catalogView === "videos";
  const selectedDetailVideoId = selectedVideo?.id ?? null;

  return (
    <>
      {isVideosView ? (
        <>
          <CatalogToolbar
            metadataSuggestionGroupCount={metadataSuggestionGroups.length}
            onOpenMetadataSuggestionsReview={() =>
              onCatalogViewChange("metadataSuggestions")
            }
          />
          <VideosPanel
            availablePerformers={availablePerformers}
            availableTags={availableTags}
            catalogVideoActionStatusMessage={catalogVideoActionStatusMessage}
            catalogVideoFilters={catalogVideoFilters}
            catalogVideoMetadataById={catalogVideoMetadataById}
            catalogVideoSort={catalogVideoSort}
            catalogVideos={catalogVideos}
            catalogVideosStatusMessage={catalogVideosStatusMessage}
            onCatalogVideoFiltersChange={onCatalogVideoFiltersChange}
            onCatalogVideoSortChange={onCatalogVideoSortChange}
            onSetFavorite={onSetFavorite}
            onSetBatchVideoSelected={onSetBatchVideoSelected}
            onSelectVideo={onSelectVideo}
            selectedDetailVideoId={selectedDetailVideoId}
            selectedVideoIds={selectedVideoIds}
          />
        </>
      ) : (
        <MetadataSuggestionsSection
          availablePerformers={availablePerformers}
          availableTags={availableTags}
          metadataSuggestionGroups={metadataSuggestionGroups}
          onAcceptMetadataSuggestionVideos={onAcceptMetadataSuggestionVideos}
          onRejectMetadataSuggestionSource={onRejectMetadataSuggestionSource}
          onReviewVideo={onReviewVideo}
          onReturnToVideosView={() => onCatalogViewChange("videos")}
        />
      )}
    </>
  );
}
