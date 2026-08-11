import { useEffect, useState, type FormEvent } from "react";
import {
  breakGlassRead,
  listAccessLogForObject,
  listProfiles,
  listUsageLog,
  setUserRole,
  type AccessLogEntry,
  type Profile,
  type UsageLogEntry,
} from "../lib/admin";

export function Admin() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [usage, setUsage] = useState<UsageLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && <p className="text-sm text-slate-400">Lädt…</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Nutzerverwaltung</h2>
        <div className="space-y-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 p-3"
            >
              <span className="text-sm">{p.email ?? p.id}</span>
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-700 px-2 py-0.5 text-xs">{p.role}</span>
                <button
                  onClick={() => handleRoleChange(p, p.role === "admin" ? "user" : "admin")}
                  className="text-xs text-slate-300 underline"
                >
                  {p.role === "admin" ? "Admin entziehen" : "Zu Admin machen"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">LLM-Kosten-Monitoring</h2>
        <p className="text-sm text-slate-400">
          Gesamt (letzte 100 Aufrufe): <span className="text-emerald-300">${totalCost.toFixed(4)}</span>
        </p>
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-700">
          <table className="w-full text-xs">
            <thead className="bg-slate-800 text-slate-400">
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
                <tr key={u.id} className="border-t border-slate-700">
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
        <h2 className="text-lg font-medium">Break-Glass-Zugriff</h2>
        <p className="text-xs text-slate-500">
          Zugriff auf ein fremdes Objekt nur mit Pflichtbegründung — wird automatisch protokolliert, der Owner kann
          den Log-Eintrag zu seinem Objekt einsehen. Verschlüsselte sensible Felder bleiben auch hier unlesbar (das
          Passwort des Owners kennt niemand außer ihm selbst).
        </p>
        <form onSubmit={handleBreakGlass} className="space-y-2 rounded-lg border border-slate-700 bg-slate-800 p-4">
          <input
            placeholder="Objekt-ID"
            required
            value={breakGlassObjectId}
            onChange={(e) => setBreakGlassObjectId(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          />
          <input
            placeholder="Begründung (Pflicht)"
            required
            value={breakGlassReason}
            onChange={(e) => setBreakGlassReason(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={breakGlassBusy}
            className="rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
          >
            {breakGlassBusy ? "…" : "Zugriff anfordern"}
          </button>
        </form>

        {breakGlassResult && (
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-300">
            {JSON.stringify(breakGlassResult, null, 2)}
          </pre>
        )}

        {accessLog.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm text-slate-300">Zugriffs-Log für dieses Objekt</h3>
            {accessLog.map((entry) => (
              <p key={entry.id} className="text-xs text-slate-400">
                {new Date(entry.created_at).toLocaleString("de-DE")} — {entry.reason}
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
