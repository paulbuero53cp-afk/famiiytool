import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { unlockEncryption } from "../lib/encryptionSession";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);

    const { data, error: authError } =
      mode === "signIn"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (authError) {
      setBusy(false);
      setError(authError.message);
      return;
    }

    if (mode === "signUp" && !data.session) {
      setBusy(false);
      setInfo("Registrierung erfolgreich — bitte E-Mail bestätigen und dann einloggen.");
      return;
    }

    // Passwort liegt hier im Klartext vor — einziger Moment, an dem wir es
    // haben. Schlüsselableitung siehe lib/crypto.ts / encryptionSession.ts.
    if (data.user) {
      try {
        await unlockEncryption(data.user.id, password);
      } catch (err) {
        setBusy(false);
        setError(
          err instanceof Error
            ? `Verschlüsselung konnte nicht initialisiert werden: ${err.message}`
            : "Verschlüsselung konnte nicht initialisiert werden",
        );
        return;
      }
    }

    setBusy(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-800 p-6 space-y-4"
      >
        <h1 className="text-xl font-medium">Familientool — {mode === "signIn" ? "Login" : "Registrierung"}</h1>

        <div className="space-y-1">
          <label className="block text-sm text-slate-400">E-Mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm text-slate-400">Passwort</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {info && <p className="text-sm text-emerald-400">{info}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-slate-100 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
        >
          {mode === "signIn" ? "Einloggen" : "Registrieren"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
          className="w-full text-center text-sm text-slate-400 underline"
        >
          {mode === "signIn" ? "Noch keinen Account? Registrieren" : "Schon registriert? Einloggen"}
        </button>
      </form>
    </div>
  );
}
