import { useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";

import type { PlaybackWindowVideo } from "../../tauriCommands";
import styles from "./Playback.module.css";

const scrubPercentMinimum = 0;
const scrubPercentMaximum = 100;

export function Playback({
  initialVideo,
}: {
  initialVideo: PlaybackWindowVideo;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [scrubPercent, setScrubPercent] = useState(0);
  const videoSource = convertFileSrc(initialVideo.path);

  function updateDuration() {
    const videoElement = videoRef.current;

    if (!videoElement || !Number.isFinite(videoElement.duration)) {
      setDurationSeconds(0);
      return;
    }

    setDurationSeconds(videoElement.duration);
  }

  function scrubVideo(nextScrubPercent: number) {
    const videoElement = videoRef.current;

    setScrubPercent(nextScrubPercent);

    if (!videoElement || durationSeconds <= 0) {
      return;
    }

    videoElement.currentTime =
      durationSeconds * (nextScrubPercent / scrubPercentMaximum);
  }

  return (
    <main className={styles.playbackWindow}>
      <video
        aria-label={`${initialVideo.title} video`}
        className={styles.videoSurface}
        ref={videoRef}
        src={videoSource}
        onLoadedMetadata={updateDuration}
      />
      <div className={styles.controls}>
        <input
          aria-label="Playback scrub"
          className={styles.scrubSlider}
          max={scrubPercentMaximum}
          min={scrubPercentMinimum}
          onChange={(event) => scrubVideo(Number(event.currentTarget.value))}
          type="range"
          value={scrubPercent}
        />
      </div>
    </main>
  );
}
