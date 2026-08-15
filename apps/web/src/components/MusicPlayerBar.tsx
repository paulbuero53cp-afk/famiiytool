import { usePlayer } from "../lib/player";

export function MusicPlayerBar() {
  const { current, isPlaying, loading, error, togglePlay, next, prev, queue, currentIndex } = usePlayer();

  if (!current) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 px-4 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-900">{current.title}</p>
          <p className="truncate text-xs text-neutral-500">
            {[current.artist, current.album].filter(Boolean).join(" — ") || "Unbekannt"}
          </p>
        </div>
        <button
          onClick={prev}
          disabled={currentIndex <= 0}
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
          title="Vorheriger Track"
        >
          ⏮
        </button>
        <button
          onClick={togglePlay}
          disabled={loading}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
          title={isPlaying ? "Pause" : "Abspielen"}
        >
          {loading ? "…" : isPlaying ? "⏸" : "▶"}
        </button>
        <button
          onClick={next}
          disabled={currentIndex < 0 || currentIndex + 1 >= queue.length}
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 disabled:opacity-30"
          title="Nächster Track"
        >
          ⏭
        </button>
      </div>
      {error && <p className="mx-auto mt-1 max-w-2xl text-xs text-red-600">{error}</p>}
    </div>
  );
}
