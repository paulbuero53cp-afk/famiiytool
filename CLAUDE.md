# CLAUDE.md — Familientool

## Projektkontext
Privates Familientool, entwickelt von zwei Personen mit je eigenem
Claude-Pro-Account + Claude Code. Lernprojekt mit echtem Alltagsnutzen
für 4 Personen. Vollständig getrennt von jeglicher Firmeninfrastruktur.

## Architektur (bindend, nicht zur Diskussion ohne explizite Änderung hier)
- Frontend: React + TypeScript + Vite, PWA-fähig
- Backend: Supabase (Postgres, Auth, Storage), EU-Region Frankfurt
- Hosting: Vercel, GitHub-CI/CD (main = Production, PRs = Preview)
- Kein Azure, kein M365-Tenant (weder Business noch Family) für
  Infrastruktur — M365 Family nur als spätere Datenquelle (Mail-Sync)

## Datenmodell-Grundsatz
Generisches Objekt-Schema, keine siloartigen Tabellen pro Feature:
- `objects`: id, owner_id, type, title, content, encrypted_field,
  storage_path (nullable), is_template (boolean), tags[], created_at,
  updated_at
- `object_permissions`: object_id, user_id, permission_level
  (explizites Teilen, kein automatischer Zugriff)
- `access_log`: object_id, admin_id, timestamp, reason
  (Pflicht bei jedem Break-Glass-Zugriff)
- `users.role`: admin | user

## Sicherheitsregeln (nicht verhandelbar, ab der ersten Tabelle)
1. Row-Level Security ist Pflicht, kein Nachrüsten. Default: nur
   Owner sieht ein Objekt. Teilen ist immer explizit.
2. Binärdateien NIE in der DB — immer Supabase Storage, mit eigener
   Policy, Zugriff nur über signierte, zeitlich begrenzte URLs.
3. Sensible Freitextfelder werden anwendungsseitig verschlüsselt,
   bevor sie in die DB geschrieben werden (nicht nur Encryption-at-rest).
4. Kein automatischer LLM-Call beim Speichern — nur nach explizitem
   Klick (Opt-in pro Dokument).
5. Admin hat KEINEN automatischen Content-Zugriff. Nur über
   protokollierten Break-Glass-Vorgang mit Begründungspflicht,
   für den betroffenen Owner einsehbar.

## Was NICHT gebaut wird (aktuell)
- Mail-/Ordner-Sync (Ausbaustufe 2, nach Vertical Slice + Vertrauenspause)
- Embeddings/pgvector/RAG (Ausbaustufe 2, nach Sync)
- Projekt-Modul mit Templates, Finanzverwaltung, Haus-Organisation
- Medien-Pipeline (TTS/Video), Solaranlage-Integration
- Schulhelfer-Notendaten — BLOCKIERT bis Klärung mit Schulträger

## Git-Workflow
- Feature-Branches: `feature/<psp-nummer>-<kurzname>`
- Pull Request Pflicht, kein direkter Push auf `main`
- Mindestens 1 Review durch die andere Person; bei Security-relevanten
  Änderungen (RLS, Storage-Policies, Verschlüsselung, Rollen) zusätzlich
  Claudius als zweite Prüfinstanz
- Vor jedem Arbeitspaket: Claude Code Plan-Modus nutzen, Plan in der
  PR-Beschreibung dokumentieren

## Mini-Tools (Referenz)
Mini-Tools sind bewusst zustandslos: kein Schreiben in die Datenbank,
reiner Upload → Verarbeitung im Browser → Download. Liegen unter
`/apps/web/public/`.
