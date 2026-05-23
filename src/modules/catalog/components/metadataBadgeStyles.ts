export type MetadataBadgeKind = "tag" | "performer";

export const metadataBadgeColors: Record<MetadataBadgeKind, string> = {
  tag: "blue",
  performer: "grape",
};

export const metadataInputPillSize = "md";

export function metadataBadgeColorForKind(kind: MetadataBadgeKind) {
  return metadataBadgeColors[kind];
}

export function metadataInputPillStylesForKind(kind: MetadataBadgeKind) {
  const metadataColor = metadataBadgeColorForKind(kind);

  return {
    backgroundColor: `var(--mantine-color-${metadataColor}-light)`,
    color: `var(--mantine-color-${metadataColor}-light-color)`,
  };
}
