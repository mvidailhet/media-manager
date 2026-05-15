# Media Manager

A local desktop app for organizing local videos with previews and tags, so you can choose what to watch next.

## Local development

Before running the desktop app, install:

- Node.js 20 or newer.
- Rust with Cargo available on `PATH`.
- Tauri's macOS prerequisites, including Xcode Command Line Tools.

Install JavaScript dependencies:

```sh
npm install
```

Run the web shell locally:

```sh
npm run dev
```

Run the Tauri desktop app locally:

```sh
npm run tauri:dev
```

Run the frontend tests:

```sh
npm test
```

Run the Rust tests:

```sh
npm run test:rust
```

## Local app data

The Tauri app stores local data under its macOS app identifier, `com.media-manager`.

- Catalog database: `~/Library/Application Support/com.media-manager/catalog.sqlite3`
- Preview Strip cache: `~/Library/Caches/com.media-manager/preview-strips`
- FFmpeg settings: `~/Library/Preferences/com.media-manager/ffmpeg-settings.json`

To retry a full scan from scratch, quit the app and remove the Catalog database and Preview Strip cache:

```sh
rm -f "$HOME/Library/Application Support/com.media-manager/catalog.sqlite3"
rm -rf "$HOME/Library/Caches/com.media-manager/preview-strips"
```

To also reset FFmpeg configuration:

```sh
APP_IDENTIFIER="com.media-manager"
rm -f "$HOME/Library/Preferences/com.media-manager/ffmpeg-settings.json"
```
