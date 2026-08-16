// Zentrale Modul-Registry für die Navigation (Seitenleiste + Kachelmenü,
// siehe components/Shell.tsx). Neue Module künftig hier eintragen — Shell
// und beide Layouts lesen ausschließlich aus dieser Liste, keine Änderung
// an Shell.tsx nötig, um ein weiteres Modul anzuzeigen.
//
// Projekte/Finanzen/Haus/Schulhelfer sind bewusst KEINE eigenen Komponenten
// mit eigener Logik, sondern nur die generische Documents-Komponente mit
// anderen Vorgaben (siehe CLAUDE.md, Datenmodell-Grundsatz: ein Objekt-
// Schema statt Silos pro Feature).

import { useEffect, useState, type ComponentType } from "react";
import { Documents } from "../components/Documents";
import { Admin } from "../components/Admin";
import { ProjectWorkspace } from "../components/ProjectWorkspace";
import { ProjectWizard } from "../components/ProjectWizard";
import { Music } from "../components/Music";
import { Tools } from "../components/Tools";
import { listMyDocuments, type DocumentObject } from "./objects";

// Module ohne explizite category laufen in der Navigation unter "Module"
// (siehe Shell.tsx, das nach category gruppiert).
export const MODULE_CATEGORY = "Module";
export const TOOLS_CATEGORY = "Tools";

export interface ModuleDefinition {
  id: string;
  label: string;
  icon: string;
  component: ComponentType<{ userId: string }>;
  adminOnly?: boolean;
  category?: string;
}

function formatShortDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("de-DE");
}

// Projekte-Liste ist der Einstiegspunkt; ein Klick auf "Öffnen" wechselt in
// den Projekt-Workspace (Meilensteine/Ordner/Dokumente, siehe
// components/ProjectWorkspace.tsx) statt nur inline zu bearbeiten. Anlegen
// läuft über den ProjectWizard statt des generischen Documents-Formulars
// (siehe components/ProjectWizard.tsx) — Documents wird hier mit
// hideHeader eingebunden, damit nicht zwei Kopfzeilen/Anlege-Bereiche
// übereinander stehen.
function ProjectsModule({ userId }: { userId: string }) {
  const [openProject, setOpenProject] = useState<DocumentObject | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Für den Meilenstein-Kurzblick pro Projekt-Karte — Documents.tsx kennt
  // Meilensteine nicht, daher hier separat geladen und über renderExtra
  // an die Karte durchgereicht.
  const [milestonesByProject, setMilestonesByProject] = useState<Record<string, DocumentObject[]>>({});

  useEffect(() => {
    listMyDocuments()
      .then((all) => {
        const grouped: Record<string, DocumentObject[]> = {};
        for (const d of all) {
          if (d.type !== "milestone" || !d.project_id) continue;
          (grouped[d.project_id] ??= []).push(d);
        }
        for (const pid in grouped) {
          grouped[pid].sort((a, b) => (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99"));
        }
        setMilestonesByProject(grouped);
      })
      .catch(() => {});
  }, [refreshKey]);

  if (openProject) {
    return <ProjectWorkspace userId={userId} project={openProject} onBack={() => setOpenProject(null)} />;
  }

  function renderMilestoneSummary(doc: DocumentObject) {
    const ms = milestonesByProject[doc.id];
    if (!ms || ms.length === 0) return null;
    const first = ms[0];
    const last = ms[ms.length - 1];
    const parts = [first.due_date ? `Start: ${formatShortDate(first.due_date)}` : null];
    if (last !== first && last.due_date) parts.push(`Ende: ${formatShortDate(last.due_date)}`);
    const text = parts.filter(Boolean).join(" · ");
    if (!text) return null;
    return <p className="mt-1.5 text-xs text-neutral-500">{text}</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Projekte</h2>
        {!wizardOpen && (
          <button
            onClick={() => setWizardOpen(true)}
            title="Neues Projekt"
            aria-label="Neues Projekt"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-lg leading-none text-white hover:bg-neutral-800"
          >
            +
          </button>
        )}
      </div>

      {wizardOpen && (
        <ProjectWizard
          userId={userId}
          onCancel={() => setWizardOpen(false)}
          onDone={() => {
            setWizardOpen(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      <Documents
        key={refreshKey}
        userId={userId}
        objectType="project"
        hideHeader
        onOpen={setOpenProject}
        renderExtra={renderMilestoneSummary}
        emptyLabel="Noch keine Projekte — leg eins an, z. B. Urlaub, Hausbau oder Masterarbeit."
      />
    </div>
  );
}

function FinanceModule({ userId }: { userId: string }) {
  return (
    <Documents
      userId={userId}
      objectType="expense"
      heading="Finanzverwaltung"
      showAmount
      showProjectPicker
      showSum
      emptyLabel="Noch keine Ausgaben erfasst."
    />
  );
}

function HouseModule({ userId }: { userId: string }) {
  return (
    <Documents
      userId={userId}
      presetTag="haus"
      heading="Haus-Organisation"
      showProjectPicker
      emptyLabel='Noch keine Haus-Dokumente — beim Anlegen wird automatisch das Tag „haus" gesetzt.'
    />
  );
}

function SchoolModule({ userId }: { userId: string }) {
  return (
    <Documents
      userId={userId}
      presetTag="schule"
      heading="Schulhelfer (Textmaterial)"
      emptyLabel="Noch kein Unterrichtsmaterial abgelegt."
    />
  );
}

export const modules: ModuleDefinition[] = [
  { id: "documents", label: "Dokumente", icon: "📄", component: Documents },
  { id: "projects", label: "Projekte", icon: "🗂️", component: ProjectsModule },
  { id: "finance", label: "Finanzen", icon: "💶", component: FinanceModule },
  { id: "house", label: "Haus", icon: "🏠", component: HouseModule },
  { id: "school", label: "Schulhelfer", icon: "🎒", component: SchoolModule },
  { id: "music", label: "Musik", icon: "🎵", component: Music },
  { id: "tools", label: "Tools", icon: "🧰", component: Tools, category: TOOLS_CATEGORY },
  { id: "admin", label: "Admin", icon: "⚙️", component: Admin, adminOnly: true },
];
