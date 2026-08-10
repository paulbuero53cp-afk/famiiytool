import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  createDocument,
  instantiateTemplate,
  listMyDocuments,
  summarizeDocument,
  type DocumentObject,
} from "../lib/objects";

interface DocumentsProps {
  userId: string;
}

export function Documents({ userId }: DocumentsProps) {
  const [documents, setDocuments] = useState<DocumentObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sensitiveField, setSensitiveField] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizing, setSummarizing] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setDocuments(await listMyDocuments());
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

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createDocument({ title, content, sensitiveField, isTemplate }, userId);
      setTitle("");
      setContent("");
      setSensitiveField("");
      setIsTemplate(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  async function handleSummarize(doc: DocumentObject) {
    if (!doc.content) return;
    setSummarizing(doc.id);
    setError(null);
    try {
      const summary = await summarizeDocument(doc.id, doc.content);
      setSummaries((prev) => ({ ...prev, [doc.id]: summary }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Zusammenfassung fehlgeschlagen");
    } finally {
      setSummarizing(null);
    }
  }

  async function handleInstantiate(doc: DocumentObject) {
    setError(null);
    try {
      await instantiateTemplate(doc, userId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vorlage konnte nicht instanziiert werden");
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium">Meine Dokumente</h1>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-slate-400 underline"
          >
            Ausloggen
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-slate-700 bg-slate-800 p-5">
          <h2 className="text-sm font-medium text-slate-300">Neues Dokument</h2>

          <input
            placeholder="Titel"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          />

          <textarea
            placeholder="Inhalt"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          />

          <div>
            <input
              placeholder="Sensibles Feld (aktuell noch Klartext — siehe TODO in src/lib/objects.ts)"
              value={sensitiveField}
              onChange={(e) => setSensitiveField(e.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-amber-400">
              Verschlüsselung noch nicht implementiert — Schlüsselverwaltung ist offen (siehe familientool-kickoff.md).
              Hier noch keine echten sensiblen Daten eintragen.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={isTemplate}
              onChange={(e) => setIsTemplate(e.target.checked)}
              className="rounded border-slate-600 bg-slate-900"
            />
            Als Vorlage speichern
          </label>

          <button
            type="submit"
            disabled={saving}
            className="rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
          >
            {saving ? "Speichert…" : "Anlegen"}
          </button>
        </form>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="space-y-3">
          {loading && <p className="text-sm text-slate-400">Lädt…</p>}
          {!loading && documents.length === 0 && (
            <p className="text-sm text-slate-400">Noch keine Dokumente.</p>
          )}

          {documents.map((doc) => (
            <div key={doc.id} className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{doc.title}</h3>
                {doc.is_template && (
                  <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">Vorlage</span>
                )}
              </div>

              {doc.content && <p className="text-sm text-slate-400">{doc.content}</p>}

              <div className="flex gap-3 pt-1">
                {doc.content && (
                  <button
                    onClick={() => handleSummarize(doc)}
                    disabled={summarizing === doc.id}
                    className="text-xs text-slate-300 underline disabled:opacity-50"
                  >
                    {summarizing === doc.id ? "Fasst zusammen…" : "Mit KI zusammenfassen"}
                  </button>
                )}
                {doc.is_template && (
                  <button
                    onClick={() => handleInstantiate(doc)}
                    className="text-xs text-slate-300 underline"
                  >
                    Als neues Dokument aus dieser Vorlage starten
                  </button>
                )}
              </div>

              {summaries[doc.id] && (
                <p className="rounded bg-slate-900 p-2 text-sm text-emerald-300">{summaries[doc.id]}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
