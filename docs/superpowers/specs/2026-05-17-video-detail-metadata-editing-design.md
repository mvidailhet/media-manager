# Video Detail Metadata Editing Design

## Goal

Let users edit a selected Video's Tags and Performers directly from the Video Detail Panel.

Tags and Performers have the same interaction model: view current values as pills, enter edit mode with a pencil button, edit through a Mantine `TagsInput` with suggestions, persist each change immediately, and leave edit mode with a Done button.

## Domain Rules

- A Tag is a flat reusable label attached to a Video.
- A Performer is a person who appears in a Video.
- Tags and Performers remain separate metadata kinds.
- Existing metadata names match case-insensitively within their own kind.
- New metadata cleanup stays a backend Catalog responsibility. If reverting detaches a newly-created value from its last Video, the frontend does not special-case deletion.

## User Experience

The Video Detail Panel shows two metadata sections:

- Tags
- Performers

Each section has a title, a small pencil icon, and the current values rendered as pills. Empty sections show quiet text: "No tags" or "No performers".

Clicking a pencil puts only that section into edit mode. Tags and Performers are edited independently, each with its own edit baseline.

In edit mode:

- Pills are replaced by a Mantine `TagsInput`.
- Suggestions come from all known values for that metadata kind.
- Selected values and suggestions display names only.
- Existing values and newly-created values have no visual distinction.
- Removing a value detaches it from the selected Video immediately.
- Adding an existing value attaches it immediately.
- Typing a new value creates it and attaches it immediately.
- A case-insensitive name match attaches the existing value instead of creating a duplicate.
- A Done button exits edit mode.
- A Revert icon button appears only when current values differ from the edit-start baseline.

Clicking Revert restores that section to the values it had when edit mode started:

- Baseline values missing from the current Video are reattached.
- Current values absent from the baseline are detached.
- The section remains in edit mode after reverting.

No loader or visible request state is shown for normal local operations. If a local command fails, the UI restores the last known good values and shows the existing detail status/error path.

Changing the selected Video exits both metadata edit modes and resets baselines.

## Architecture

The detail panel should not become a second Catalog controller and should not call Tauri commands directly.

Recommended boundary:

- `CatalogModule` owns the selected Video detail area instead of `App.tsx` manually rendering the detail aside.
- `useCatalogModuleController` remains the source of Catalog state and persistence callbacks.
- `useSelectedVideoDetailActions` adapts broad Catalog controller actions into a compact detail-specific API.
- `VideoDetailPanel` owns local editing interaction: title edit mode, metadata edit mode, baselines, Done, Revert, and input values.
- `VideoMetadataSection` is a reusable component for both Tags and Performers.

The detail model shape should stay compact:

```ts
detailModel = {
  video,
  tags,
  performers,
  availableTags,
  availablePerformers,
  statusMessage,
}
```

The detail actions shape should stay focused:

```ts
detailActions = {
  openVideo,
  openContainingFolder,
  saveTitle,
  setFavorite,
  attachTag,
  detachTag,
  createOrAttachTag,
  attachPerformer,
  detachPerformer,
  createOrAttachPerformer,
}
```

## Data Flow

`VideoMetadataSection` receives one metadata kind at a time:

- title
- empty label
- selected values for the current Video
- available values for suggestions
- attach callback
- detach callback
- create-or-attach callback

When `TagsInput` changes, the section compares the previous selected names with the next selected names:

- Names present before but missing now are detached.
- Names missing before but present now are attached or created.
- Existing names are resolved case-insensitively from available values.
- New names are trimmed before creation.
- Empty names are ignored.

When Revert is clicked, the section compares current values against the baseline captured when edit mode started:

- Baseline values missing now are attached.
- Current values absent from baseline are detached.
- Edit mode remains open.

## Testing

Add behavior-focused React tests:

- Video detail shows Tags and Performers pills in view mode.
- Pencil switches one section into edit mode without affecting the other.
- Removing a value calls the matching detach action immediately.
- Adding an existing value calls attach immediately.
- Adding a new value calls create-or-attach immediately.
- Case-insensitive entry attaches the existing value.
- Revert restores the edit-start baseline by calling the needed attach and detach actions.
- Done exits edit mode.
- Switching selected Video exits edit mode and resets baselines.

## Out Of Scope

- Batch metadata editing changes.
- Metadata merge flows.
- Backend schema changes.
- Modal-based metadata editing.
- Visible loading states for local metadata edits.
