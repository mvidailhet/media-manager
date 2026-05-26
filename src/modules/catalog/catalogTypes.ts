import type {
  AcceptMetadataSuggestionForVideosRequest,
  CatalogPerformer,
  CatalogTag,
} from "../../tauriCommands";

export interface CatalogVideoMetadata {
  tags: CatalogTag[];
  performers: CatalogPerformer[];
}

export interface CatalogFolderSearchBranch {
  path: string;
  availableScanRootPath: string;
}

export interface CatalogVideoFilters {
  searchText: string;
  selectedFolderBranches: CatalogFolderSearchBranch[] | null;
  selectedTagIds: number[];
  withoutTagsOnly: boolean;
  selectedPerformerIds: number[];
  hideSecretMetadata: boolean;
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
  selectedFolderBranches: null,
  selectedTagIds: [],
  withoutTagsOnly: false,
  selectedPerformerIds: [],
  hideSecretMetadata: true,
  favoritesOnly: false,
  showUnavailableVideos: false,
  minimumDurationMinutes: "",
  maximumDurationMinutes: "",
};
