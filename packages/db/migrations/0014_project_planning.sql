-- Familientool — Grundlage für Projekt-Planung (Status/Zeitraum, Aufgaben,
-- Dokumenten-Verknüpfung) und die neue Zeitleisten-/Tab-Ansicht.
--
-- Bewusst KEINE neuen Tabellen (siehe CLAUDE.md, Datenmodell-Grundsatz,
-- gleiche Linie wie 0011–0013). type='task' ist ein neuer Eintragstyp:
-- Aufgaben gehören hierarchisch zu einem Meilenstein (parent_id).

alter table public.objects add column status text;
alter table public.objects add column start_date date;
alter table public.objects add column parent_id uuid references public.objects(id) on delete cascade;
alter table public.objects add column linked_document_id uuid references public.objects(id) on delete set null;

create index objects_parent_id_idx on public.objects (parent_id);

-- Verwendung (rein konventionell, keine Schema-Erzwingung — wie bei allen
-- anderen type-spezifischen Feldern hier):
-- - type='project': status ('geplant'|'laeuft'|'pausiert'|'abgeschlossen'),
--   start_date = Projektbeginn, due_date (existiert bereits) = Projektende.
-- - type='task': parent_id = zugehöriger Meilenstein, done (existiert
--   bereits) = Erledigt-Status, linked_document_id = optionale Verknüpfung
--   zu einem Dokument des Projekts.
