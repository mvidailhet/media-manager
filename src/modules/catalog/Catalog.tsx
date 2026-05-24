import type {
  CatalogPerformer,
  CatalogTag,
  CatalogVideo,
  MetadataSuggestionGroup,
  RejectMetadataSuggestionSourceRequest,
} from "../../tauriCommands";
import type { BatchMetadataValue } from "./BatchEditPanel";
import type { BatchTrashTarget } from "./BatchEditPanel/batchTrashTypes";
import type { VideoSelectionModifiers } from "./useCatalogModuleController";
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
import styles from "./Catalog.module.css";

export type CatalogProps = {
  availablePerformers: CatalogPerformer[];
  availableTags: CatalogTag[];
  batchRemovablePerformers: BatchMetadataValue<CatalogPerformer>[];
  batchRemovableTags: BatchMetadataValue<CatalogTag>[];
  batchSelectedVideosAllFavorite: boolean;
  batchSelectedVideoCount: number;
  batchTrashTargets: BatchTrashTarget[];
  catalogVideoActionStatusMessage: string;
  catalogVideoFilters: CatalogVideoFilters;
  catalogVideoMetadataById: Record<number, CatalogVideoMetadata>;
  catalogVideoSort: CatalogVideoSort;
  catalogVideos: CatalogVideo[];
  allCatalogVideos: CatalogVideo[];
  catalogVideosStatusMessage: string;
  catalogView: CatalogView;
  detailStatusMessage: string;
  hasMoreCatalogVideos: boolean;
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
  onClearVideoSelection: () => void;
  onExposeNextCatalogVideoBatch: () => void;
  onCreateOrAppendPerformer: (performerName: string) => void;
  onCreateOrAppendTag: (tagName: string) => void;
  onCreateOrAttachPerformer: (performerName: string) => void;
  onCreateOrAttachTag: (tagName: string) => void;
  onDetachPerformer: (performer: CatalogPerformer) => void;
  onDetachTag: (tag: CatalogTag) => void;
  onOpenVideo: (catalogVideo: CatalogVideo, startAtSeconds: number) => void;
  onOpenVideoContainingFolder: (catalogVideo: CatalogVideo) => void;
  onMoveSelectedVideoFileLocationToTrash: (path: string) => void;
  onMoveBatchPreferredFileLocationsToTrash: () => Promise<void>;
  onRejectMetadataSuggestionSource: (
    request: RejectMetadataSuggestionSourceRequest,
  ) => void;
  onReplaceSelectedVideos: (videoIds: number[]) => void;
  onRemovePerformer: (performer: CatalogPerformer) => void;
  onRemoveTag: (tag: CatalogTag) => void;
  onReviewVideo: (videoId: number) => void;
  onSaveTitle: (title: string) => void;
  onSelectVideo: (
    catalogVideo: CatalogVideo,
    modifiers: VideoSelectionModifiers,
  ) => void;
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
  allCatalogVideos,
  catalogVideoActionStatusMessage,
  catalogVideoFilters,
  catalogVideoMetadataById,
  catalogVideoSort,
  catalogVideos,
  catalogVideosStatusMessage,
  catalogView,
  hasMoreCatalogVideos,
  metadataSuggestionGroups,
  onAcceptMetadataSuggestionVideos,
  onCatalogVideoFiltersChange,
  onCatalogVideoSortChange,
  onCatalogViewChange,
  onClearVideoSelection,
  onExposeNextCatalogVideoBatch,
  onRejectMetadataSuggestionSource,
  onReplaceSelectedVideos,
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
    <div className={styles.catalogWorkspace}>
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
            allCatalogVideos={allCatalogVideos}
            catalogVideos={catalogVideos}
            catalogVideosStatusMessage={catalogVideosStatusMessage}
            hasMoreCatalogVideos={hasMoreCatalogVideos}
            onCatalogVideoFiltersChange={onCatalogVideoFiltersChange}
            onCatalogVideoSortChange={onCatalogVideoSortChange}
            onSetFavorite={onSetFavorite}
            onClearVideoSelection={onClearVideoSelection}
            onExposeNextCatalogVideoBatch={onExposeNextCatalogVideoBatch}
            onReplaceSelectedVideos={onReplaceSelectedVideos}
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
    </div>
  );
}
