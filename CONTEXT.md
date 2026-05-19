# Media Manager

A local catalog for organizing and finding video files stored across folders on a Mac.

## Language

**Video**:
A cataloged video item whose metadata should remain attached even when its file is moved or renamed.
_Avoid_: Media item, asset

**Video Fingerprint**:
A durable identity for a **Video** derived from stable properties of its file rather than from its path.
_Avoid_: Path, filename

**Fingerprint Version**:
The algorithm version used to produce a **Video Fingerprint**.
_Avoid_: App version

**Tag**:
A flat reusable label attached to a **Video** for filtering and discovery.
_Avoid_: Category, folder

**Performer**:
A person who appears in a **Video**.
_Avoid_: Creator, channel, studio

**Title**:
The user-facing name of a **Video**, initially derived from its filename.
_Avoid_: Filename, path

**Duration**:
The playback length of a **Video**.
_Avoid_: File size

**File Size**:
The storage size of a **File Location**.
_Avoid_: Duration

**File Location**:
A filesystem path where a **Video** file is currently found.
_Avoid_: Video identity

**Preferred File Location**:
The **File Location** used by default when opening a **Video** with multiple available locations.
_Avoid_: Video identity

**Duplicate Location**:
An extra **File Location** for a **Video** that already exists elsewhere.
_Avoid_: Duplicate video

**Catalog**:
The app's local record of **Videos**, **Tags**, **Performers**, and **File Locations**.
_Avoid_: Library, database

**Preview Cache**:
Regenerable local storage for generated **Preview Strips**.
_Avoid_: Catalog

**Scan Root**:
A folder tree explicitly selected for recursive video discovery.
_Avoid_: Source, import folder

**Drive Identity**:
A stable identifier for the storage volume behind a **Scan Root** when available.
_Avoid_: Folder path

**Missing Video**:
A **Video** with no known **File Locations** because a **Refresh** invalidated them or a **Scan Root** removal preserved the **Video** in the **Catalog**.
_Avoid_: Deleted video, removed video

**Unavailable Video**:
A **Video** that cannot currently be opened from any reachable **File Location**.
_Avoid_: Missing video

**Unavailable Scan Root**:
A **Scan Root** that cannot currently be reached by the app.
_Avoid_: Missing video

**Refresh**:
A user-initiated check that updates **Scan Root** availability and reconciles discovered **Videos**.
_Avoid_: Live watch

**Initial Scan**:
The automatic first scan that indexes **Videos** after adding a **Scan Root**.
_Avoid_: Refresh

**Availability Check**:
A lightweight check that updates whether **Scan Roots** are reachable without reconciling **Videos**.
_Avoid_: Refresh, scan

**Background Job**:
Cancelable local work such as scanning, fingerprinting, or generating **Preview Strips**.
_Avoid_: Sync job

**Preview Strip**:
A generated sequence of still frames sampled across a **Video** for quick visual preview.
_Avoid_: Thumbnail, trailer

**Pending Preview Strip**:
A **Preview Strip** that has not been generated yet.
_Avoid_: Missing video

**Generating Preview Strip**:
A **Preview Strip** whose generation attempt is currently running.
_Avoid_: Pending preview strip

**Failed Preview Strip**:
A **Preview Strip** that could not be generated for an otherwise valid **Video**.
_Avoid_: Unprocessable video candidate

**Search Filter**:
A structured constraint used to narrow the **Catalog** results.
_Avoid_: Search term, query

**Favorite**:
A user-controlled marker for a **Video** that is especially worth returning to.
_Avoid_: Tag

**Open History**:
Local usage metadata recording when a **Video** was opened from the app and how often.
_Avoid_: Playback progress, watch history

**Trashed Video**:
A **Video** intentionally moved to the system Trash from the app while its metadata remains restorable.
_Avoid_: Missing video, deleted video

**Local Desktop App**:
A Mac application that catalogs local **Videos** and works without internet access.
_Avoid_: Web service, cloud library

**No Network Dependency**:
A product boundary where normal cataloging, search, preview generation, and metadata editing do not require or send data over the network.
_Avoid_: Cloud sync, telemetry

**Local Metadata**:
User-managed **Video** information stored by the app without relying on internet services.
_Avoid_: Online metadata, cloud sync

**Metadata Badge**:
A Mantine `Badge` used to display a **Tag** or **Performer** in read-only metadata views.
_Avoid_: Pill

**Video Extension Allowlist**:
A configurable list of file extensions considered candidates for **Video** discovery.
_Avoid_: Supported codec list

**Unprocessable Video Candidate**:
A discovered file that matches the **Video Extension Allowlist** but cannot be validated as a usable **Video**.
_Avoid_: Video, missing video

**Inferred Metadata**:
Suggested **Local Metadata** derived from a **Video**'s **File Location**.
_Avoid_: Confirmed metadata, online metadata

**Metadata Suggestion**:
A reviewable proposal to turn **Inferred Metadata** into accepted **Local Metadata**.
_Avoid_: Tag, performer

**Inference Rule**:
A **Scan Root** setting that controls how folder path segments become **Metadata Suggestions**.
_Avoid_: Search filter

**Rejected Metadata Suggestion**:
A **Metadata Suggestion** that should not be proposed again for the same **Scan Root** source and value.
_Avoid_: Deleted metadata

**Metadata Suggestion Mapping**:
A remembered choice that maps a **Metadata Suggestion** source and value to an accepted **Tag** or **Performer**.
_Avoid_: Alias

