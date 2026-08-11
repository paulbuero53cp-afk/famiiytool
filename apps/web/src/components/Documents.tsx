import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  attachFile,
  createDocument,
  decryptSensitiveField,
  getFileUrl,
  instantiateTemplate,
  listMyDocuments,
  shareDocument,
  summarizeDocument,
  type DocumentObject,
} from "../lib/objects";
import { clearEncryptionKey, getEncryptionKey } from "../lib/encryptionSession";
import { isCurrentUserAdmin } from "../lib/admin";
import { Admin } from "./Admin";

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
  const [tagsInput, setTagsInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [decryptedFields, setDecryptedFields] = useState<Record<string, string>>({});
  const [shareOpenFor, setShareOpenFor] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareInfo, setShareInfo] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    isCurrentUserAdmin(userId).then(setIsAdmin).catch(() => setIsAdmin(false));
  }, [userId]);

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
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const doc = await createDocument({ title, content, sensitiveField, isTemplate, tags }, userId);
      if (file) {
        await attachFile(doc, file, userId);
      }
      setTitle("");
      setContent("");
      setSensitiveField("");
      setIsTemplate(false);
      setTagsInput("");
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

  async function handleShare(doc: DocumentObject, e: FormEvent) {
    e.preventDefault();
    setSharing(true);
    setError(null);
    setShareInfo(null);
    try {
      await shareDocument(doc.id, shareEmail);
      setShareInfo(`Freigegeben für ${shareEmail}.`);
      setShareEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Teilen fehlgeschlagen");
    } finally {
      setSharing(false);
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

  const allTags = [...new Set(documents.flatMap((doc) => doc.tags))].sort();

  const filteredDocuments = documents.filter((doc) => {
    const searchLower = search.trim().toLowerCase();
    const matchesSearch =
      !searchLower ||
      doc.title.toLowerCase().includes(searchLower) ||
      (doc.content ?? "").toLowerCase().includes(searchLower);
    const matchesTag = !activeTag || doc.tags.includes(activeTag);
    return matchesSearch && matchesTag;
  });

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
            placeholder="Tags, kommagetrennt (z. B. urlaub, wichtig)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          />

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

        <div className="space-y-2">
          <input
            placeholder="Suche nach Titel oder Inhalt…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          />
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={`rounded px-2 py-0.5 text-xs ${
                    activeTag === tag ? "bg-slate-100 text-slate-900" : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {loading && <p className="text-sm text-slate-400">Lädt…</p>}
          {!loading && documents.length === 0 && (
            <p className="text-sm text-slate-400">Noch keine Dokumente.</p>
          )}
          {!loading && documents.length > 0 && filteredDocuments.length === 0 && (
            <p className="text-sm text-slate-400">Keine Dokumente passen zu diesem Filter.</p>
          )}

          {filteredDocuments.map((doc) => (
            <div key={doc.id} className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{doc.title}</h3>
                <div className="flex gap-1">
                  {doc.is_template && (
                    <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">Vorlage</span>
                  )}
                  {doc.owner_id !== userId && (
                    <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">Mit dir geteilt</span>
                  )}
                </div>
              </div>

              {doc.content && <p className="text-sm text-slate-400">{doc.content}</p>}

              {doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {doc.tags.map((tag) => (
                    <span key={tag} className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

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
                {doc.owner_id === userId && (
                  <button
                    onClick={() => {
                      setShareOpenFor(shareOpenFor === doc.id ? null : doc.id);
                      setShareInfo(null);
                    }}
                    className="text-xs text-slate-300 underline"
                  >
                    Teilen
                  </button>
                )}
              </div>

              {summaries[doc.id] && (
                <p className="rounded bg-slate-900 p-2 text-sm text-emerald-300">{summaries[doc.id]}</p>
              )}

              {shareOpenFor === doc.id && (
                <form onSubmit={(e) => handleShare(doc, e)} className="flex gap-2 pt-1">
                  <input
                    type="email"
                    required
                    placeholder="E-Mail des Familienmitglieds"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    className="flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={sharing}
                    className="rounded bg-slate-100 px-3 py-1 text-xs font-medium text-slate-900 disabled:opacity-50"
                  >
                    {sharing ? "…" : "Freigeben"}
                  </button>
                </form>
              )}
              {shareOpenFor === doc.id && doc.encrypted_field && (
                <p className="text-xs text-amber-400">
                  Hinweis: Das sensible Feld ist mit deinem persönlichen Schlüssel verschlüsselt — die freigegebene
                  Person sieht dort dauerhaft „Gesperrt", nicht nur nach Reload.
                </p>
              )}
              {shareOpenFor === doc.id && shareInfo && (
                <p className="text-xs text-emerald-400">{shareInfo}</p>
              )}
            </div>
          ))}
        </div>

        {isAdmin && (
          <div className="border-t border-slate-700 pt-8">
            <Admin />
          </div>
        )}
      </div>
    </div>
  );
}
