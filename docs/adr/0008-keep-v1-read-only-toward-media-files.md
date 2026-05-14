# Keep v1 read-only toward media files

v1 will not rename, move, trash, restore, or delete media files. It will scan **Scan Roots**, reconcile **Videos**, generate **Preview Strips**, open or reveal **File Locations**, and edit **Catalog** metadata only. This deliberately defers filesystem write operations because rename, move, trash, and restore share safety concerns around duplicates, external drives, confirmation, and recovery.