**Missing Videos View**:
The scanning workspace for reviewing **Missing Videos** outside normal **Video** browsing.
_Avoid_: Generic review queue

**Forget From Catalog**:
An explicit action that removes a **Missing Video** and its local metadata from the **Catalog** without touching the filesystem.
_Avoid_: Delete, trash

**Videos View**:
The primary workspace for searching and filtering normal **Video** results.
_Avoid_: Review queue

**Video Detail Panel**:
The focused editing surface for one selected **Video**.
_Avoid_: Separate detail page

**First Vertical Slice**:
The initial usable path that adds a **Scan Root**, scans it, stores discovered **Videos**, and lists them in the **Videos View**.
_Avoid_: Prototype shell

**Preview Slice**:
The implementation path that generates and displays **Preview Strips** after the **First Vertical Slice**.
_Avoid_: Metadata inference

**Metadata Editing Slice**:
The implementation path for accepted **Local Metadata**, **Search Filters**, and **Batch Metadata Edit** before folder-derived inference.
_Avoid_: Metadata suggestions

**Favorites View**:
A shortcut workspace showing **Videos** marked **Favorite**.
_Avoid_: Tag view

**Recently Opened View**:
A shortcut workspace based on **Open History**.
_Avoid_: Watch history

**Metadata Merge**:
An action that combines duplicate **Tags** or duplicate **Performers** into one accepted value.
_Avoid_: Alias

**Batch Metadata Edit**:
An action that applies or removes accepted metadata across multiple **Videos** at once.
_Avoid_: Metadata suggestion

## Relationships

