import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import jsmediatags from "jsmediatags";
import {
  attachFile,
  createDocument,
  deleteDocument,
  listMyDocuments,
  listShares,
  revokeShare,
  shareDocument,
  updatePlaylistTracks,
  type DocumentObject,
  type ShareEntry,
} from "../lib/objects";
import { usePlayer } from "../lib/player";
import { TagInput } from "./TagInput";

interface MusicProps {
  userId: string;
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none";
const fieldLabelClass = "block text-xs font-medium text-neutral-500 mb-1";
const actionButtonClass =
  "inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-200";
const dangerButtonClass =
  "inline-flex items-center gap-1 rounded-full border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50";

type Tab = "library" | "playlists";

export function Music({ userId }: MusicProps) {
  const { playTrack } = usePlayer();
  const [tab, setTab] = useState<Tab>("library");

  const [tracks, setTracks] = useState<DocumentObject[]>([]);
  const [playlists, setPlaylists] = useState<DocumentObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [playlistFormOpen, setPlaylistFormOpen] = useState(false);
  const [playlistTitle, setPlaylistTitle] = useState("");
  const [playlistSaving, setPlaylistSaving] = useState(false);

  const [shareOpenFor, setShareOpenFor] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shares, setShares] = useState<Record<string, ShareEntry[]>>({});

