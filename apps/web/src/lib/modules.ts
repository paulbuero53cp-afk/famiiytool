// Zentrale Modul-Registry für die Navigation (Seitenleiste + Kachelmenü,
// siehe components/Shell.tsx). Neue Module künftig hier eintragen — Shell
// und beide Layouts lesen ausschließlich aus dieser Liste, keine Änderung
// an Shell.tsx nötig, um ein weiteres Modul anzuzeigen.

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

export const modules: ModuleDefinition[] = [
  { id: "documents", label: "Dokumente", icon: "📄", component: Documents },
  { id: "admin", label: "Admin", icon: "⚙️", component: Admin, adminOnly: true },
];