- A **Catalog** has one or more **Scan Roots**.
- **Scan Roots** are added through a folder picker, with manual path entry as an advanced fallback.
- Adding a **Scan Root** indexes files in place and does not copy **Videos**.
- Adding a **Scan Root** starts an **Initial Scan** automatically.
- Removing a **Scan Root** asks whether to preserve affected **Videos** as **Missing Videos** or **Forget From Catalog**.
- Preserving affected **Videos** during **Scan Root** removal creates **Missing Videos** immediately.
- v1 rejects nested or overlapping **Scan Roots**.
- Adding a **Scan Root** lightly configures **Inference Rules** with safe defaults.
- A **Scan Root** can have a **Drive Identity** in addition to its folder path.
- A **Scan Root** can become an **Unavailable Scan Root** when its drive or folder is not reachable.
- An **Unavailable Scan Root** keeps its last-known **File Locations** in the **Catalog**.
- An **Availability Check** can run at startup without turning absent files into **Missing Videos**.
- An **Unavailable Scan Root** can run an **Availability Check** but cannot run a **Refresh** until reachable again.
- When an **Availability Check** makes an **Unavailable Scan Root** reachable again, **Refresh** becomes available but does not start automatically.
- An **Unavailable Video** is only a **Missing Video** when no last-known **File Location** remains.
- A **Scan Root** is searched for files matching the **Video Extension Allowlist** before video probing validates them.
- An **Unprocessable Video Candidate** belongs with its **Scan Root** instead of normal **Video** search results.
- An **Unprocessable Video Candidate** is retried when its file changes or when manually retried from its **Scan Root**.
- An **Initial Scan** creates the first **Catalog** entries for a new **Scan Root**.
- An **Initial Scan** cannot create **Missing Videos** because it has no previous **File Locations** to invalidate.
- A **Refresh** can run for one **Scan Root** or all **Scan Roots**.
- A **Background Job** commits completed file work incrementally.
- v1 rebuilds **Background Jobs** from persisted item state instead of storing a durable job queue.
- **Metadata Suggestions** are generated by separate **Background Jobs** after scanning or Inference Rule changes.
- A **Video** is stored as a file on the local filesystem.
- A **Video** has one **Video Fingerprint** used to reconnect it with its file after moves or renames.
- A **Video Fingerprint** is based on file size, duration, and partial content hashes.
- A **Video Fingerprint** has one **Fingerprint Version** so future algorithms can coexist with v1 fingerprints.
- A **Video** keeps its metadata when its **Video Fingerprint** is found in a different **Scan Root**.
- If a file at the same path gets a different **Video Fingerprint**, it is a different **Video**.
- A **Video** has one **Title** used for display and name search.
- **Title** is editable in v1.
- A **Video** has one **Duration** shown by default.
- Multiple **Videos** can share the same **Title**.
- A **Video** has one or more **File Locations**.
- A **File Location** has one **File Size** available on demand.
- A **Video** can have one **Preferred File Location**.
- A **Duplicate Location** belongs to one **Video**.
- **Duplicate Locations** are created only from exact **Video Fingerprint** matches in v1.
- Invalidating one **File Location** does not make a **Missing Video** while another known **File Location** remains.
- Trash actions target **File Locations** when a **Video** has more than one **File Location**.
- A **Missing Video** keeps its metadata and can be reconnected when a matching **Video Fingerprint** appears again.
- Re-adding a removed **Scan Root** can reconnect **Missing Videos** when matching **Video Fingerprints** are found.
- A **Video** can have many **Tags**.
- A **Tag** can belong to many **Videos**.
- A **Video** can have many **Performers**.
- A **Performer** can appear in many **Videos**.
- A **Video** can have one **Preview Strip**.
- A **Preview Strip** belongs to a **Video**, not to a specific **File Location**.
- A **Preview Strip** defaults to 40 evenly sampled frames across the **Video**.
- A **Preview Strip** frame is generated at 640 pixels wide for clearer display on high-density screens.
- A **Preview Strip** samples from inside the **Video** timeline rather than exact first and last frames.
- Hovering a **Video** preview scrubs across **Preview Strip** frames by horizontal pointer position.
- A **Pending Preview Strip** belongs to a **Video** that has been cataloged before its preview is ready.
- A **Pending Preview Strip** shows a neutral placeholder and generation state without blocking the **Video** from appearing.
- A **Generating Preview Strip** shows progress on the specific **Video** being processed without blocking other **Videos** from appearing.
- A **Failed Preview Strip** does not stop its **Video** from appearing in search.
- A **Failed Preview Strip** can be ignored until manually retried, or until the **Video** file or FFmpeg configuration changes.
- A user-cancelled **Generating Preview Strip** returns to **Pending Preview Strip** instead of becoming a **Failed Preview Strip**.
- **Preview Strip** generation is queued after cataloging but starts only through explicit user action and can be paused or resumed globally.
- The **Preview Strip** generation queue is derived from **Preview Strip** state rather than managed as a separate user-curated list.
- **Preview Strip** generation shows counts for pending and generated work, with detail for the currently generating and failed work.
- Pausing **Preview Strip** generation cancels the active generation attempt immediately instead of waiting for the current **Preview Strip** to finish.
- v1 runs one **Preview Strip** generation job at a time by default.
- v1 **Background Jobs** run only while the **Local Desktop App** is open.
- Active **Search Filters** combine to narrow the set of matching **Videos**.
- Text search matches **Title** and current filename in v1.
- Multiple selected **Tags** require every selected **Tag**.
- v1 does not support OR groups for **Tags**.
- Multiple selected **Performers** require any selected **Performer**.
- **Duration** can be used as a range **Search Filter** in v1.
- **Favorite** is a **Search Filter** but not a **Tag**.
- **Favorite** is the only special **Video** marker in v1.
- **Open History** tracks last opened time and open count, not playback progress.
- **Open History** supports recently opened views and sorting in v1.
- **File Size** is visible and sortable in v1 but not a **Search Filter**.
- A **Trashed Video** keeps its metadata while it can be restored from Trash.
- v1 does not rename, move, trash, or restore files.
- The **Catalog** preserves **Video** metadata while the filesystem remains the source of truth for folder organization.
- The **Local Desktop App** owns the **Catalog** and reads **Videos** from local **Scan Roots**.
- **No Network Dependency** applies to cataloging, search, preview generation, and metadata editing.
- **Tags**, **Performers**, and **Titles** are **Local Metadata**.
- **Tags** and **Performers** can be created inline while editing a **Video** or applying a **Batch Metadata Edit**.
- Inline creation checks existing **Tags** and **Performers** case-insensitively and can suggest near matches before creating a new value.
- **Tag** names are case-insensitively unique among **Tags**; **Performer** names are case-insensitively unique among **Performers**.
- Attached **Tags** and **Performers** should be merged or explicitly detached before deletion.
- Unused **Tags** and **Performers** are removed from the **Catalog** when they no longer belong to any **Video**.
- Removing the last use of a **Tag** or **Performer** deletes it on save/apply without extra confirmation during normal editing.
- **Inferred Metadata** can suggest **Tags** or **Performers** but does not become confirmed **Local Metadata** until accepted.
- A **Scan Root** can have **Inference Rules** for Tag suggestions and ignored folder names.
- Default **Inference Rules** suggest folder segments below a **Scan Root** as **Tags** only.
- **Inference Rules** ignore the **Scan Root** folder name and all parent folders above it.
- Default ignored folder names are `Misc`, `Unsorted`, `To Sort`, `To Review`, `New`, `Temp`, `Archive`, `Archives`, `Downloads`, and `Videos`.
- Year-like folder names, exactly four digits from `1900` through `2099`, are ignored by default and do not become **Tag** suggestions.
- A **Metadata Suggestion** can be accepted or rejected for multiple **Videos** at once.
- Bulk accepting a **Metadata Suggestion** defaults to all matching **Videos** but allows individual **Videos** to be excluded before applying.
- Excluding **Videos** from a bulk **Metadata Suggestion** acceptance leaves those **Videos** unresolved for that suggestion.
- Accepting a **Metadata Suggestion** as **Performer** resolves that suggestion for the affected **Videos** instead of leaving it as a **Tag** suggestion.
- A **Rejected Metadata Suggestion** suppresses repeated suggestions for the same **Scan Root** source and value.
- A **Metadata Suggestion Mapping** applies future suggestions from the same **Scan Root** source and value to the chosen metadata value.
- A **Metadata Suggestion Mapping** auto-accepts future matching suggestions.
- **Metadata Suggestion Mappings** and **Rejected Metadata Suggestions** should be editable from review or Scan Root settings after the first inference slice.
- A **Metadata Suggestion** can normalize display text while preserving the original folder name as its source.
- A **Metadata Suggestion** records the folder or path segment that produced it.
- **Inference Rules** are configured with **Scan Roots**, while **Metadata Suggestions** are reviewed in the **Catalog**.
- The **Catalog** owns **Metadata Suggestion** review state, while **Scan Roots** own the **Inference Rules** that produce suggestions.
- v1 **Metadata Suggestions** do not use numeric confidence scores.
- Accepting a **Metadata Suggestion** can create a new **Tag** or **Performer**, or map to an existing value with a different name.
- Accepted **Metadata Suggestions** can keep lightweight provenance without changing their status as **Local Metadata**.
- **Metadata Suggestions** are reviewed in the **Catalog** with access to affected **Videos** and their **Preview Strips**.
- **Metadata Suggestion** review shows source path groups under each suggested value.
- **Metadata Suggestions** are loaded with **Catalog** review state, not **Missing Videos** state.
- **Missing Videos View** includes **Missing Videos**.
- **Missing Videos View** excludes **Unavailable Videos** that still have known **File Locations**.
- **Missing Videos View** belongs with scanning work rather than **Catalog** browsing.
- **Failed Preview Strips** are handled with **Preview Strip** generation controls instead of **Missing Videos View**.
- **Preview Strip** generation controls belong with scanning work, while the **Catalog** shows each **Video**'s **Preview Strip** state in context.
- The **Catalog** owns **Preview Strip** state because a **Preview Strip** belongs to a **Video**, while **Preview Strip** generation is operational background work.
- **Missing Videos** naming should not be used for metadata suggestions, failed preview strips, or unprocessable candidates.
- **Unprocessable Video Candidates** are loaded with **Scan Roots** because they are reviewed from their **Scan Root**.
- **Failed Preview Strips** are loaded with **Preview Strip** generation because they are reviewed from generation controls.
- **Forget From Catalog** is available for **Missing Videos** from **Missing Videos View**.
- **Forget From Catalog** requires confirmation and is final in v1.
- v1 has **Videos View**, **Favorites View**, **Recently Opened View**, **Missing Videos View**, and **Preview Strip** generation as workspaces.
- **Favorites View** and **Recently Opened View** reuse the same **Video** result model as **Videos View**.
- **Videos View**, **Favorites View**, **Recently Opened View**, and **Metadata Suggestions** are **Catalog** views rather than separate catalogs.
- The **Video Detail Panel** is reset when changing **Catalog** views.
- **Metadata Suggestions** use the same **Video Detail Panel** as other **Catalog** views for affected **Videos**.
- The primary app navigation is module-first: **Catalog**, scanning work, and configuration.
- The **Catalog** is the default workspace when the app opens, even when setup is incomplete.
- The **First Vertical Slice** proves **Scan Root** selection, scanning, SQLite storage, FFmpeg probing, and listing **Videos**.
- The **Preview Slice** comes after the **First Vertical Slice** and before metadata inference work.
- The **Metadata Editing Slice** comes after the **Preview Slice** and before **Inference Rules** or **Metadata Suggestions**.
- A **Metadata Merge** preserves affected **Video** relationships under the chosen **Tag** or **Performer**.
- Normal **Search Filters** use accepted **Local Metadata**, not unaccepted **Inferred Metadata**.
- Moving a **Video** can create new **Metadata Suggestions** but never removes or replaces accepted **Local Metadata**.
- Changing **Inference Rules** can regenerate unaccepted **Metadata Suggestions** for that **Scan Root** but never changes accepted **Local Metadata**.
- Normal **Search Filters** exclude **Unavailable Videos** by default and can include them when requested.
- **Missing Videos** appear in normal **Videos View** only when unavailable **Videos** are included.
- Normal **Search Filters** exclude **Trashed Videos** by default.
- **Tag** and **Performer** search is case-insensitive while display names can preserve title casing.
- Editing **Local Metadata** changes the **Catalog** only and does not rename or move files.
- Editing **Title** does not rename any **File Location**.
- A **Batch Metadata Edit** can apply or remove **Tags**, **Performers**, or **Favorite** across selected **Videos**.
- v1 **Batch Metadata Edit** appends or removes metadata but does not replace all metadata at once.
- v1 **Batch Metadata Edit** does not edit **Title**.
- Batch **Favorite** edits use explicit mark/unmark actions, not toggle.
- A **Video** can be opened from or revealed at its current **File Location**.
- Opening a **Video** uses its **Preferred File Location**, falling back to the most recently confirmed available **File Location**.
- Opening a specific **File Location** manually makes it the **Preferred File Location**.
- A **Video Detail Panel** edits **Title**, **Tags**, **Performers**, and **Favorite** for one selected **Video**.
- A **Video Detail Panel** shows all **File Locations** for the selected **Video**.
- v1 has one local **Catalog**.
- The **Catalog** is durable app-private storage; the **Preview Cache** can be regenerated.
- **Forget From Catalog** makes related **Preview Cache** entries eligible for cleanup.

