import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  attachFile,
  createDocument,
  decryptSensitiveField,
  getFileUrl,
  instantiateTemplate,
  listMyDocuments,
  summarizeDocument,
  type DocumentObject,
} from "../lib/objects";
import { clearEncryptionKey, getEncryptionKey } from "../lib/encryptionSession";

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
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [decryptedFields, setDecryptedFields] = useState<Record<string, string>>({});

  async function refresh() {
    setLoading(true);
    try {
      const docs = await listMyDocuments();
      setDocuments(docs);

      const decrypted: Record<string, string> = {};
      for (const doc of docs) {
        if (!doc.encrypted_field) continue;
        try {
          const plain = await decryptSensitiveField(doc.encrypted_field);
          if (plain !== null) decrypted[doc.id] = plain;
        } catch {
          // falscher/fehlender Schlüssel — Feld bleibt in decryptedFields
          // ausgespart, UI zeigt dann den Gesperrt-Hinweis
        }
      }
      setDecryptedFields(decrypted);

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
      const doc = await createDocument({ title, content, sensitiveField, isTemplate }, userId);
      if (file) {
        await attachFile(doc, file, userId);
      }
      setTitle("");
      setContent("");
      setSensitiveField("");
      setIsTemplate(false);
      setFile(null);
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

  async function handleDownload(doc: DocumentObject) {
    if (!doc.storage_path) return;
    setError(null);
    try {
      const url = await getFileUrl(doc.storage_path);
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Datei konnte nicht geladen werden");
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
            onClick={() => {
              clearEncryptionKey();
              supabase.auth.signOut();
            }}
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
              placeholder="Sensibles Feld (verschlüsselt)"
              value={sensitiveField}
              onChange={(e) => setSensitiveField(e.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              🔒 Wird mit einem aus deinem Passwort abgeleiteten Schlüssel verschlüsselt, bevor es gespeichert wird
              — auch der Admin kann es nicht lesen. Passwort vergessen bedeutet: dieser Inhalt ist unwiederbringlich weg.
            </p>
          </div>

          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-slate-400"
          />

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

              {doc.encrypted_field && (
                <p className="text-sm text-emerald-300">
                  🔒{" "}
                  {decryptedFields[doc.id] ?? (
                    <span className="text-amber-400">
                      Gesperrt — {getEncryptionKey() ? "falsches Passwort?" : "bitte aus- und wieder einloggen"}
                    </span>
                  )}
                </p>
              )}

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
                {doc.storage_path && (
                  <button
                    onClick={() => handleDownload(doc)}
                    className="text-xs text-slate-300 underline"
                  >
                    Datei herunterladen
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
