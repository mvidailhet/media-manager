# Media Manager

A local catalog for organizing and finding video files stored across folders on a Mac.

## Language

**Video**:
A cataloged video item whose metadata should remain attached even when its file is moved or renamed.
_Avoid_: Media item, asset

**Video Fingerprint**:
A durable identity for a **Video** derived from stable properties of its file rather than from its path.
_Avoid_: Path, filename

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
A **Video** whose known **File Locations** are not currently available.
_Avoid_: Deleted video, removed video

**Unavailable Scan Root**:
A **Scan Root** that cannot currently be reached by the app.
_Avoid_: Missing video

**Refresh**:
A user-initiated or startup check that updates **Scan Root** availability and reconciles discovered **Videos**.
_Avoid_: Live watch

**Background Job**:
Cancelable local work such as scanning, fingerprinting, or generating **Preview Strips**.
_Avoid_: Sync job

**Preview Strip**:
A generated sequence of still frames sampled across a **Video** for quick visual preview.
_Avoid_: Thumbnail, trailer

**Pending Preview Strip**:
A **Preview Strip** that has not been generated yet.
_Avoid_: Missing video

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

**Rejected Metadata Suggestion**:
A **Metadata Suggestion** that should not be proposed again for the same source and value.
_Avoid_: Deleted metadata

**Review Queue**:
A workspace for **Catalog** issues and suggestions that need user attention.
_Avoid_: Search results, inbox

**Forget From Catalog**:
An explicit action that removes an unavailable **Video** and its local metadata from the **Catalog** without touching the filesystem.
_Avoid_: Delete, trash

**Videos View**:
The primary workspace for searching and filtering normal **Video** results.
_Avoid_: Review queue

