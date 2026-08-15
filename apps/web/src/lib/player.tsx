import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { getFileUrl, type DocumentObject } from "./objects";

// Lebt in Shell.tsx oberhalb der Modul-Auswahl, damit Musik beim Wechsel
// zwischen Modulen (Dokumente/Projekte/…) weiterläuft — ein Modul wechselt
// nur den Inhalt, der Player-Context bleibt gemountet.
interface PlayerContextValue {
  queue: DocumentObject[];
  currentIndex: number;
  current: DocumentObject | null;
  isPlaying: boolean;
  loading: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
  playTrack: (track: DocumentObject, queue?: DocumentObject[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

// Signierte URL für die Musikwiedergabe lebt länger als der Standard-Download-
// Link (siehe lib/objects.ts::getFileUrl) — ein Song kann länger als 60s
// laufen/gebuffert werden.
const PLAYBACK_URL_EXPIRY_SECONDS = 3600;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DocumentObject[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const current = currentIndex >= 0 ? (queue[currentIndex] ?? null) : null;

  async function loadAndPlay(index: number, list: DocumentObject[]) {
    const track = list[index];
    if (!track?.storage_path) return;
    setLoading(true);
    setError(null);
    setCurrentTime(0);
    setDuration(0);
    try {
      const url = await getFileUrl(track.storage_path, PLAYBACK_URL_EXPIRY_SECONDS);
      const audio = audioRef.current;
      if (!audio) return;
      audio.src = url;
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wiedergabe fehlgeschlagen");
      setIsPlaying(false);
    } finally {
      setLoading(false);
    }
  }

  function playTrack(track: DocumentObject, newQueue?: DocumentObject[]) {
    const list = newQueue ?? [track];
    const index = list.findIndex((t) => t.id === track.id);
    setQueue(list);
    setCurrentIndex(index === -1 ? 0 : index);
    void loadAndPlay(index === -1 ? 0 : index, list);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }

  function next() {
    if (currentIndex < 0 || currentIndex + 1 >= queue.length) return;
    setCurrentIndex(currentIndex + 1);
    void loadAndPlay(currentIndex + 1, queue);
  }

  function prev() {
    if (currentIndex <= 0) return;
    setCurrentIndex(currentIndex - 1);
    void loadAndPlay(currentIndex - 1, queue);
  }

  function seek(time: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(time)) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }

  const value = useMemo(
    () => ({
      queue,
      currentIndex,
      current,
      isPlaying,
      loading,
      error,
      currentTime,
      duration,
      playTrack,
      togglePlay,
      next,
      prev,
      seek,
      audioRef,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue, currentIndex, current, isPlaying, loading, error, currentTime, duration],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        onEnded={next}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        className="hidden"
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer muss innerhalb von PlayerProvider verwendet werden");
  return ctx;
}
