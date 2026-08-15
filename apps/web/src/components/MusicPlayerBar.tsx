import { usePlayer } from "../lib/player";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MusicPlayerBar() {
  const { current, isPlaying, loading, error, togglePlay, next, prev, seek, queue, currentIndex, currentTime, duration } =
    usePlayer();

  if (!current) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 px-4 py-2 backdrop-blur">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
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

        <div className="flex items-center gap-2 pt-0.5">
          <span className="w-9 shrink-0 text-right text-xs tabular-nums text-neutral-500">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            disabled={!duration}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-200 accent-neutral-900 disabled:cursor-default"
          />
          <span className="w-9 shrink-0 text-xs tabular-nums text-neutral-500">{formatTime(duration)}</span>
        </div>
      </div>
      {error && <p className="mx-auto mt-1 max-w-2xl text-xs text-red-600">{error}</p>}
    </div>
  );
}
