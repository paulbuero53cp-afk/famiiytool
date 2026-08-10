# packages/db

Supabase-Migrationen für das Familientool. Sicherheitsregeln siehe `/CLAUDE.md`.

## Anwenden

Voraussetzung: [Supabase CLI](https://supabase.com/docs/guides/cli), verknüpft mit dem
Projekt (EU-Region Frankfurt).

```bash
supabase link --project-ref <project-ref>
supabase db push
```

## Migrationen

- `0001_init.sql` — Basis-Schema (`profiles`, `objects`, `object_permissions`,
  `access_log`) inkl. RLS-Policies (Default: nur Owner sieht sein Objekt)
- `0002_break_glass.sql` — `admin_break_glass_read()`: einziger Weg für Admins,
  auf fremde Objekte zuzugreifen — erzwingt Begründung, schreibt immer zuerst
  den `access_log`-Eintrag
- `0003_storage.sql` — privater `objects`-Bucket + Storage-Policies, getrennt
  von der DB-RLS, gekoppelt an `owner_id` im Storage-Pfad

## Erweiterbarkeit (bewusst noch nicht gebaut)

Schema ist so angelegt, dass Ausbaustufe 2 ohne Migration-Bruch andocken kann:
- Verknüpfungen zwischen Objekten (z. B. Dokument ↔ Projekt)
- `embedding vector` Spalte auf `objects` (pgvector) für RAG-Retrieval
