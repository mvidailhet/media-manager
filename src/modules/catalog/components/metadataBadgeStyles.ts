export type MetadataBadgeKind = "tag" | "performer";

export const metadataBadgeColors: Record<MetadataBadgeKind, string> = {
  tag: "blue",
  performer: "grape",
};

export function metadataBadgeColorForKind(kind: MetadataBadgeKind) {
  return metadataBadgeColors[kind];
}
