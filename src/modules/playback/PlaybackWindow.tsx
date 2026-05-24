import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import {
  getCurrentPlaybackWindowVideo,
  type PlaybackWindowVideo,
} from "../../tauriCommands";
import { Playback } from "./Playback";

const playbackWindowVideoEvent = "playback-window-video";

export function PlaybackWindow() {
  const [playbackVideo, setPlaybackVideo] =
    useState<PlaybackWindowVideo | null>(null);

  useEffect(() => {
    let canUpdatePlaybackVideo = true;

    async function loadCurrentPlaybackVideo() {
      const currentPlaybackVideo = await getCurrentPlaybackWindowVideo();

      if (canUpdatePlaybackVideo) {
        setPlaybackVideo(currentPlaybackVideo);
      }
    }

    async function listenForPlaybackVideo() {
      const unlisten = await listen<PlaybackWindowVideo>(
        playbackWindowVideoEvent,
        (event) => {
          if (canUpdatePlaybackVideo) {
            setPlaybackVideo(event.payload);
          }
        },
      );

      return unlisten;
    }

    void loadCurrentPlaybackVideo();
    const unlistenPromise = listenForPlaybackVideo();

    return () => {
      canUpdatePlaybackVideo = false;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return playbackVideo ? <Playback initialVideo={playbackVideo} /> : null;
}
