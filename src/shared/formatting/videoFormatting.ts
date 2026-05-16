import type { CatalogVideo } from "../../tauriCommands";

const millisecondsPerSecond = 1000;
const secondsPerMinute = 60;
const minutesPerHour = 60;
const bytesPerMegabyte = 1_000_000;
const bytesPerGigabyte = 1_000_000_000;

export function formatOpenHistory(catalogVideo: CatalogVideo) {
  if (catalogVideo.openCount === 0) {
    return "Never opened";
  }

  const openCountLabel =
    catalogVideo.openCount === 1
      ? "Opened 1 time"
      : `Opened ${catalogVideo.openCount} times`;

  return catalogVideo.lastOpenedAt
    ? `${openCountLabel}, last opened ${catalogVideo.lastOpenedAt}`
    : openCountLabel;
}

export function fileSizeNullSortOrder(
  firstVideo: CatalogVideo,
  secondVideo: CatalogVideo,
) {
  if (firstVideo.fileSizeBytes === null && secondVideo.fileSizeBytes === null) {
    return 0;
  }

  if (firstVideo.fileSizeBytes === null) {
    return 1;
  }

  if (secondVideo.fileSizeBytes === null) {
    return -1;
  }

  return 0;
}

export function formatDuration(durationMilliseconds: number) {
  const totalSeconds = Math.round(durationMilliseconds / millisecondsPerSecond);
  const totalMinutes = Math.floor(totalSeconds / secondsPerMinute);
  const hours = Math.floor(totalMinutes / minutesPerHour);
  const minutes = totalMinutes % minutesPerHour;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

export function formatFileSize(fileSizeBytes: number | null) {
  if (fileSizeBytes === null) {
    return "Unknown";
  }

  const megabytes = fileSizeBytes / bytesPerMegabyte;

  return `${megabytes.toFixed(1)} MB`;
}

export function formatCompactFileSize(fileSizeBytes: number | null) {
  if (fileSizeBytes === null) {
    return "Unknown";
  }

  if (fileSizeBytes >= bytesPerGigabyte) {
    const gigabytes = Math.round(fileSizeBytes / bytesPerGigabyte);

    return `${gigabytes}Go`;
  }

  const megabytes = Math.round(fileSizeBytes / bytesPerMegabyte);

  return `${megabytes}Mo`;
}
