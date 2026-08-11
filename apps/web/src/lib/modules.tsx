// Zentrale Modul-Registry für die Navigation (Seitenleiste + Kachelmenü,
// siehe components/Shell.tsx). Neue Module künftig hier eintragen — Shell
// und beide Layouts lesen ausschließlich aus dieser Liste, keine Änderung
// an Shell.tsx nötig, um ein weiteres Modul anzuzeigen.
//
// Projekte/Finanzen/Haus/Schulhelfer sind bewusst KEINE eigenen Komponenten
// mit eigener Logik, sondern nur die generische Documents-Komponente mit
// anderen Vorgaben (siehe CLAUDE.md, Datenmodell-Grundsatz: ein Objekt-
// Schema statt Silos pro Feature).

import type { ComponentType } from "react";
import { Documents } from "../components/Documents";
import { Admin } from "../components/Admin";

export interface ModuleDefinition {
  id: string;
  label: string;
  icon: string;
  component: ComponentType<{ userId: string }>;
  adminOnly?: boolean;
}

function ProjectsModule({ userId }: { userId: string }) {
  return (
    <Documents
      userId={userId}
      objectType="project"
      heading="Projekte"
      emptyLabel="Noch keine Projekte — leg eins an, z. B. Urlaub, Hausbau oder Masterarbeit."
    />
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
  { id: "admin", label: "Admin", icon: "⚙️", component: Admin, adminOnly: true },
];
