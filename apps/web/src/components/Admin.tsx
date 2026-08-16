import { useEffect, useState, type FormEvent } from "react";
import {
  breakGlassRead,
  createUser,
  deleteUser,
  listAccessLogForObject,
  listProfiles,
  listUsageLog,
  setUserRole,
  type AccessLogEntry,
  type Profile,
  type UsageLogEntry,
} from "../lib/admin";

interface AdminProps {
  userId: string;
}

export function Admin({ userId }: AdminProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [usage, setUsage] = useState<UsageLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  const [deleteConfirmFor, setDeleteConfirmFor] = useState<string | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [breakGlassObjectId, setBreakGlassObjectId] = useState("");
  const [breakGlassReason, setBreakGlassReason] = useState("");
  const [breakGlassResult, setBreakGlassResult] = useState<Record<string, unknown> | null>(null);
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([]);
  const [breakGlassBusy, setBreakGlassBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [profileList, usageList] = await Promise.all([listProfiles(), listUsageLog()]);
      setProfiles(profileList);
      setUsage(usageList);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleRoleChange(profile: Profile, role: "admin" | "user") {
    setError(null);
    try {
      await setUserRole(profile.id, role);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rolle konnte nicht geändert werden");
    }
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setCreatingUser(true);
    setError(null);
    try {
      await createUser(newUserEmail, newUserPassword);
      setNewUserEmail("");
      setNewUserPassword("");
      setCreateOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nutzer konnte nicht angelegt werden");
    } finally {
      setCreatingUser(false);
    }
  }

  function openDeleteConfirm(profile: Profile) {
    setDeleteConfirmFor(deleteConfirmFor === profile.id ? null : profile.id);
    setDeleteConfirmEmail("");
    setError(null);
  }

  async function handleDeleteUser(profile: Profile) {
    setDeletingUserId(profile.id);
    setError(null);
    try {
      await deleteUser(profile.id);
      setDeleteConfirmFor(null);
      setDeleteConfirmEmail("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nutzer konnte nicht gelöscht werden");
    } finally {
      setDeletingUserId(null);
    }
  }

  async function handleBreakGlass(e: FormEvent) {
    e.preventDefault();
    setBreakGlassBusy(true);
    setError(null);
    setBreakGlassResult(null);
    try {
      const result = await breakGlassRead(breakGlassObjectId, breakGlassReason);
      setBreakGlassResult(result);
      setAccessLog(await listAccessLogForObject(breakGlassObjectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Break-Glass-Zugriff fehlgeschlagen");
    } finally {
      setBreakGlassBusy(false);
    }
  }

  const totalCost = usage.reduce((sum, u) => sum + u.estimated_cost_usd, 0);

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      {loading && <p className="text-sm text-neutral-500">Lädt…</p>}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Nutzerverwaltung</h2>
          {!createOpen && (
            <button
              onClick={() => setCreateOpen(true)}
              title="Neuen Nutzer anlegen"
              aria-label="Neuen Nutzer anlegen"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-lg leading-none text-white hover:bg-neutral-800"
            >
              +
            </button>
          )}
        </div>

        {createOpen && (
          <form
            onSubmit={handleCreateUser}
            className="space-y-2.5 rounded-lg border-t-2 border-t-neutral-900 border-x border-b border-neutral-200 bg-white p-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">Neuen Nutzer anlegen</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="text-xs text-neutral-400 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>
            <input
              type="email"
              required
              placeholder="E-Mail"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Erstpasswort (mind. 8 Zeichen)"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
            />
            <p className="text-xs text-neutral-500">
              Account ist sofort nutzbar (keine Bestätigungsmail) — das Erstpasswort musst du der Person selbst
              mitteilen.
            </p>
            <button
              type="submit"
              disabled={creatingUser}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {creatingUser ? "Legt an…" : "Anlegen"}
            </button>
          </form>
        )}

        <div className="space-y-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-neutral-200 bg-white p-3 hover:border-neutral-400"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-900">{p.email ?? p.id}</span>
                <div className="flex items-center gap-2">
                  <span className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600">{p.role}</span>
                  <button
                    onClick={() => handleRoleChange(p, p.role === "admin" ? "user" : "admin")}
                    className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
                  >
                    {p.role === "admin" ? "Admin entziehen" : "Zu Admin machen"}
                  </button>
                  <button
                    onClick={() => openDeleteConfirm(p)}
                    disabled={p.id === userId}
                    title={p.id === userId ? "Der eigene Account kann nicht gelöscht werden" : "Nutzer löschen"}
                    className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Löschen
                  </button>
                </div>
              </div>

              {deleteConfirmFor === p.id && (
                <div className="mt-3 space-y-2 border-t border-neutral-200 pt-3">
                  <p className="text-xs text-red-700">
                    Löscht den Account <strong>unwiderruflich</strong> inkl. ALLER seiner Daten (Dokumente,
                    Projekte, Musik, alles). Zum Bestätigen die E-Mail-Adresse <strong>{p.email}</strong> exakt
                    eintippen.
                  </p>
                  <input
                    value={deleteConfirmEmail}
                    onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                    placeholder="E-Mail zur Bestätigung eintippen"
                    className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteUser(p)}
                      disabled={deleteConfirmEmail !== p.email || deletingUserId === p.id}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deletingUserId === p.id ? "Löscht…" : "Endgültig löschen"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmFor(null)}
                      className="text-xs text-neutral-500 underline"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">LLM-Kosten-Monitoring</h2>
        <p className="text-sm text-neutral-500">
          Gesamt (letzte 100 Aufrufe): <span className="text-emerald-700">${totalCost.toFixed(4)}</span>
        </p>
        <div className="max-h-64 overflow-y-auto rounded-lg border border-neutral-200">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="p-2 text-left">Zeit</th>
                <th className="p-2 text-left">Modell</th>
                <th className="p-2 text-right">Input</th>
                <th className="p-2 text-right">Output</th>
                <th className="p-2 text-right">Kosten</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.id} className="border-t border-neutral-200 text-neutral-700">
                  <td className="p-2">{new Date(u.created_at).toLocaleString("de-DE")}</td>
                  <td className="p-2">{u.model}</td>
                  <td className="p-2 text-right">{u.input_tokens}</td>
                  <td className="p-2 text-right">{u.output_tokens}</td>
                  <td className="p-2 text-right">${u.estimated_cost_usd.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Break-Glass-Zugriff</h2>
        <p className="text-xs text-neutral-500">
          Zugriff auf ein fremdes Objekt nur mit Pflichtbegründung — wird automatisch protokolliert, der Owner kann
          den Log-Eintrag zu seinem Objekt einsehen. Verschlüsselte sensible Felder bleiben auch hier unlesbar (das
          Passwort des Owners kennt niemand außer ihm selbst).
        </p>
        <form
          onSubmit={handleBreakGlass}
          className="space-y-2 rounded-lg border border-neutral-200 bg-white p-4"
        >
          <input
            placeholder="Objekt-ID"
            required
            value={breakGlassObjectId}
            onChange={(e) => setBreakGlassObjectId(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
          <input
            placeholder="Begründung (Pflicht)"
            required
            value={breakGlassReason}
            onChange={(e) => setBreakGlassReason(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
          <button
            type="submit"
            disabled={breakGlassBusy}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {breakGlassBusy ? "…" : "Zugriff anfordern"}
          </button>
        </form>

        {breakGlassResult && (
          <pre className="overflow-x-auto rounded-lg bg-neutral-900 p-3 text-xs text-emerald-300">
            {JSON.stringify(breakGlassResult, null, 2)}
          </pre>
        )}

        {accessLog.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm text-neutral-700">Zugriffs-Log für dieses Objekt</h3>
            {accessLog.map((entry) => (
              <p key={entry.id} className="text-xs text-neutral-500">
                {new Date(entry.created_at).toLocaleString("de-DE")} — {entry.reason}
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
