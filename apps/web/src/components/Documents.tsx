import { useEffect, useState, type FormEvent } from "react";
import {
  attachFile,
  createDocument,
  decryptSensitiveField,
  deleteDocument,
  getFileUrl,
  instantiateTemplate,
  listMyDocuments,
  listMyProjects,
  listShares,
  removeFile,
  revokeShare,
  shareDocument,
  summarizeDocument,
  updateDocument,
  type DocumentObject,
  type ShareEntry,
} from "../lib/objects";
import { getEncryptionKey } from "../lib/encryptionSession";
import { TagInput } from "./TagInput";

interface DocumentsProps {
  userId: string;
  // Generische Ansicht auf dieselbe objects-Tabelle (siehe CLAUDE.md,
  // Datenmodell-Grundsatz) — Projekte/Finanzen/Haus/Schulhelfer sind alle
  // nur diese eine Komponente mit anderen Voreinstellungen, keine eigenen
  // Komponenten/Tabellen. Neues Modul = neuer Eintrag in lib/modules.ts mit
  // passenden Props hier, nicht neuer Code.
  objectType?: string;
  presetTag?: string;
  heading?: string;
  showAmount?: boolean;
  showProjectPicker?: boolean;
  showSum?: boolean;
  emptyLabel?: string;
  // Für die Einbettung im Projekt-Workspace (siehe ProjectWorkspace.tsx):
  // lockedProjectId setzt project_id beim Anlegen fest (Projekt-Auswahl
  // entfällt), folderId filtert zusätzlich nach Unterordner (null = Ebene 1
  // des Projekts). Ohne diese Props unverändertes Verhalten.
  lockedProjectId?: string;
  folderId?: string | null;
  // Zeigt pro Karte einen zusätzlichen "Öffnen"-Button (aktuell nur für die
  // Projekte-Übersicht, die damit in den Projekt-Workspace wechselt).
  onOpen?: (doc: DocumentObject) => void;
}

const fieldLabelClass = "block text-xs font-medium text-neutral-500 mb-1";
const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none";
const actionButtonClass =
  "inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-200";
const dangerButtonClass =
  "inline-flex items-center gap-1 rounded-full border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50";