## Example dialogue

> **Dev:** "If a file moves to another folder, is it still the same **Video**?"
> **Domain expert:** "Yes. The **Video Fingerprint** lets the catalog recognize it, so the **Video** keeps its tags and performers even when its filesystem location changes."
>
> **Dev:** "What makes two files the same **Video**?"
> **Domain expert:** "A matching **Video Fingerprint** based on file size, duration, and partial content hashes."
>
> **Dev:** "If the fingerprint algorithm changes later, how do we know what produced old fingerprints?"
> **Domain expert:** "Each **Video Fingerprint** stores its **Fingerprint Version**."
>
> **Dev:** "If a file moves from one **Scan Root** to another, is it a new **Video**?"
> **Domain expert:** "No. If the **Video Fingerprint** matches, the **Video** keeps its metadata across **Scan Roots**."
>
> **Dev:** "If a path now contains a file with a different **Video Fingerprint**, is it the same **Video**?"
> **Domain expert:** "No. The old **Video** becomes missing if no other **File Location** has its fingerprint, and the new file is a different **Video**."
>
> **Dev:** "When two **Tags** are selected, should a **Video** match either one or both?"
> **Domain expert:** "Both. Multi-tag search only returns a **Video** that has every selected **Tag**."
>
> **Dev:** "Can selected **Tags** be grouped with OR in v1?"
> **Domain expert:** "No. v1 **Tag** filtering is cumulative AND only."
>
> **Dev:** "Should performer names be entered as **Tags**?"
> **Domain expert:** "No. A **Performer** is a person who appears in a **Video**, and performer search is separate from tag search."
>
> **Dev:** "If the filename changes, did the **Title** necessarily change?"
> **Domain expert:** "No. The **Title** is the display name for the **Video**; the filename is just one source for it."
>
> **Dev:** "If I edit the **Title**, should the file be renamed?"
> **Domain expert:** "No. Editing **Title** updates the **Catalog** only."
>
> **Dev:** "Should **Duration** and **File Size** be equally prominent?"
> **Domain expert:** "No. **Duration** is shown by default; **File Size** is available when needed."
>
> **Dev:** "Can two **Videos** have the same **Title**?"
> **Domain expert:** "Yes. **Title** is for display and search, not identity."
>
> **Dev:** "If the same file appears in two folders, is that two **Videos**?"
> **Domain expert:** "No. It is one **Video** with multiple **File Locations**; the extra locations are **Duplicate Locations** for cleanup."
>
> **Dev:** "Should similar files with the same duration be suggested as duplicates?"
> **Domain expert:** "No. v1 only treats exact **Video Fingerprint** matches as **Duplicate Locations**."
>
> **Dev:** "Should the app reorganize folders automatically?"
> **Domain expert:** "No. The filesystem stays in charge of folder organization; the **Catalog** tracks and reconciles what exists there."
>
> **Dev:** "Should each drive have its own **Catalog**?"
> **Domain expert:** "No. v1 has one local **Catalog** with multiple **Scan Roots**."
>
> **Dev:** "If preview files are deleted, is metadata lost?"
> **Domain expert:** "No. **Preview Cache** is regenerable; **Catalog** metadata is durable."
>
> **Dev:** "If I **Forget From Catalog**, should stale preview files remain user-managed?"
> **Domain expert:** "No. Related **Preview Cache** entries become eligible for cleanup."
>
> **Dev:** "Where does the app look for **Videos**?"
> **Domain expert:** "Only inside selected **Scan Roots**, including their subfolders."
>
> **Dev:** "How are **Scan Roots** added?"
> **Domain expert:** "Through a folder picker, with manual path entry as an advanced fallback."
>
> **Dev:** "Do I need to configure metadata inference before scanning?"
> **Domain expert:** "Only lightly. **Scan Root** setup provides safe default **Inference Rules** that can change later."
>
> **Dev:** "Does adding a **Scan Root** copy files into the app?"
> **Domain expert:** "No. It indexes **Videos** in place."
>
> **Dev:** "If I remove a **Scan Root**, are its **Videos** deleted from the **Catalog**?"
> **Domain expert:** "Not automatically. The app asks whether to preserve them as **Missing Videos** or **Forget From Catalog**."
>
> **Dev:** "Can one **Scan Root** sit inside another?"
> **Domain expert:** "No. v1 rejects nested or overlapping **Scan Roots**."
>
> **Dev:** "Is a **Scan Root** identified only by its folder path?"
> **Domain expert:** "No. When available, a **Drive Identity** helps recognize the volume behind the **Scan Root**."
>
> **Dev:** "Should `.flv` files be discovered?"
> **Domain expert:** "Yes. `.flv` belongs in the **Video Extension Allowlist**, then video probing confirms whether the file is usable."
>
> **Dev:** "Should a corrupt `.mp4` appear as a normal **Video**?"
> **Domain expert:** "No. It becomes an **Unprocessable Video Candidate** for review."
>
> **Dev:** "Should failed files be probed on every scan forever?"
> **Domain expert:** "No. Retry an **Unprocessable Video Candidate** when its file changes or when manually requested."
>
> **Dev:** "Where do **Unprocessable Video Candidates** appear?"
> **Domain expert:** "With their **Scan Root**, not mixed into normal **Video** search results."
>
> **Dev:** "Where do failed preview generations appear?"
> **Domain expert:** "With **Preview Strip** generation controls, with retry or ignore-for-now actions."
>
> **Dev:** "What are the main v1 workspaces?"
> **Domain expert:** "**Videos View**, **Favorites View**, **Recently Opened View**, **Missing Videos View**, and **Preview Strip** generation."
>
> **Dev:** "Are **Favorites View** and **Recently Opened View** separate catalogs?"
> **Domain expert:** "No. They are shortcut workspaces over the same **Video** results."
>
> **Dev:** "What should the first usable implementation prove?"
> **Domain expert:** "The **First Vertical Slice** adds a **Scan Root**, scans it, stores discovered **Videos**, and lists them in the **Videos View**."
>
> **Dev:** "What should come after the **First Vertical Slice**?"
> **Domain expert:** "The **Preview Slice**, so scanned **Videos** can show generated **Preview Strips** before metadata inference work."
>
> **Dev:** "Should folder-derived metadata inference come before normal metadata editing?"
> **Domain expert:** "No. Build the **Metadata Editing Slice** first so accepted **Local Metadata** and **Search Filters** exist before suggestions."
>
> **Dev:** "If a drive is unplugged, should its **Videos** disappear from the **Catalog**?"
> **Domain expert:** "No. They become **Missing Videos** until a refresh finds their **File Locations** again."
>
> **Dev:** "If I delete a file in Finder, should the app delete its metadata?"
> **Domain expert:** "No. It becomes a **Missing Video** until I explicitly **Forget From Catalog**."
>
> **Dev:** "Can **Forget From Catalog** be undone in v1?"
> **Domain expert:** "No. It requires confirmation and is final."
>
> **Dev:** "Does v1 need live filesystem watching?"
> **Domain expert:** "No. v1 uses **Availability Check** at startup and **Refresh** on demand."
>
> **Dev:** "If I cancel a scan, is all progress lost?"
> **Domain expert:** "No. A **Background Job** keeps completed file work and future **Refresh** runs skip unchanged files."
>
> **Dev:** "Should scanning also create **Metadata Suggestions** inline?"
> **Domain expert:** "No. Suggestions are generated by separate **Background Jobs** after scanning or rule changes."
>
> **Dev:** "Should an interrupted job resume from a stored queue after restart?"
> **Domain expert:** "No. v1 persists item state and rebuilds **Background Jobs** when needed."
>
> **Dev:** "If an entire external drive is unplugged, is every **Video** on it individually suspicious?"
> **Domain expert:** "No. The **Scan Root** is unavailable, so those **Videos** are unavailable because their root is unavailable."
>
> **Dev:** "Is the hover preview another video file?"
> **Domain expert:** "No. A **Preview Strip** is generated still frames sampled from the **Video**."
>
> **Dev:** "If a **Video** has duplicate **File Locations**, does each location need its own **Preview Strip**?"
> **Domain expert:** "No. One **Preview Strip** belongs to the **Video**."
>
> **Dev:** "How much of a **Video** should the **Preview Strip** show?"
> **Domain expert:** "By default it uses 40 evenly sampled frames across the **Video**."
>
> **Dev:** "Should preview sampling include the exact first and last frames?"
> **Domain expert:** "No. Sampling should avoid the edges where black frames or fades are common."
>
> **Dev:** "How should hover preview choose which frame to show?"
> **Domain expert:** "Horizontal pointer position over the preview scrubs across the **Preview Strip** frames."
>
> **Dev:** "Should a **Video** wait for its **Preview Strip** before appearing in search?"
> **Domain expert:** "No. The **Video** appears once cataloged; its **Preview Strip** can be pending until generation finishes."
>
> **Dev:** "What appears before a **Preview Strip** is ready?"
> **Domain expert:** "A neutral placeholder with pending or generating state."
>
> **Dev:** "If preview generation fails, is the **Video** invalid?"
> **Domain expert:** "No. It has a **Failed Preview Strip**, but remains a valid searchable **Video**."
>
> **Dev:** "When should an ignored **Failed Preview Strip** be retried?"
> **Domain expert:** "On manual retry, or when the **Video** file or FFmpeg configuration changes."
>
> **Dev:** "Should preview generation start only when I hover?"
> **Domain expert:** "No. It is queued after cataloging, with global pause and resume controls."
>
> **Dev:** "How many previews should generate at once?"
> **Domain expert:** "v1 generates one **Preview Strip** at a time by default to keep the Mac responsive."
>
> **Dev:** "Should preview generation continue after the app quits?"
> **Domain expert:** "No. v1 **Background Jobs** run only while the app is open."
>
> **Dev:** "If I search by text, two **Tags**, and a **Performer**, how do results combine?"
> **Domain expert:** "The **Video** must satisfy every active **Search Filter**: match the text, have all selected **Tags**, and include any selected **Performer**."
>
> **Dev:** "If I select two **Performers**, must both appear in the **Video**?"
> **Domain expert:** "No. v1 performer filtering matches any selected **Performer**."
>
> **Dev:** "Should typing in the search box search folder names too?"
> **Domain expert:** "No. v1 text search matches **Title** and current filename; folder names feed **Metadata Suggestions** instead."
>
> **Dev:** "Can I search for **Videos** in a duration range?"
> **Domain expert:** "Yes. **Duration** is a v1 range **Search Filter**."
>
> **Dev:** "Should **File Size** be a v1 filter?"
> **Domain expert:** "No. **File Size** is visible and sortable, but not a **Search Filter** in v1."
>
> **Dev:** "Is **Favorite** just another **Tag**?"
> **Domain expert:** "No. **Favorite** is a quick marker on a **Video**, but it can still be used as a **Search Filter**."
>
> **Dev:** "Do we need ratings or watch-later states in v1?"
> **Domain expert:** "No. v1 only has **Favorite** as a special marker."
>
> **Dev:** "Should opening a **Video** from the app record playback progress?"
> **Domain expert:** "No. **Open History** only records last opened time and open count."
>
> **Dev:** "Should **Open History** support advanced date filtering in v1?"
> **Domain expert:** "No. Use it for recently opened views and sorting first."
>
> **Dev:** "Is a **Trashed Video** the same as a **Missing Video**?"
> **Domain expert:** "No. A **Trashed Video** was intentionally moved to Trash by the app; a **Missing Video** is unavailable without a confirmed app action."
>
> **Dev:** "If a **Video** has two **File Locations**, should trashing it remove both?"
> **Domain expert:** "No. Trash actions must make the target **File Locations** explicit when duplicates exist."
>
> **Dev:** "Does the app need internet access to search the **Catalog**?"
> **Domain expert:** "No. The **Local Desktop App** must keep search, preview, and metadata access available offline."
>
> **Dev:** "Should filenames, paths, or metadata be sent to a cloud service?"
> **Domain expert:** "No. **No Network Dependency** means normal app features stay local."
>
> **Dev:** "Should **Performers** or **Tags** come from an online database?"
> **Domain expert:** "No. They are **Local Metadata** managed inside the app."
>
> **Dev:** "Do I need a separate screen before assigning a new **Tag**?"
> **Domain expert:** "No. **Tags** and **Performers** can be created inline while editing."
>
> **Dev:** "If I type a new **Performer** while editing, should it be created there?"
> **Domain expert:** "Yes, after checking existing **Performers** case-insensitively and surfacing near matches."
>
> **Dev:** "Can folder names help create metadata?"
> **Domain expert:** "Yes, but only as **Inferred Metadata** until accepted, because folder hierarchy is not consistently clean."
>
> **Dev:** "Can different **Scan Roots** interpret folder names differently?"
> **Domain expert:** "Yes. **Inference Rules** let a **Scan Root** decide which path segments suggest **Tags** or nothing."
>
> **Dev:** "What do new **Scan Roots** infer by default?"
> **Domain expert:** "Folder segments suggest **Tags** only; **Performers** are assigned manually."
>
> **Dev:** "Can the **Scan Root** folder name or its parent folders create suggestions?"
> **Domain expert:** "No. Only child path segments below the **Scan Root** are eligible."
>
> **Dev:** "Which folder names are ignored by default?"
> **Domain expert:** "`Misc`, `Unsorted`, `To Sort`, `To Review`, `New`, `Temp`, `Archive`, `Archives`, `Downloads`, and `Videos`."
>
> **Dev:** "Should folder `2024` become a **Tag** suggestion by default?"
> **Domain expert:** "No. Exact four-digit years from `1900` through `2099` are ignored by default."
>
> **Dev:** "If moving a **Video** creates different folder-derived suggestions, should accepted metadata change?"
> **Domain expert:** "No. New **Metadata Suggestions** can appear, but accepted **Local Metadata** remains until edited."
>
> **Dev:** "If I change **Inference Rules**, should accepted **Tags** be rewritten?"
> **Domain expert:** "No. Only unaccepted **Metadata Suggestions** can be regenerated."
>
> **Dev:** "Should a suggested **Tag** affect normal search before it is accepted?"
> **Domain expert:** "No. Normal **Search Filters** use accepted **Local Metadata** only."
>
> **Dev:** "Should unavailable **Videos** disappear from normal search?"
> **Domain expert:** "No. They remain searchable and are marked unavailable."
>
> **Dev:** "Should **Trashed Videos** appear in normal search?"
> **Domain expert:** "No. They are intentionally removed from normal use and belong in a Trash view."
>
> **Dev:** "How should I clean up folder-derived suggestions quickly?"
> **Domain expert:** "Review **Metadata Suggestions** in bulk by suggested value, then accept or reject them for matching **Videos**."
>
> **Dev:** "Should **Metadata Suggestions** be reviewed by **Video** first?"
> **Domain expert:** "No. Group by suggested value first, then drill into affected **Videos**."
>
> **Dev:** "Should I see which folders produced a suggested value?"
> **Domain expert:** "Yes. Review shows source path groups under each suggested value."
>
> **Dev:** "When accepting a suggestion for many **Videos**, can I exclude mistakes?"
> **Domain expert:** "Yes. Bulk acceptance defaults to all matches but allows individual **Videos** to be excluded."
>
> **Dev:** "If I exclude some **Videos** during bulk acceptance, are they rejected?"
> **Domain expert:** "No. Excluded **Videos** stay unresolved for that suggestion."
>
> **Dev:** "Should folder name `jane_doe` become a suggestion exactly as written?"
> **Domain expert:** "No. It can be displayed as `Jane Doe`, while keeping `jane_doe` as the source."
>
> **Dev:** "Should I be able to see where a **Metadata Suggestion** came from?"
> **Domain expert:** "Yes. It records the folder or path segment that produced it."
>
> **Dev:** "Should **Metadata Suggestions** have confidence percentages?"
> **Domain expert:** "No. v1 explains suggestions by source and rule instead of numeric confidence."
>
> **Dev:** "When I accept a new suggested **Tag**, does it create the **Tag**?"
> **Domain expert:** "Yes, unless it matches or is merged into an existing **Tag**."
>
> **Dev:** "Can suggested `Sci Fi` be accepted as existing **Tag** `Science Fiction`?"
> **Domain expert:** "Yes. A suggestion can map to an existing metadata value with a different name."
>
> **Dev:** "If I map `Sci Fi` to **Tag** `Science Fiction`, should that choice be remembered?"
> **Domain expert:** "Yes, for future suggestions from the same **Scan Root** source and value."
>
> **Dev:** "Should remembered mappings ask again next time?"
> **Domain expert:** "No. A **Metadata Suggestion Mapping** auto-accepts future matching suggestions."
>
> **Dev:** "Can I fix a bad remembered mapping later?"
> **Domain expert:** "Yes. **Metadata Suggestion Mappings** and rejected suggestions should be editable later from review or **Scan Root** settings."
>
> **Dev:** "Can a folder-derived suggestion become a **Performer** instead of a **Tag**?"
> **Domain expert:** "Yes. Suggestions are Tag-shaped by default, but review can accept one as either **Tag** or **Performer**."
>
> **Dev:** "If I accept suggestion `Alice` as **Performer**, should it keep appearing as a **Tag** suggestion?"
> **Domain expert:** "No. Accepting it as **Performer** resolves that suggestion for the affected **Videos**."
>
> **Dev:** "After accepting a **Metadata Suggestion**, is it still just a suggestion?"
> **Domain expert:** "No. It becomes accepted **Local Metadata**, though the app can keep lightweight provenance."
>
> **Dev:** "If I reject folder-derived Tag `Misc`, should it appear again after every rescan?"
> **Domain expert:** "No. A **Rejected Metadata Suggestion** should stay suppressed for the same **Scan Root** source and value."
>
> **Dev:** "If `Jane_Doe` and `Jane Doe` are the same **Performer**, what should happen?"
> **Domain expert:** "Use a **Metadata Merge** to combine them into the chosen **Performer**."
>
> **Dev:** "Can I delete a **Tag** that is still attached to **Videos**?"
> **Domain expert:** "Not silently. Merge it or explicitly detach it from affected **Videos** first."
>
> **Dev:** "Should unused **Tags** stay available after they are detached from every **Video**?"
> **Domain expert:** "No. Unused **Tags** and **Performers** are removed from the **Catalog**."
>
> **Dev:** "Does removing the last use of a **Tag** need a separate confirmation?"
> **Domain expert:** "No, not during normal editing; it is deleted on save/apply."
>
> **Dev:** "Should `Interview` and `interview` search differently?"
> **Domain expert:** "No. Search is case-insensitive, while display names can use capitalized words."
>
> **Dev:** "Can a **Tag** and **Performer** have the same display name?"
> **Domain expert:** "Yes. Uniqueness is per metadata type."
>
> **Dev:** "When I accept **Inferred Metadata**, should folders or filenames change?"
> **Domain expert:** "No. Metadata edits update the **Catalog** only."
>
> **Dev:** "Do I need to edit metadata one **Video** at a time?"
> **Domain expert:** "No. v1 supports **Batch Metadata Edit** for selected **Videos**."
>
> **Dev:** "Can a **Batch Metadata Edit** replace all **Tags** on selected **Videos** in v1?"
> **Domain expert:** "No. v1 batch editing appends or removes metadata only."
>
> **Dev:** "Can a **Batch Metadata Edit** change **Titles**?"
> **Domain expert:** "No. **Title** is edited per **Video**."
>
> **Dev:** "Should batch **Favorite** editing toggle selected **Videos**?"
> **Domain expert:** "No. It uses explicit mark or unmark actions."
>
> **Dev:** "Does v1 need to play **Videos** inside the app?"
> **Domain expert:** "No. v1 only needs to open a **Video** from its **File Location** or reveal it in Finder."
>
> **Dev:** "Where do I edit one **Video**?"
> **Domain expert:** "In the **Video Detail Panel** opened from the **Videos View**."
>
> **Dev:** "If a **Video** has duplicate **File Locations**, where can I see them?"
> **Domain expert:** "The **Video Detail Panel** shows all **File Locations** for the selected **Video**."
>
> **Dev:** "Which location opens when a **Video** has duplicates?"
> **Domain expert:** "The **Preferred File Location**, or the most recently confirmed available **File Location** if none is set."
>
> **Dev:** "If I manually open another **File Location**, should it become preferred?"
> **Domain expert:** "Yes. Opening a specific location makes it the **Preferred File Location**."

