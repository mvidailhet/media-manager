# Use configurable system FFmpeg for v1

v1 will use system `ffmpeg` and `ffprobe` binaries discovered from `PATH`, with an app setting to configure their paths when needed. Bundling FFmpeg would improve out-of-box behavior but adds packaging, licensing, app size, and update complexity; starting with configurable system binaries keeps preview generation and probing practical while leaving bundling as a later packaging decision.
