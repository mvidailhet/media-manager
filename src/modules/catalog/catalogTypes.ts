import type { CatalogPerformer, CatalogTag } from "../../tauriCommands";

export interface CatalogVideoMetadata {
  tags: CatalogTag[];
  performers: CatalogPerformer[];
}

export interface CatalogVideoFilters {
  searchText: string;
  selectedTagIds: number[];
  selectedPerformerIds: number[];
  favoritesOnly: boolean;
  minimumDurationMinutes: number | "";
  maximumDurationMinutes: number | "";
}

export type CatalogVideoSort =
  | "titleAscending"
  | "fileSizeAscending"
  | "fileSizeDescending"
  | "lastOpenedDescending"
  | "openCountDescending";
export type CatalogVideoWorkspace = "videos" | "favorites" | "recentlyOpened";

export const defaultCatalogVideoFilters: CatalogVideoFilters = {
  searchText: "",
  selectedTagIds: [],
  selectedPerformerIds: [],
  favoritesOnly: false,
  minimumDurationMinutes: "",
  maximumDurationMinutes: "",
};