export function Documents({
  userId,
  objectType = "document",
  presetTag,
  heading = "Meine Dokumente",
  showAmount = false,
  showProjectPicker = false,
  showSum = false,
  emptyLabel = "Noch keine Einträge.",
  lockedProjectId,
  folderId,
  onOpen,
}: DocumentsProps) {
  const [documents, setDocuments] = useState<DocumentObject[]>([]);
  const [projects, setProjects] = useState<DocumentObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sensitiveField, setSensitiveField] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [amountInput, setAmountInput] = useState("");
  const [projectId, setProjectId] = useState("");
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

  const [editOpenFor, setEditOpenFor] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSensitiveField, setEditSensitiveField] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editAmountInput, setEditAmountInput] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [removingFileId, setRemovingFileId] = useState<string | null>(null);
  const [shares, setShares] = useState<Record<string, ShareEntry[]>>({});

  async function refresh() {
    setLoading(true);
    try {
      const [allDocs, allProjects] = await Promise.all([
        listMyDocuments(),
        showProjectPicker ? listMyProjects() : Promise.resolve([]),
      ]);
      const docs = allDocs.filter((d) => {
        if (d.type !== objectType) return false;
        if (lockedProjectId !== undefined && d.project_id !== lockedProjectId) return false;
        if (folderId !== undefined && (d.folder_id ?? null) !== folderId) return false;
        return true;
      });
      setDocuments(docs);
      setProjects(allProjects);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectType, lockedProjectId, folderId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const finalTags = [...tags];
      if (presetTag && !finalTags.includes(presetTag)) finalTags.push(presetTag);

      const doc = await createDocument(
        {
          type: objectType,
          title,
          content,
          sensitiveField,
          isTemplate,
          tags: finalTags,
          projectId: lockedProjectId ?? (projectId || null),
          amount: amountInput ? Number(amountInput) : null,
          folderId: folderId ?? null,
        },
        userId,
      );
      if (file) {
        await attachFile(doc, file, userId);
      }
      setTitle("");
      setContent("");
      setSensitiveField("");
      setIsTemplate(false);
      setTags([]);
      setAmountInput("");
      setProjectId("");
      setFile(null);
      setCreateOpen(false);
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

  async function handleRemoveFile(doc: DocumentObject) {
    if (!doc.storage_path) return;
    if (!window.confirm("Angehängte Datei wirklich entfernen? Das Dokument selbst bleibt erhalten.")) return;
    setRemovingFileId(doc.id);
    setError(null);
    try {
      await removeFile(doc.id, doc.storage_path);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Datei konnte nicht entfernt werden");
    } finally {
      setRemovingFileId(null);
    }
  }

  async function openShare(doc: DocumentObject) {
    if (shareOpenFor === doc.id) {
      setShareOpenFor(null);
      return;
    }
    setShareOpenFor(doc.id);
    setShareInfo(null);
    try {
      setShares((prev) => ({ ...prev, [doc.id]: [] }));
      const list = await listShares(doc.id);
      setShares((prev) => ({ ...prev, [doc.id]: list }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Freigabe-Liste konnte nicht geladen werden");
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
      const list = await listShares(doc.id);
      setShares((prev) => ({ ...prev, [doc.id]: list }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Teilen fehlgeschlagen");
    } finally {
      setSharing(false);
    }
  }

  async function handleRevokeShare(doc: DocumentObject, share: ShareEntry) {
    setError(null);
    try {
      await revokeShare(doc.id, share.userId);
      setShares((prev) => ({ ...prev, [doc.id]: prev[doc.id].filter((s) => s.userId !== share.userId) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Freigabe konnte nicht entfernt werden");
    }
  }

  function openEdit(doc: DocumentObject) {
    setEditOpenFor(doc.id);
    setEditTitle(doc.title);
    setEditContent(doc.content ?? "");
    setEditSensitiveField(decryptedFields[doc.id] ?? "");
    setEditTags(doc.tags.filter((t) => t !== presetTag));
    setEditAmountInput(doc.amount !== null ? String(doc.amount) : "");
    setEditProjectId(doc.project_id ?? "");
    setError(null);
  }

  async function handleEditSave(doc: DocumentObject, e: FormEvent) {
    e.preventDefault();
    setEditSaving(true);
    setError(null);
    try {
      const finalTags = [...editTags];
      if (presetTag && !finalTags.includes(presetTag)) finalTags.push(presetTag);
      await updateDocument(doc.id, {
        title: editTitle,
        content: editContent,
        sensitiveField: editSensitiveField,
        tags: finalTags,
        projectId: editProjectId || null,
        amount: editAmountInput ? Number(editAmountInput) : null,
      });
      setEditOpenFor(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(doc: DocumentObject) {
    if (!window.confirm(`"${doc.title}" wirklich unwiderruflich löschen?`)) return;
    setDeletingId(doc.id);
    setError(null);
    try {
      await deleteDocument(doc.id, doc.storage_path);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    } finally {
      setDeletingId(null);
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

  const allTags = [...new Set(documents.flatMap((doc) => doc.tags))].filter((t) => t !== presetTag).sort();

  const filteredDocuments = documents.filter((doc) => {
    const searchLower = search.trim().toLowerCase();
    const matchesSearch =
      !searchLower ||
      doc.title.toLowerCase().includes(searchLower) ||
      (doc.content ?? "").toLowerCase().includes(searchLower);
    const matchesPresetTag = !presetTag || doc.tags.includes(presetTag);
    const matchesTag = !activeTag || doc.tags.includes(activeTag);
    return matchesSearch && matchesPresetTag && matchesTag;
  });

  const realEntries = filteredDocuments.filter((doc) => !doc.is_template);
  const templateEntries = filteredDocuments.filter((doc) => doc.is_template);

  const sum = filteredDocuments.reduce((total, doc) => total + (doc.amount ?? 0), 0);

  function projectName(id: string | null): string | null {
    if (!id) return null;
    return projects.find((p) => p.id === id)?.title ?? null;
  }

  function renderCard(doc: DocumentObject) {
    return (
      <div
        key={doc.id}
        className={`rounded-2xl border p-4 ${
          doc.is_template ? "border-dashed border-neutral-300 bg-neutral-50" : "border-neutral-200 bg-white shadow-sm"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium leading-snug text-neutral-900">{doc.title}</h3>
          <div className="flex shrink-0 items-center gap-2">
            {showAmount && doc.amount !== null && (
              <span className="text-base font-semibold text-emerald-700">{doc.amount.toFixed(2)} €</span>
            )}
          </div>
        </div>

        {(doc.is_template || doc.owner_id !== userId || (showProjectPicker && projectName(doc.project_id))) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {doc.is_template && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">Vorlage</span>
            )}
            {doc.owner_id !== userId && (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">Mit dir geteilt</span>
            )}
            {showProjectPicker && projectName(doc.project_id) && (
              <span className="text-xs text-neutral-500">🗂️ {projectName(doc.project_id)}</span>
            )}
          </div>
        )}

        {doc.tags.filter((t) => t !== presetTag).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {doc.tags
              .filter((t) => t !== presetTag)
              .map((tag) => (
                <span key={tag} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                  {tag}
                </span>
              ))}
          </div>
        )}

        {(doc.content || doc.encrypted_field) && (
          <div className="mt-3 space-y-1.5 rounded-xl bg-neutral-50 p-2.5">
            {doc.content && <p className="text-sm text-neutral-700">{doc.content}</p>}
            {doc.encrypted_field && (
              <p className="text-sm text-emerald-700">
                🔒{" "}
                {decryptedFields[doc.id] ?? (
                  <span className="text-amber-600">
                    Gesperrt — {getEncryptionKey() ? "falsches Passwort?" : "bitte aus- und wieder einloggen"}
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {onOpen && (
            <button
              onClick={() => onOpen(doc)}
              className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-xs text-white hover:bg-neutral-800"
            >
              📂 Öffnen
            </button>
          )}
          {doc.content && (
            <button
              onClick={() => handleSummarize(doc)}
              disabled={summarizing === doc.id}
              className={`${actionButtonClass} disabled:opacity-50`}
            >
              ✨ {summarizing === doc.id ? "Fasst zusammen…" : "Mit KI zusammenfassen"}
            </button>
          )}
          {doc.is_template && (
            <button onClick={() => handleInstantiate(doc)} className={actionButtonClass}>
              ➕ Als neuen Eintrag starten
            </button>
          )}
          {doc.storage_path && (
            <button onClick={() => handleDownload(doc)} className={actionButtonClass}>
              📎 Datei herunterladen
            </button>
          )}
          {doc.storage_path && doc.owner_id === userId && (
            <button
              onClick={() => handleRemoveFile(doc)}
              disabled={removingFileId === doc.id}
              className={`${dangerButtonClass} disabled:opacity-50`}
            >
              {removingFileId === doc.id ? "Entfernt…" : "🗑️ Datei entfernen"}
            </button>
          )}
          {doc.owner_id === userId && (
            <button onClick={() => openShare(doc)} className={actionButtonClass}>
              🔗 Teilen
            </button>
          )}
          {doc.owner_id === userId && (
            <button
              onClick={() => (editOpenFor === doc.id ? setEditOpenFor(null) : openEdit(doc))}
              className={actionButtonClass}
            >
              ✏️ Bearbeiten
            </button>
          )}
          {doc.owner_id === userId && (
            <button
              onClick={() => handleDelete(doc)}
              disabled={deletingId === doc.id}
              className={`${dangerButtonClass} disabled:opacity-50`}
            >
              {deletingId === doc.id ? "Löscht…" : "🗑️ Löschen"}
            </button>
          )}
        </div>

        {editOpenFor === doc.id && (
          <form onSubmit={(e) => handleEditSave(doc, e)} className="mt-3 space-y-2 border-t border-neutral-200 pt-3">
            <div>
              <label className={fieldLabelClass}>Titel</label>
              <input required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={fieldLabelClass}>Inhalt</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                className={inputClass}
              />
            </div>
            <div>
              <label className={fieldLabelClass}>Sensibles Feld (verschlüsselt)</label>
              <input
                value={editSensitiveField}
                onChange={(e) => setEditSensitiveField(e.target.value)}
                className={inputClass}
              />
            </div>
            {showAmount && (
              <div>
                <label className={fieldLabelClass}>Betrag</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editAmountInput}
                    onChange={(e) => setEditAmountInput(e.target.value)}
                    className={`${inputClass} pr-7`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
                    €
                  </span>
                </div>
              </div>
            )}
            {showProjectPicker && !lockedProjectId && projects.length > 0 && (
              <div>
                <label className={fieldLabelClass}>Projekt</label>
                <select
                  value={editProjectId}
                  onChange={(e) => setEditProjectId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Keinem Projekt zuordnen</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={fieldLabelClass}>Tags</label>
              <TagInput value={editTags} onChange={setEditTags} suggestions={allTags} />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={editSaving}
                className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {editSaving ? "Speichert…" : "Speichern"}
              </button>
              <button type="button" onClick={() => setEditOpenFor(null)} className="text-xs text-neutral-500 underline">
                Abbrechen
              </button>
            </div>
          </form>
        )}

        {summaries[doc.id] && (
          <p className="mt-2 rounded-xl bg-emerald-50 p-2 text-sm text-emerald-700">{summaries[doc.id]}</p>
        )}

        {shareOpenFor === doc.id && (
          <div className="mt-3 border-t border-neutral-200 pt-3">
            <form onSubmit={(e) => handleShare(doc, e)} className="flex gap-2">
              <input
                type="email"
                required
                placeholder="E-Mail des Familienmitglieds"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="flex-1 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs focus:border-neutral-900 focus:outline-none"
              />
              <button
                type="submit"
                disabled={sharing}
                className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {sharing ? "…" : "Freigeben"}
              </button>
            </form>
            {(shares[doc.id]?.length ?? 0) > 0 && (
              <div className="space-y-1 pt-2">
                <p className="text-xs text-neutral-500">Aktuell freigegeben für:</p>
                {shares[doc.id].map((share) => (
                  <div key={share.userId} className="flex items-center justify-between text-xs">
                    <span className="text-neutral-700">{share.email ?? share.userId}</span>
                    <button onClick={() => handleRevokeShare(doc, share)} className="text-red-600 underline">
                      Entfernen
                    </button>
                  </div>
                ))}
              </div>
            )}
            {doc.encrypted_field && (
              <p className="mt-2 text-xs text-amber-600">
                Hinweis: Das sensible Feld ist mit deinem persönlichen Schlüssel verschlüsselt — die freigegebene
                Person sieht dort dauerhaft „Gesperrt", nicht nur nach Reload.
              </p>
            )}
            {shareInfo && <p className="mt-2 text-xs text-emerald-700">{shareInfo}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h2 className="font-display text-3xl">{heading}</h2>

      {!createOpen && (
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-full border border-dashed border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-600 hover:border-neutral-900 hover:text-neutral-900"
        >
          ➕ Neuer Eintrag
        </button>
      )}

      {createOpen && (
      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-2xl border-t-2 border-t-neutral-900 border-x border-b border-neutral-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">Neuer Eintrag</h3>
          <button type="button" onClick={() => setCreateOpen(false)} className="text-xs text-neutral-400 hover:text-neutral-700">
            ✕
          </button>
        </div>

        <div>
          <label className={fieldLabelClass}>Titel</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={fieldLabelClass}>Inhalt</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} className={inputClass} />
        </div>

        <div>
          <label className={fieldLabelClass}>Sensibles Feld (verschlüsselt)</label>
          <input value={sensitiveField} onChange={(e) => setSensitiveField(e.target.value)} className={inputClass} />
          <p className="mt-1 text-xs text-neutral-500">
            🔒 Wird mit einem aus deinem Passwort abgeleiteten Schlüssel verschlüsselt, bevor es gespeichert wird —
            auch der Admin kann es nicht lesen. Passwort vergessen bedeutet: dieser Inhalt ist unwiederbringlich weg.
          </p>
        </div>

        {showAmount && (
          <div>
            <label className={fieldLabelClass}>Betrag</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className={`${inputClass} pr-8`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                €
              </span>
            </div>
          </div>
        )}

        {showProjectPicker && !lockedProjectId && projects.length > 0 && (
          <div>
            <label className={fieldLabelClass}>Projekt</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
              <option value="">Keinem Projekt zuordnen</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={fieldLabelClass}>Tags</label>
          <TagInput value={tags} onChange={setTags} suggestions={allTags} />
        </div>

        <div>
          <label className={fieldLabelClass}>Datei anhängen</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-neutral-500"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={isTemplate}
            onChange={(e) => setIsTemplate(e.target.checked)}
            className="rounded border-neutral-300"
          />
          Als Vorlage speichern
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {saving ? "Speichert…" : "Anlegen"}
        </button>
      </form>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span>⚠️</span>
          <span>{error}</span>
        </p>
      )}

      <div className="space-y-2">
        <input
          placeholder="Suche nach Titel oder Inhalt…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm focus:border-neutral-900 focus:outline-none"
        />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`rounded-full px-2.5 py-0.5 text-xs ${
                  activeTag === tag ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        {showSum && filteredDocuments.length > 0 && (
          <p className="text-sm text-neutral-600">
            Summe: <span className="font-medium text-emerald-700">{sum.toFixed(2)} €</span>
          </p>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="h-4 w-1/3 rounded bg-neutral-200" />
              <div className="mt-3 h-3 w-2/3 rounded bg-neutral-100" />
              <div className="mt-2 h-3 w-1/2 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      )}

      {!loading && documents.length === 0 && <p className="text-sm text-neutral-500">{emptyLabel}</p>}
      {!loading && documents.length > 0 && filteredDocuments.length === 0 && (
        <p className="text-sm text-neutral-500">Keine Einträge passen zu diesem Filter.</p>
      )}

      {!loading && realEntries.length > 0 && (
        <div className="space-y-3">
          {templateEntries.length > 0 && (
            <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Einträge</h3>
          )}
          {realEntries.map(renderCard)}
        </div>
      )}

      {!loading && templateEntries.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Vorlagen</h3>
          {templateEntries.map(renderCard)}
        </div>
      )}
    </div>
  );
}
