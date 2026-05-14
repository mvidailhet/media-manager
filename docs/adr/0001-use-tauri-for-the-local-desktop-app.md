# Use Tauri for the local desktop app

We will build the **Local Desktop App** with Tauri, using a web UI backed by a Rust desktop layer. This keeps the app lighter than Electron while preserving strong local filesystem access, background processing, local database integration, FFmpeg command orchestration, and macOS desktop integration. Native Swift and Electron remain viable alternatives, but Tauri best matches the long-term shape of a local-first media catalog with scanning, fingerprinting, preview generation, and offline operation.
