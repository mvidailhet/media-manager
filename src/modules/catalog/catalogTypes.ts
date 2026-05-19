import type {
  AcceptMetadataSuggestionForVideosRequest,
  CatalogPerformer,
  CatalogTag,
} from "../../tauriCommands";

export interface CatalogVideoMetadata {
  tags: CatalogTag[];
  performers: CatalogPerformer[];
}

export interface CatalogVideoFilters {
  searchText: string;
  selectedTagIds: number[];
  selectedPerformerIds: number[];
  favoritesOnly: boolean;
  showUnavailableVideos: boolean;
  minimumDurationMinutes: number | "";
  maximumDurationMinutes: number | "";
}

export type CatalogVideoSort =
  | "titleAscending"
  | "fileSizeAscending"
  | "fileSizeDescending"
  | "lastOpenedDescending"
  | "openCountDescending";
export type CatalogView = "videos" | "metadataSuggestions";

export type CatalogMetadataSuggestionAcceptanceRequest =
  AcceptMetadataSuggestionForVideosRequest & {
    additionalTagNames?: string[];
  };

export const defaultCatalogVideoFilters: CatalogVideoFilters = {
  searchText: "",
  selectedTagIds: [],
  selectedPerformerIds: [],
  favoritesOnly: false,
  showUnavailableVideos: false,
  minimumDurationMinutes: "",
  maximumDurationMinutes: "",
};
