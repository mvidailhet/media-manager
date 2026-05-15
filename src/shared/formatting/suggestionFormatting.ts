export function formatSuggestionKind(suggestionKind: string) {
  return suggestionKind
    .split("_")
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
