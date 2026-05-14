# Use partial content fingerprints for video identity

We will identify a **Video** with a **Video Fingerprint** based on file size, duration, and partial content hashes rather than filesystem path, filename, or full-file hash. This lets metadata survive moves and renames without requiring expensive full hashing of large video files, while still being more reliable than path or filename-based identity. Each fingerprint stores a **Fingerprint Version** so future fingerprint algorithms can coexist with or migrate from v1 fingerprints safely.
