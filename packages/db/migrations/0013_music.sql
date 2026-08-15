-- Familientool — Grundlage für Musikverwaltung (Tracks, Playlists)
--
-- Bewusst KEINE neuen Tabellen (siehe CLAUDE.md, Datenmodell-Grundsatz,
-- gleiche Linie wie 0011/0012). Ein "Track" ist ein objects-Eintrag mit
-- type='track' (title = Songtitel, artist, album, storage_path = die
-- MP3-Datei über den bestehenden Storage-Mechanismus, tags = Genre). Eine
-- "Playlist" ist ein Eintrag mit type='playlist' (title, content = optionale
-- Beschreibung, track_ids = geordnetes Array von Track-IDs — die Reihenfolge
-- im Array ist die Playlist-Reihenfolge, kein Join-Table nötig). Keine neue
-- RLS nötig — die bestehenden objects-Policies aus 0001_init.sql sind
-- type-unabhängig.

alter table public.objects add column artist text;
alter table public.objects add column album text;
alter table public.objects add column track_ids uuid[] not null default '{}';