## Flagged ambiguities

- "file" and **Video** are related but not identical: the **Video** is the catalog item; the file is where that video currently lives on disk.
- A filesystem path is not a **Video** identity; it is only the current location where the **Video** can be found.
- **Performer** is not a **Tag**; names should not be mixed into the tag vocabulary.
- **Favorite** is not a **Tag**; it is a separate marker that can be combined with other **Search Filters**.
- **Title** is not the filename; the filename can seed it, but the **Title** belongs to the **Video**.
- A duplicate file is not a duplicate **Video** when it has the same **Video Fingerprint**; it is a **Duplicate Location**.
- The **Catalog** is not the source of truth for folder organization; it records metadata and reconciles file movement.
- **Missing Video** does not mean deleted; it means an available **Scan Root** no longer contains a known **File Location**.
- **Unavailable Scan Root** is different from **Missing Video**: it describes a folder tree that cannot currently be reached, not an individual **Video** whose file is absent.
- **Trashed Video** is different from **Missing Video** because the app intentionally moved it to Trash and can offer restore while possible.
- A trash action should not silently affect every **File Location** of a **Video** when duplicate locations exist.
- **Forget From Catalog** is not a filesystem delete; it removes local **Catalog** metadata for a **Missing Video**.
- **Inferred Metadata** is not confirmed **Local Metadata**; folder-derived suggestions must be accepted before they shape normal search results.
- Editing **Local Metadata** must not implicitly reorganize the filesystem.
- **Unprocessable Video Candidate** is not a **Video** until probing confirms the file is usable.
