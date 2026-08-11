import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { changePassword, clearEncryptionKey } from "../lib/encryptionSession";
import { isCurrentUserAdmin } from "../lib/admin";
import { modules } from "../lib/modules";

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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <h1 className="text-lg font-medium">Familientool</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleLayout}
            className="text-sm text-slate-400 underline"
            title="Zwischen Seitenleiste und Kachelmenü umschalten"
          >
            {layoutMode === "sidebar" ? "🔳 Kachelansicht" : "☰ Seitenleiste"}
          </button>
          <button onClick={() => setPwOpen(!pwOpen)} className="text-sm text-slate-400 underline">
            Passwort ändern
          </button>
          <button
            onClick={() => {
              clearEncryptionKey();
              supabase.auth.signOut();
            }}
            className="text-sm text-slate-400 underline"
          >
            Ausloggen
          </button>
        </div>
      </div>

      {pwOpen && (
        <div className="border-b border-slate-800 px-6 py-4">
          <form onSubmit={handlePasswordChange} className="mx-auto max-w-md space-y-2">
            <p className="text-xs text-slate-500">
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
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={pwSaving}
              className="rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
            >
              {pwSaving ? "Ändert…" : "Passwort ändern"}
            </button>
            {pwInfo && <p className="text-sm text-emerald-400">{pwInfo}</p>}
            {pwError && <p className="text-sm text-red-400">{pwError}</p>}
          </form>
        </div>
      )}

      {layoutMode === "sidebar" ? (
        <div className="flex">
          <nav className="w-48 shrink-0 border-r border-slate-800 p-4 space-y-1">
            {visibleModules.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveModuleId(m.id)}
                className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm ${
                  activeModuleId === m.id ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:bg-slate-800/50"
                }`}
              >
                <span>{m.icon}</span>
                {m.label}
              </button>
            ))}
          </nav>
          <main className="flex-1 p-6">
            {ActiveComponent && <ActiveComponent userId={userId} />}
          </main>
        </div>
      ) : (
        <main className="p-6">
          {ActiveComponent ? (
            <div className="mx-auto max-w-2xl space-y-4">
              <button onClick={() => setActiveModuleId(null)} className="text-sm text-slate-400 underline">
                🏠 Zur Übersicht
              </button>
              <ActiveComponent userId={userId} />
            </div>
          ) : (
            <div className="mx-auto grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
              {visibleModules.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setActiveModuleId(m.id)}
                  className="flex flex-col items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 p-6 hover:bg-slate-700"
                >
                  <span className="text-3xl">{m.icon}</span>
                  <span className="text-sm">{m.label}</span>
                </button>
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
