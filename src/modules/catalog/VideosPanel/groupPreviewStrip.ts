import type { CatalogVideo } from "../../../tauriCommands";

export const groupPreviewStripVideoCount = 3;

export function groupPreviewStripVideos(catalogVideos: CatalogVideo[]) {
  const favoriteVideos = catalogVideos.filter(
    (catalogVideo) => catalogVideo.isFavorite,
  );
  const otherVideos = catalogVideos.filter(
    (catalogVideo) => !catalogVideo.isFavorite,
  );

  return [...favoriteVideos, ...otherVideos].slice(0, groupPreviewStripVideoCount);
}
