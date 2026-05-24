const playbackWindowFormatAllowlist = new Set(["m4v", "mov", "mp4", "webm"]);

export function isPlaybackWindowFileLocation(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();

  return extension ? playbackWindowFormatAllowlist.has(extension) : false;
}
