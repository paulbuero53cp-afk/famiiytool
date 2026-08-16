import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { changePassword, clearEncryptionKey } from "../lib/encryptionSession";
import { isCurrentUserAdmin } from "../lib/admin";
import { modules, MODULE_CATEGORY, TOOLS_CATEGORY } from "../lib/modules";
import { PlayerProvider } from "../lib/player";
import { MusicPlayerBar } from "./MusicPlayerBar";

interface ShellProps {
  userId: string;
}

type LayoutMode = "sidebar" | "tiles";

const LAYOUT_STORAGE_KEY = "familientool-layout-mode";

function loadLayoutMode(): LayoutMode {
  const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
  return stored === "tiles" ? "tiles" : "sidebar";
}

export function Shell({ userId }: ShellProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(loadLayoutMode);
  // In der Kachelansicht startet man auf der Übersicht (kein Modul gewählt);
  // in der Seitenleiste ist immer ein Modul aktiv, Sidebar bleibt sichtbar.
  const [activeModuleId, setActiveModuleId] = useState<string | null>(
    loadLayoutMode() === "sidebar" ? "documents" : null,
  );

  const [pwOpen, setPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwInfo, setPwInfo] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    isCurrentUserAdmin(userId).then(setIsAdmin).catch(() => setIsAdmin(false));
  }, [userId]);

  useEffect(() => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, layoutMode);
  }, [layoutMode]);

  function toggleLayout() {
    const next: LayoutMode = layoutMode === "sidebar" ? "tiles" : "sidebar";
    setLayoutMode(next);
    if (next === "sidebar" && !activeModuleId) setActiveModuleId("documents");
    if (next === "tiles") setActiveModuleId(null);
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPwSaving(true);
    setPwError(null);
    setPwInfo(null);
    try {
      await changePassword(userId, newPassword);
      setPwInfo("Passwort geändert, alle sensiblen Felder neu verschlüsselt.");
      setNewPassword("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Passwort konnte nicht geändert werden");
    } finally {
      setPwSaving(false);
    }
  }

  const visibleModules = modules.filter((m) => !m.adminOnly || isAdmin);
  const ActiveComponent = visibleModules.find((m) => m.id === activeModuleId)?.component;
  // Feste Kategorie-Reihenfolge statt Array-Position, damit "Module" nicht
  // durch "Tools" auseinandergerissen wird (Admin steht z. B. hinter Tools
  // in der Registry, gehört aber zu "Module").
  const groupedModules = [MODULE_CATEGORY, TOOLS_CATEGORY]
    .map((category) => ({
      category,
      items: visibleModules.filter((m) => (m.category ?? MODULE_CATEGORY) === category),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <PlayerProvider>
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
        <h1 className="font-display text-lg sm:text-xl">Familientool</h1>
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={toggleLayout}
            className="text-sm text-neutral-500 underline"
            title="Zwischen Seitenleiste und Kachelmenü umschalten"
          >
            {layoutMode === "sidebar" ? "🔳" : "☰"}
            <span className="hidden sm:inline"> {layoutMode === "sidebar" ? "Kachelansicht" : "Seitenleiste"}</span>
          </button>
          <button
            onClick={() => setPwOpen(!pwOpen)}
            className="text-sm text-neutral-500 underline"
            title="Passwort ändern"
          >
            <span className="sm:hidden">🔑</span>
            <span className="hidden sm:inline">Passwort ändern</span>
          </button>
          <button
            onClick={() => {
              clearEncryptionKey();
              supabase.auth.signOut();
            }}
            className="text-sm text-neutral-500 underline"
            title="Ausloggen"
          >
            <span className="sm:hidden">🚪</span>
            <span className="hidden sm:inline">Ausloggen</span>
          </button>
        </div>
      </div>

      {pwOpen && (
        <div className="border-b border-neutral-200 bg-white px-4 py-4 sm:px-6">
          <form onSubmit={handlePasswordChange} className="mx-auto max-w-md space-y-2">
            <p className="text-xs text-neutral-500">
              Ändert dein Login-Passwort und verschlüsselt alle deine sensiblen Felder automatisch mit dem neuen
              Passwort neu.
            </p>
            <input
              type="password"
              required
              minLength={8}
              placeholder="Neues Passwort"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
            />
            <button
              type="submit"
              disabled={pwSaving}
              className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {pwSaving ? "Ändert…" : "Passwort ändern"}
            </button>
            {pwInfo && (
              <p className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700">
                {pwInfo}
              </p>
            )}
            {pwError && (
              <p className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700">
                {pwError}
              </p>
            )}
          </form>
        </div>
      )}

      {layoutMode === "sidebar" ? (
        <div className="flex flex-col sm:flex-row">
          {/* Auf Mobile: horizontal scrollbare Pill-Leiste oben statt fester
              192px-Sidebar, die auf schmalen Screens fast die Hälfte des
              Inhalts wegnehmen würde. Ab sm: wieder die klassische Sidebar. */}
          <nav className="flex shrink-0 gap-1 overflow-x-auto bg-neutral-900 p-2 sm:w-48 sm:flex-col sm:gap-0 sm:space-y-1 sm:overflow-visible sm:p-4">
            {groupedModules.map((group, i) => (
              <div key={group.category} className="flex shrink-0 items-center gap-1 sm:contents">
                {i > 0 && <span className="h-6 w-px shrink-0 bg-neutral-700 sm:hidden" aria-hidden />}
                {i > 0 && (
                  <p className="hidden pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-neutral-500 sm:block">
                    {group.category}
                  </p>
                )}
                {group.items.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setActiveModuleId(m.id)}
                    className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-left text-sm sm:w-full ${
                      activeModuleId === m.id
                        ? "bg-white text-neutral-900"
                        : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
                    }`}
                  >
                    <span>{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <main className="min-w-0 flex-1 px-4 pt-4 pb-28 sm:px-6 sm:pt-6">
            {ActiveComponent && <ActiveComponent userId={userId} />}
          </main>
        </div>
      ) : (
        <main className="px-4 pt-4 pb-28 sm:px-6 sm:pt-6">
          {ActiveComponent ? (
            <div className="mx-auto max-w-2xl space-y-4">
              <button onClick={() => setActiveModuleId(null)} className="text-sm text-neutral-500 underline">
                🏠 Zur Übersicht
              </button>
              <ActiveComponent userId={userId} />
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-6">
              {groupedModules.map((group) => (
                <div key={group.category} className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{group.category}</p>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
                    {group.items.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setActiveModuleId(m.id)}
                        className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm hover:shadow-md sm:p-6"
                      >
                        <span className="text-3xl">{m.icon}</span>
                        <span className="text-sm">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}
      <MusicPlayerBar />
    </div>
    </PlayerProvider>
  );
}
