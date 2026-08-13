# Familientool — Einstieg für neue Teammitglieder

Willkommen im Familientool-Projekt! Diese Anleitung führt dich Schritt für
Schritt durch die Einrichtung, damit du lokal entwickeln und Änderungen
beitragen kannst.

## Kontext in Kürze

Ein privates Familientool, entwickelt von zwei Personen mit je eigenem
Claude-Pro-Account + Claude Code. Stack: React/TypeScript/Vite (Frontend),
Supabase (Datenbank/Auth/Storage), Vercel (Hosting). Alle Grundsatzregeln
zu Architektur und Sicherheit stehen in [`/CLAUDE.md`](../CLAUDE.md) im
Repo-Root — die solltest du als Erstes lesen, bevor du Code änderst.

---

## Schritt 1 — GitHub-Zugang

1. Falls noch nicht vorhanden: [GitHub-Account](https://github.com/signup)
   anlegen.
2. Deinen GitHub-Benutzernamen an den Projekt-Owner geben — er fügt dich als
   Collaborator zum Repo hinzu:
   [github.com/paulbuero53cp-afk/famiiytool](https://github.com/paulbuero53cp-afk/famiiytool)
3. Einladung annehmen (kommt per E-Mail oder Benachrichtigung auf GitHub).

## Schritt 2 — Repo lokal klonen

```bash
git clone https://github.com/paulbuero53cp-afk/famiiytool.git
```

**Wichtig — Speicherort:** Klone das Repo in einen normalen lokalen Ordner,
**nicht** in einen Cloud-Sync-Ordner (OneDrive, Dropbox, Google Drive o. ä.).
Cloud-Sync-Tools greifen auf dieselben Dateien zu wie Git und `node_modules`
und können zu Sperrkonflikten oder unnötigem Sync-Traffic führen. Git selbst
*ist* bereits der Synchronisationsmechanismus zwischen den Rechnern —
ein zusätzliches Cloud-Tool obendrüber ist eher Störung als Hilfe.

Beispiel für einen guten Pfad:
```
Windows:  C:\Users\<name>\projects\famiiytool
Mac/Linux: ~/dev/famiiytool
```

## Schritt 3 — Node.js + Abhängigkeiten

Node.js installieren (falls noch nicht vorhanden): [nodejs.org](https://nodejs.org)

Dann im Projektordner:
```bash
cd famiiytool/apps/web
npm install
```

## Schritt 4 — Umgebungsvariablen (`.env`)

Datei `apps/web/.env` anlegen (wird nie committet, steht in `.gitignore`)
mit folgendem Inhalt:

```
VITE_SUPABASE_URL=https://ghbmxsypqofiguthoqwt.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_U2bwWmIKI6LyfOxsUGiTCA_efP_Xww_
```

Beide Werte sind öffentliche, für den Client bestimmte Schlüssel — unkritisch,
dürfen geteilt werden. Die eigentliche Sicherheit läuft über Row-Level-Security
in der Datenbank, nicht über die Geheimhaltung dieser Werte.

## Schritt 5 — Dev-Server starten

```bash
npm run dev
```

Läuft standardmäßig auf `http://localhost:5173` (oder einen freien Port
danach, falls belegt).

## Schritt 6 — Echten Account registrieren

In der App (lokal oder auf [famiiytool.vercel.app](https://famiiytool.vercel.app))
über "Noch keinen Account? Registrieren" einen **eigenen** Account anlegen —
nicht die vorhandenen Test-Accounts weiterverwenden. E-Mail bestätigen, dann
einloggen. Beim ersten Login wird automatisch dein persönlicher
Verschlüsselungs-Schlüssel eingerichtet.

## Schritt 7 — Claude Pro + Claude Code

Für die Mitarbeit am Code: eigenen Claude-Pro-Account + Claude Code
einrichten. Jede Person arbeitet mit ihrer eigenen Session — kein
gemeinsamer Account, keine automatische Synchronisation zwischen den
Claude-Code-Sessions der beiden Personen. Die Abstimmung läuft
ausschließlich über Git (siehe Schritt 8) und `/CLAUDE.md` als
gemeinsamen Dauer-Kontext.

## Schritt 8 — Git-Workflow

- **Kein direkter Push auf `main`** — ist technisch gesperrt (Branch-Schutz),
  nicht nur Konvention.
- Für jede Änderung einen eigenen Branch anlegen:
  ```bash
  git checkout -b feature/<kurzbeschreibung>
  ```
- Änderungen committen, pushen, dann Pull Request auf GitHub öffnen.
- Vor dem Merge: Code von der jeweils anderen Person reviewen lassen,
  besonders bei sicherheitsrelevanten Änderungen (RLS, Storage-Policies,
  Verschlüsselung, Rollen).
- Nach dem Merge: lokal auf `main` wechseln und `git pull`.

---

## Nützliche Links

| Was | Wo |
|---|---|
| Repo | [github.com/paulbuero53cp-afk/famiiytool](https://github.com/paulbuero53cp-afk/famiiytool) |
| Live-App | [famiiytool.vercel.app](https://famiiytool.vercel.app) |
| Grundsatzregeln | [`/CLAUDE.md`](../CLAUDE.md) im Repo-Root |
| Offene Aufgaben | [GitHub Issues](https://github.com/paulbuero53cp-afk/famiiytool/issues) |

## Bei Problemen

Kurz in der gemeinsamen Absprache (z. B. wöchentlicher Sync) klären, oder
als GitHub Issue festhalten — nicht stillschweigend selbst lösen, wenn es
Architektur oder Sicherheit betrifft (siehe `CLAUDE.md`, Abschnitt
Git-Workflow: sicherheitsrelevante Änderungen brauchen eine zweite
Prüfinstanz).
