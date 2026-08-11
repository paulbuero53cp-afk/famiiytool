-- Familientool — Grundlage für Projekt-Modul, Finanzverwaltung, Haus-Organisation
--
-- Bewusst KEINE neuen Tabellen (siehe CLAUDE.md, Datenmodell-Grundsatz:
-- generisches Objekt-Schema statt siloartiger Tabellen pro Feature).
-- Ein "Projekt" ist einfach ein objects-Eintrag mit type='project'. Eine
-- "Ausgabe" (Finanzverwaltung) ist ein Eintrag mit type='expense'. Beide
-- Module sind reine gefilterte Ansichten auf dieselbe Tabelle (Documents.tsx
-- mit typeFilter/presetTag-Props) — keine neue RLS nötig, die bestehenden
-- objects-Policies gelten unverändert für jeden type-Wert.

alter table public.objects add column project_id uuid references public.objects(id) on delete set null;
alter table public.objects add column amount numeric(10, 2);

create index objects_project_id_idx on public.objects (project_id);