**First Vertical Slice**:
The initial usable path that adds a **Scan Root**, scans it, stores discovered **Videos**, and lists them in the **Videos View**.
_Avoid_: Prototype shell

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
- Removing a **Scan Root** asks whether to preserve affected **Videos** as **Missing Videos** or **Forget From Catalog**.
- v1 rejects nested or overlapping **Scan Roots**.
- A **Scan Root** can have a **Drive Identity** in addition to its folder path.
- A **Scan Root** can become an **Unavailable Scan Root** when its drive or folder is not reachable.
- A **Scan Root** is searched for files matching the **Video Extension Allowlist** before video probing validates them.
- An **Unprocessable Video Candidate** belongs in a review list instead of normal **Video** search results.
- An **Unprocessable Video Candidate** is retried when its file changes or when manually retried from review.
- A **Refresh** can run for one **Scan Root** or all **Scan Roots**.
- A **Background Job** commits completed file work incrementally.
- v1 rebuilds **Background Jobs** from persisted item state instead of storing a durable job queue.
- A **Video** is stored as a file on the local filesystem.
- A **Video** has one **Video Fingerprint** used to reconnect it with its file after moves or renames.
- A **Video Fingerprint** is based on file size, duration, and partial content hashes.
- A **Video** keeps its metadata when its **Video Fingerprint** is found in a different **Scan Root**.
- A **Video** has one **Title** used for display and name search.
- **Title** is editable in v1.
- A **Video** has one **Duration** shown by default.
- Multiple **Videos** can share the same **Title**.
- A **Video** has one or more **File Locations**.
- A **File Location** has one **File Size** available on demand.
- A **Duplicate Location** belongs to one **Video**.
- **Duplicate Locations** are created only from exact **Video Fingerprint** matches in v1.
- Trash actions target **File Locations** when a **Video** has more than one **File Location**.
- A **Missing Video** keeps its metadata and can be reconnected when a matching **Video Fingerprint** appears again.
- A **Video** can have many **Tags**.
- A **Tag** can belong to many **Videos**.
- A **Video** can have many **Performers**.
- A **Performer** can appear in many **Videos**.
- A **Video** can have one **Preview Strip**.
- A **Preview Strip** belongs to a **Video**, not to a specific **File Location**.
- A **Preview Strip** defaults to 20 evenly sampled frames across the **Video**.
- A **Preview Strip** samples from inside the **Video** timeline rather than exact first and last frames.
- A **Pending Preview Strip** belongs to a **Video** that has been cataloged before its preview is ready.
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
- **Inferred Metadata** can suggest **Tags** or **Performers** but does not become confirmed **Local Metadata** until accepted.
- A **Metadata Suggestion** can be accepted or rejected for multiple **Videos** at once.
- A **Rejected Metadata Suggestion** suppresses repeated suggestions from the same source and value.
- A **Metadata Suggestion** can normalize display text while preserving the original folder name as its source.
- Accepting a **Metadata Suggestion** creates a **Tag** or **Performer** unless it matches or is merged into an existing value.
- A **Review Queue** includes **Duplicate Locations**, **Metadata Suggestions**, **Unprocessable Video Candidates**, **Missing Videos**, and **Unavailable Scan Roots**.
- **Forget From Catalog** is available from the **Review Queue** for **Missing Videos**.
- **Forget From Catalog** requires confirmation and is final in v1.
- v1 has **Videos View**, **Favorites View**, **Recently Opened View**, and **Review Queue** as top-level workspaces.
- The **First Vertical Slice** proves **Scan Root** selection, scanning, SQLite storage, FFmpeg probing, and listing **Videos**.
- A **Metadata Merge** preserves affected **Video** relationships under the chosen **Tag** or **Performer**.
- Normal **Search Filters** use accepted **Local Metadata**, not unaccepted **Inferred Metadata**.
- Normal **Search Filters** include **Missing Videos** by default, clearly marked as unavailable.
- Normal **Search Filters** exclude **Trashed Videos** by default.
- **Tag** and **Performer** search is case-insensitive while display names can preserve title casing.
- Editing **Local Metadata** changes the **Catalog** only and does not rename or move files.
- Editing **Title** does not rename any **File Location**.
- A **Batch Metadata Edit** can apply or remove **Tags**, **Performers**, or **Favorite** across selected **Videos**.
- A **Video** can be opened from or revealed at its current **File Location**.
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
> **Dev:** "If a file moves from one **Scan Root** to another, is it a new **Video**?"
> **Domain expert:** "No. If the **Video Fingerprint** matches, the **Video** keeps its metadata across **Scan Roots**."
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
> **Dev:** "Where do cleanup tasks and scan issues appear?"
> **Domain expert:** "In the **Review Queue**, not mixed into normal **Video** search results."
>
> **Dev:** "What are the main v1 workspaces?"
> **Domain expert:** "**Videos View**, **Favorites View**, **Recently Opened View**, and **Review Queue**."
>
> **Dev:** "What should the first usable implementation prove?"
> **Domain expert:** "The **First Vertical Slice** adds a **Scan Root**, scans it, stores discovered **Videos**, and lists them in the **Videos View**."
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
> **Domain expert:** "No. v1 uses **Refresh** at startup and on demand."
>
> **Dev:** "If I cancel a scan, is all progress lost?"
> **Domain expert:** "No. A **Background Job** keeps completed file work and future **Refresh** runs skip unchanged files."
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
> **Domain expert:** "By default it uses 20 evenly sampled frames across the **Video**."
>
> **Dev:** "Should preview sampling include the exact first and last frames?"
> **Domain expert:** "No. Sampling should avoid the edges where black frames or fades are common."
>
> **Dev:** "Should a **Video** wait for its **Preview Strip** before appearing in search?"
> **Domain expert:** "No. The **Video** appears once cataloged; its **Preview Strip** can be pending until generation finishes."
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
> **Dev:** "Can folder names help create metadata?"
> **Domain expert:** "Yes, but only as **Inferred Metadata** until accepted, because folder hierarchy is not consistently clean."
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
> **Dev:** "Should folder name `jane_doe` become a suggestion exactly as written?"
> **Domain expert:** "No. It can be displayed as `Jane Doe`, while keeping `jane_doe` as the source."
>
> **Dev:** "When I accept a new suggested **Tag**, does it create the **Tag**?"
> **Domain expert:** "Yes, unless it matches or is merged into an existing **Tag**."
>
> **Dev:** "If I reject folder-derived Tag `Misc`, should it appear again after every rescan?"
> **Domain expert:** "No. A **Rejected Metadata Suggestion** should stay suppressed for the same source and value."
>
> **Dev:** "If `Jane_Doe` and `Jane Doe` are the same **Performer**, what should happen?"
> **Domain expert:** "Use a **Metadata Merge** to combine them into the chosen **Performer**."
>
> **Dev:** "Should `Interview` and `interview` search differently?"
> **Domain expert:** "No. Search is case-insensitive, while display names can use capitalized words."
>
> **Dev:** "When I accept **Inferred Metadata**, should folders or filenames change?"
> **Domain expert:** "No. Metadata edits update the **Catalog** only."
>
> **Dev:** "Do I need to edit metadata one **Video** at a time?"
> **Domain expert:** "No. v1 supports **Batch Metadata Edit** for selected **Videos**."
>
> **Dev:** "Does v1 need to play **Videos** inside the app?"
> **Domain expert:** "No. v1 only needs to open a **Video** from its **File Location** or reveal it in Finder."

## Flagged ambiguities

- "file" and **Video** are related but not identical: the **Video** is the catalog item; the file is where that video currently lives on disk.
- A filesystem path is not a **Video** identity; it is only the current location where the **Video** can be found.
- **Performer** is not a **Tag**; names should not be mixed into the tag vocabulary.
- **Favorite** is not a **Tag**; it is a separate marker that can be combined with other **Search Filters**.
- **Title** is not the filename; the filename can seed it, but the **Title** belongs to the **Video**.
- A duplicate file is not a duplicate **Video** when it has the same **Video Fingerprint**; it is a **Duplicate Location**.
- The **Catalog** is not the source of truth for folder organization; it records metadata and reconciles file movement.
- **Missing Video** does not mean deleted; it often means the drive or folder containing the file is temporarily unavailable.
- **Unavailable Scan Root** is different from **Missing Video**: it describes a folder tree that cannot currently be reached, not an individual **Video** whose file is absent.
- **Trashed Video** is different from **Missing Video** because the app intentionally moved it to Trash and can offer restore while possible.
- A trash action should not silently affect every **File Location** of a **Video** when duplicate locations exist.
- **Forget From Catalog** is not a filesystem delete; it removes local **Catalog** metadata for a **Missing Video**.
- **Inferred Metadata** is not confirmed **Local Metadata**; folder-derived suggestions must be accepted before they shape normal search results.
- Editing **Local Metadata** must not implicitly reorganize the filesystem.
- **Unprocessable Video Candidate** is not a **Video** until probing confirms the file is usable.
