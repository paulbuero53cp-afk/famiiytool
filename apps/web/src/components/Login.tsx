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
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-900">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4"
      >
        <h1 className="font-display text-2xl">Familientool — {mode === "signIn" ? "Login" : "Registrierung"}</h1>

        <div className="space-y-1">
          <label className="block text-sm text-neutral-500">E-Mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm text-neutral-500">Passwort</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
        </div>

        {error && (
          <p className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700">{error}</p>
        )}
        {info && (
          <p className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-neutral-900 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {mode === "signIn" ? "Einloggen" : "Registrieren"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
          className="w-full text-center text-sm text-neutral-500 underline"
        >
          {mode === "signIn" ? "Noch keinen Account? Registrieren" : "Schon registriert? Einloggen"}
        </button>
      </form>
    </div>
  );
}
