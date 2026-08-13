-- Familientool — Grundlage für Projekt-Workspace (Ordner, Meilensteine)
--
-- Bewusst KEINE neuen Tabellen (siehe CLAUDE.md, Datenmodell-Grundsatz).
-- Ein "Ordner" ist ein objects-Eintrag mit type='folder' (project_id =
-- zugehöriges Projekt, folder_id = null — Ordner liegen nie ineinander,
-- die Ordnertiefe ist bewusst auf 1 Ebene begrenzt). Ein "Meilenstein" ist
-- ein Eintrag mit type='milestone' (title, content als Beschreibung,
-- due_date, done, project_id). Dokumente auf Projekt-Ebene 1 haben
-- project_id gesetzt und folder_id = null; Dokumente in einem Unterordner
-- haben zusätzlich folder_id gesetzt. Keine neue RLS nötig — die
-- bestehenden objects-Policies aus 0001_init.sql sind type-unabhängig.

alter table public.objects add column folder_id uuid references public.objects(id) on delete set null;
alter table public.objects add column due_date date;
alter table public.objects add column done boolean not null default false;

create index objects_folder_id_idx on public.objects (folder_id);
