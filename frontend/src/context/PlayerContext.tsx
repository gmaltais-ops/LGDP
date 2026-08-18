import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";

export type Episode = {
  episode_id: string;
  episode_number: number;
  title: string;
  description?: string;
  cover_image?: string;
  audio_url: string;
  duration?: number;
  release_date?: string;
};

type PlayerState = {
  current: Episode | null;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  play: (ep: Episode) => Promise<void>;
  toggle: () => void;
  seek: (sec: number) => void;
  close: () => void;
};

const PlayerContext = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<Episode | null>(null);
  const player = useAudioPlayer(current?.audio_url ?? null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "duckOthers",
    }).catch(() => {});
  }, []);

  const play = useCallback(async (ep: Episode) => {
    setCurrent(ep);
    // player will refresh with new URL; kick play on next tick
    setTimeout(() => {
      try {
        player.play();
      } catch {}
    }, 100);
  }, [player]);

  const toggle = useCallback(() => {
    if (!current) return;
    if (status?.playing) player.pause();
    else player.play();
  }, [current, status?.playing, player]);

  const seek = useCallback((sec: number) => {
    try {
      player.seekTo(sec);
    } catch {}
  }, [player]);

  const close = useCallback(() => {
    try {
      player.pause();
    } catch {}
    setCurrent(null);
  }, [player]);

  return (
    <PlayerContext.Provider
      value={{
        current,
        isPlaying: !!status?.playing,
        positionSec: status?.currentTime ?? 0,
        durationSec: status?.duration ?? current?.duration ?? 0,
        play,
        toggle,
        seek,
        close,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