  async function refresh() {
    setLoading(true);
    try {
      const all = await listMyDocuments();
      setTracks(all.filter((d) => d.type === "track"));
      setPlaylists(all.filter((d) => d.type === "playlist"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (!f) return;
    if (!title) setTitle(f.name.replace(/\.mp3$/i, ""));
    jsmediatags.read(f, {
      onSuccess: (tag) => {
        const t = tag.tags;
        if (t.title) setTitle(t.title);
        if (t.artist) setArtist(t.artist);
        if (t.album) setAlbum(t.album);
        if (t.genre) setGenres((prev) => (prev.includes(t.genre as string) ? prev : [...prev, t.genre as string]));
      },
      onError: () => {
        // Keine lesbaren ID3-Tags — Felder bleiben leer/manuell editierbar,
        // kein Fehler-Feedback nötig (rein optionale Komfortfunktion).
      },
    });
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const doc = await createDocument(
        {
          type: "track",
          title,
          content: "",
          sensitiveField: "",
          isTemplate: false,
          tags: genres,
          projectId: null,
          amount: null,
          artist: artist || null,
          album: album || null,
        },
        userId,
      );
      await attachFile(doc, file, userId);
      setFile(null);
      setTitle("");
      setArtist("");
      setAlbum("");
      setGenres([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteTrack(track: DocumentObject) {
    if (!window.confirm(`"${track.title}" wirklich löschen?`)) return;
    setError(null);
    try {
      await deleteDocument(track.id, track.storage_path);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }

  async function handleCreatePlaylist(e: FormEvent) {
    e.preventDefault();
    setPlaylistSaving(true);
    setError(null);
    try {
      await createDocument(
        {
          type: "playlist",
          title: playlistTitle,
          content: "",
          sensitiveField: "",
          isTemplate: false,
          tags: [],
          projectId: null,
          amount: null,
        },
        userId,
      );
      setPlaylistTitle("");
      setPlaylistFormOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playlist konnte nicht angelegt werden");
    } finally {
      setPlaylistSaving(false);
    }
  }

  async function handleDeletePlaylist(playlist: DocumentObject) {
    if (!window.confirm(`Playlist "${playlist.title}" wirklich löschen? Die enthaltenen Tracks bleiben erhalten.`))
      return;
    setError(null);
    try {
      await deleteDocument(playlist.id, null);
      if (selectedPlaylistId === playlist.id) setSelectedPlaylistId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }

  function playlistTracks(playlist: DocumentObject): DocumentObject[] {
    return playlist.track_ids
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is DocumentObject => !!t);
  }

  async function addTrackToPlaylist(playlist: DocumentObject, track: DocumentObject) {
    if (playlist.track_ids.includes(track.id)) return;
    setError(null);
    try {
      await updatePlaylistTracks(playlist.id, [...playlist.track_ids, track.id]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konnte Track nicht hinzufügen");
    }
  }

  async function removeTrackFromPlaylist(playlist: DocumentObject, trackId: string) {
    setError(null);
    try {
      await updatePlaylistTracks(
        playlist.id,
        playlist.track_ids.filter((id) => id !== trackId),
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konnte Track nicht entfernen");
    }
  }

  async function moveTrack(playlist: DocumentObject, index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= playlist.track_ids.length) return;
    const ids = [...playlist.track_ids];
    [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
    setError(null);
    try {
      await updatePlaylistTracks(playlist.id, ids);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konnte nicht umsortieren");
    }
  }

  async function openShare(objectId: string) {
    if (shareOpenFor === objectId) {
      setShareOpenFor(null);
      return;
    }
    setShareOpenFor(objectId);
    try {
      setShares((prev) => ({ ...prev, [objectId]: [] }));
      const list = await listShares(objectId);
      setShares((prev) => ({ ...prev, [objectId]: list }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Freigabe-Liste konnte nicht geladen werden");
    }
  }

  async function handleShare(objectId: string, e: FormEvent) {
    e.preventDefault();
    setSharing(true);
    setError(null);
    try {
      await shareDocument(objectId, shareEmail);
      setShareEmail("");
      const list = await listShares(objectId);
      setShares((prev) => ({ ...prev, [objectId]: list }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Teilen fehlgeschlagen");
    } finally {
      setSharing(false);
    }
  }

  async function handleRevokeShare(objectId: string, share: ShareEntry) {
    setError(null);
    try {
      await revokeShare(objectId, share.userId);
      setShares((prev) => ({ ...prev, [objectId]: prev[objectId].filter((s) => s.userId !== share.userId) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Freigabe konnte nicht entfernt werden");
    }
  }

  function renderShareBlock(objectId: string) {
    if (shareOpenFor !== objectId) return null;
    return (
      <div className="mt-2 border-t border-neutral-200 pt-2">
        <form onSubmit={(e) => handleShare(objectId, e)} className="flex gap-2">
          <input
            type="email"
            required
            placeholder="E-Mail des Familienmitglieds"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs focus:border-neutral-900 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sharing}
            className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {sharing ? "…" : "Freigeben"}
          </button>
        </form>
        {(shares[objectId]?.length ?? 0) > 0 && (
          <div className="space-y-1 pt-2">
            {shares[objectId].map((share) => (
              <div key={share.userId} className="flex items-center justify-between text-xs">
                <span className="text-neutral-700">{share.email ?? share.userId}</span>
                <button onClick={() => handleRevokeShare(objectId, share)} className="text-red-600 underline">
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const selectedPlaylist = selectedPlaylistId ? playlists.find((p) => p.id === selectedPlaylistId) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-4">
      <h2 className="font-display text-2xl">Musik</h2>

      <div className="flex gap-1">
        <button
          onClick={() => {
            setTab("library");
            setSelectedPlaylistId(null);
          }}
          className={`rounded-full px-3 py-1.5 text-sm ${
            tab === "library" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
          }`}
        >
          🎵 Bibliothek
        </button>
        <button
          onClick={() => setTab("playlists")}
          className={`rounded-full px-3 py-1.5 text-sm ${
            tab === "playlists" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
          }`}
        >
          📃 Playlists
        </button>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {tab === "library" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              {tracks.length} {tracks.length === 1 ? "Track" : "Tracks"}
            </h3>
            {!uploadOpen && (
              <button
                onClick={() => setUploadOpen(true)}
                title="MP3 hochladen"
                aria-label="MP3 hochladen"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-lg leading-none text-white hover:bg-neutral-800"
              >
                +
              </button>
            )}
          </div>

          {uploadOpen && (
            <form
              onSubmit={handleUpload}
              className="space-y-2.5 rounded-xl border-t border-t-neutral-900 border-x border-b border-neutral-200 bg-white p-3.5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium uppercase tracking-wide text-neutral-500">MP3 hochladen</h4>
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="text-xs text-neutral-400 hover:text-neutral-700"
                >
                  ✕
                </button>
              </div>
              <div>
                <label className={fieldLabelClass}>MP3-Datei</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,audio/mpeg"
                  required
                  onChange={handleFileChange}
                  className="w-full text-sm text-neutral-500"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Titel/Interpret/Album werden nach Auswahl aus den ID3-Tags vorbefüllt, falls vorhanden.
                </p>
              </div>
              <div>
                <label className={fieldLabelClass}>Titel</label>
                <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={fieldLabelClass}>Interpret</label>
                  <input value={artist} onChange={(e) => setArtist(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={fieldLabelClass}>Album</label>
                  <input value={album} onChange={(e) => setAlbum(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={fieldLabelClass}>Genre</label>
                <TagInput
                  value={genres}
                  onChange={setGenres}
                  suggestions={[...new Set(tracks.flatMap((t) => t.tags))]}
                  placeholder="Genre eingeben und Enter drücken"
                />
              </div>
              <button
                type="submit"
                disabled={uploading}
                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {uploading ? "Lädt hoch…" : "Hochladen"}
              </button>
            </form>
          )}

          {loading && <p className="text-sm text-neutral-500">Lädt…</p>}
          {!loading && tracks.length === 0 && <p className="text-sm text-neutral-500">Noch keine Tracks hochgeladen.</p>}

          <div className="space-y-2">
            {tracks.map((track) => (
              <div key={track.id} className="rounded-xl border border-neutral-200 bg-white p-3.5 hover:shadow-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-900">{track.title}</p>
                  <p className="truncate text-sm text-neutral-500">
                    {[track.artist, track.album].filter(Boolean).join(" — ") || "Unbekannt"}
                  </p>
                </div>
                {track.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {track.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => playTrack(track, tracks)}
                    className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-xs text-white hover:bg-neutral-800"
                  >
                    ▶ Abspielen
                  </button>
                  <button onClick={() => openShare(track.id)} className={actionButtonClass}>
                    🔗 Teilen
                  </button>
                  <button onClick={() => handleDeleteTrack(track)} className={dangerButtonClass}>
                    🗑️ Löschen
                  </button>
                </div>
                {renderShareBlock(track.id)}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "playlists" && !selectedPlaylist && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              {playlists.length} {playlists.length === 1 ? "Playlist" : "Playlists"}
            </h3>
            {!playlistFormOpen && (
              <button
                onClick={() => setPlaylistFormOpen(true)}
                title="Neue Playlist"
                aria-label="Neue Playlist"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-lg leading-none text-white hover:bg-neutral-800"
              >
                +
              </button>
            )}
          </div>

          {playlistFormOpen && (
            <form
              onSubmit={handleCreatePlaylist}
              className="flex flex-wrap items-end gap-2 rounded-xl border border-neutral-200 bg-white p-2.5"
            >
              <div className="min-w-[10rem] flex-1">
                <label className={fieldLabelClass}>Name</label>
                <input
                  required
                  value={playlistTitle}
                  onChange={(e) => setPlaylistTitle(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={playlistSaving}
                className="rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {playlistSaving ? "…" : "Anlegen"}
              </button>
              <button
                type="button"
                onClick={() => setPlaylistFormOpen(false)}
                className="text-xs text-neutral-500 underline"
              >
                Abbrechen
              </button>
            </form>
          )}

          {!loading && playlists.length === 0 && <p className="text-sm text-neutral-500">Noch keine Playlists.</p>}

          <div className="space-y-2">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3.5 hover:shadow-sm"
              >
                <button onClick={() => setSelectedPlaylistId(playlist.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-medium text-neutral-900">{playlist.title}</p>
                  <p className="text-xs text-neutral-500">
                    {playlist.track_ids.length} {playlist.track_ids.length === 1 ? "Track" : "Tracks"}
                  </p>
                </button>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => openShare(playlist.id)} className={actionButtonClass}>
                    🔗
                  </button>
                  <button onClick={() => handleDeletePlaylist(playlist)} className={dangerButtonClass}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "playlists" &&
        selectedPlaylist &&
        (() => {
          const plTracks = playlistTracks(selectedPlaylist);
          const availableTracks = tracks.filter((t) => !selectedPlaylist.track_ids.includes(t.id));
          return (
            <div className="space-y-3">
              <button onClick={() => setSelectedPlaylistId(null)} className="text-sm text-neutral-500 underline">
                ← Playlists
              </button>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg">{selectedPlaylist.title}</h3>
                {plTracks.length > 0 && (
                  <button
                    onClick={() => playTrack(plTracks[0], plTracks)}
                    className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
                  >
                    ▶ Playlist abspielen
                  </button>
                )}
              </div>

              {plTracks.length === 0 && <p className="text-sm text-neutral-500">Noch keine Tracks in dieser Playlist.</p>}
              <div className="space-y-1.5">
                {plTracks.map((track, i) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2"
                  >
                    <button onClick={() => playTrack(track, plTracks)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm text-neutral-900">{track.title}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {[track.artist, track.album].filter(Boolean).join(" — ")}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => moveTrack(selectedPlaylist, i, -1)}
                        disabled={i === 0}
                        className="text-neutral-500 hover:text-neutral-900 disabled:opacity-30"
                        title="Nach oben"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveTrack(selectedPlaylist, i, 1)}
                        disabled={i === plTracks.length - 1}
                        className="text-neutral-500 hover:text-neutral-900 disabled:opacity-30"
                        title="Nach unten"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeTrackFromPlaylist(selectedPlaylist, track.id)}
                        className="text-xs text-red-600 underline"
                        title="Aus Playlist entfernen"
                      >
                        Entfernen
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {availableTracks.length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Aus Bibliothek hinzufügen
                  </h4>
                  <div className="space-y-1.5">
                    {availableTracks.map((track) => (
                      <button
                        key={track.id}
                        onClick={() => addTrackToPlaylist(selectedPlaylist, track)}
                        className="flex w-full items-center justify-between rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-2 text-left hover:border-neutral-900"
                      >
                        <span className="truncate text-sm text-neutral-700">
                          {track.title}
                          {track.artist ? ` — ${track.artist}` : ""}
                        </span>
                        <span className="text-neutral-400">+</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-neutral-200 pt-3">
                <button onClick={() => openShare(selectedPlaylist.id)} className={actionButtonClass}>
                  🔗 Playlist teilen
                </button>
                {renderShareBlock(selectedPlaylist.id)}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
