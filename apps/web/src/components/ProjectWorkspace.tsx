import { useEffect, useState, type FormEvent } from "react";
import { createDocument, deleteDocument, listMyDocuments, setMilestoneDone, type DocumentObject } from "../lib/objects";
import { Documents } from "./Documents";

interface ProjectWorkspaceProps {
  userId: string;
  project: DocumentObject;
  onBack: () => void;
}

const smallInputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none";
const smallLabelClass = "block text-xs font-medium text-neutral-500 mb-1";

export function ProjectWorkspace({ userId, project, onBack }: ProjectWorkspaceProps) {
  const [milestones, setMilestones] = useState<DocumentObject[]>([]);
  const [folders, setFolders] = useState<DocumentObject[]>([]);
  const [expenseSum, setExpenseSum] = useState(0);
  const [expenseCount, setExpenseCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openFolder, setOpenFolder] = useState<DocumentObject | null>(null);

  const [milestoneFormOpen, setMilestoneFormOpen] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [milestoneSaving, setMilestoneSaving] = useState(false);

  const [folderFormOpen, setFolderFormOpen] = useState(false);
  const [folderTitle, setFolderTitle] = useState("");
  const [folderSaving, setFolderSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const all = await listMyDocuments();
      const projectItems = all.filter((d) => d.project_id === project.id);

      setMilestones(
        projectItems
          .filter((d) => d.type === "milestone")
          .sort((a, b) => (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99")),
      );
      setFolders(projectItems.filter((d) => d.type === "folder"));

      const expenses = projectItems.filter((d) => d.type === "expense");
      setExpenseCount(expenses.length);
      setExpenseSum(expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0));

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
  }, [project.id]);

  async function handleCreateMilestone(e: FormEvent) {
    e.preventDefault();
    setMilestoneSaving(true);
    setError(null);
    try {
      await createDocument(
        {
          type: "milestone",
          title: milestoneTitle,
          content: "",
          sensitiveField: "",
          isTemplate: false,
          tags: [],
          projectId: project.id,
          amount: null,
          dueDate: milestoneDate || null,
        },
        userId,
      );
      setMilestoneTitle("");
      setMilestoneDate("");
      setMilestoneFormOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Meilenstein konnte nicht angelegt werden");
    } finally {
      setMilestoneSaving(false);
    }
  }

  async function handleToggleDone(milestone: DocumentObject) {
    setError(null);
    try {
      await setMilestoneDone(milestone.id, !milestone.done);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status konnte nicht geändert werden");
    }
  }

  async function handleDeleteMilestone(milestone: DocumentObject) {
    if (!window.confirm(`Meilenstein "${milestone.title}" wirklich löschen?`)) return;
    setError(null);
    try {
      await deleteDocument(milestone.id, null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }

  async function handleCreateFolder(e: FormEvent) {
    e.preventDefault();
    setFolderSaving(true);
    setError(null);
    try {
      await createDocument(
        {
          type: "folder",
          title: folderTitle,
          content: "",
          sensitiveField: "",
          isTemplate: false,
          tags: [],
          projectId: project.id,
          amount: null,
        },
        userId,
      );
      setFolderTitle("");
      setFolderFormOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ordner konnte nicht angelegt werden");
    } finally {
      setFolderSaving(false);
    }
  }

  async function handleDeleteFolder(folder: DocumentObject) {
    if (
      !window.confirm(
        `Ordner "${folder.title}" wirklich löschen? Enthaltene Dokumente bleiben erhalten, verlieren aber die Ordner-Zuordnung.`,
      )
    )
      return;
    setError(null);
    try {
      await deleteDocument(folder.id, null);
      if (openFolder?.id === folder.id) setOpenFolder(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }

  function formatDate(d: string | null): string {
    if (!d) return "";
    return new Date(d).toLocaleDateString("de-DE");
  }

  if (openFolder) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <button onClick={() => setOpenFolder(null)} className="text-sm text-neutral-500 underline">
          ← {project.title}
        </button>
        <Documents
          userId={userId}
          objectType="document"
          heading={`${project.title} / ${openFolder.title}`}
          lockedProjectId={project.id}
          folderId={openFolder.id}
          emptyLabel="Noch keine Dokumente in diesem Ordner."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <button onClick={onBack} className="text-sm text-neutral-500 underline">
          ← Zur Projektübersicht
        </button>
        <h2 className="mt-2 font-display text-3xl">{project.title}</h2>
        {project.content && <p className="mt-1 text-sm text-neutral-600">{project.content}</p>}
      </div>

      {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl">Meilensteine</h3>
          {!milestoneFormOpen && (
            <button
              onClick={() => setMilestoneFormOpen(true)}
              className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-200"
            >
              ➕ Meilenstein
            </button>
          )}
        </div>

        {milestoneFormOpen && (
          <form
            onSubmit={handleCreateMilestone}
            className="flex flex-wrap items-end gap-2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm"
          >
            <div className="min-w-[10rem] flex-1">
              <label className={smallLabelClass}>Titel</label>
              <input
                required
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
                className={smallInputClass}
              />
            </div>
            <div>
              <label className={smallLabelClass}>Zieldatum</label>
              <input
                type="date"
                value={milestoneDate}
                onChange={(e) => setMilestoneDate(e.target.value)}
                className={smallInputClass}
              />
            </div>
            <button
              type="submit"
              disabled={milestoneSaving}
              className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {milestoneSaving ? "…" : "Anlegen"}
            </button>
            <button
              type="button"
              onClick={() => setMilestoneFormOpen(false)}
              className="text-xs text-neutral-500 underline"
            >
              Abbrechen
            </button>
          </form>
        )}

        {!loading && milestones.length === 0 && (
          <p className="text-sm text-neutral-500">Noch keine Meilensteine.</p>
        )}
        {milestones.length > 0 && (
          <div className="space-y-2">
            {milestones.map((m) => (
              <div
                key={m.id}
                className={`flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2 ${
                  m.done ? "opacity-50" : ""
                }`}
              >
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={m.done}
                    onChange={() => handleToggleDone(m)}
                    className="rounded border-neutral-300"
                  />
                  <span className={m.done ? "line-through" : ""}>{m.title}</span>
                  {m.due_date && <span className="text-xs text-neutral-500">({formatDate(m.due_date)})</span>}
                </label>
                <button onClick={() => handleDeleteMilestone(m)} className="text-xs text-red-600 underline">
                  Löschen
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {expenseCount > 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="font-display text-xl">Ausgaben</h3>
          <p className="mt-1 text-sm text-neutral-600">
            {expenseCount} {expenseCount === 1 ? "Eintrag" : "Einträge"}, Summe:{" "}
            <span className="font-medium text-emerald-700">{expenseSum.toFixed(2)} €</span>
          </p>
          <p className="mt-1 text-xs text-neutral-500">Details und Verwaltung im Finanzen-Modul.</p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl">Ordner</h3>
          {!folderFormOpen && (
            <button
              onClick={() => setFolderFormOpen(true)}
              className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-200"
            >
              ➕ Ordner
            </button>
          )}
        </div>

        {folderFormOpen && (
          <form
            onSubmit={handleCreateFolder}
            className="flex flex-wrap items-end gap-2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm"
          >
            <div className="min-w-[10rem] flex-1">
              <label className={smallLabelClass}>Ordnername</label>
              <input
                required
                value={folderTitle}
                onChange={(e) => setFolderTitle(e.target.value)}
                className={smallInputClass}
              />
            </div>
            <button
              type="submit"
              disabled={folderSaving}
              className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {folderSaving ? "…" : "Anlegen"}
            </button>
            <button type="button" onClick={() => setFolderFormOpen(false)} className="text-xs text-neutral-500 underline">
              Abbrechen
            </button>
          </form>
        )}

        {!loading && folders.length === 0 && <p className="text-sm text-neutral-500">Noch keine Unterordner.</p>}
        {folders.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {folders.map((f) => (
              <div
                key={f.id}
                className="group relative rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm hover:shadow-md"
              >
                <button onClick={() => setOpenFolder(f)} className="flex w-full flex-col items-center gap-1">
                  <span className="text-2xl">📁</span>
                  <span className="text-sm">{f.title}</span>
                </button>
                <button
                  onClick={() => handleDeleteFolder(f)}
                  className="absolute right-2 top-2 hidden text-xs text-red-600 group-hover:block"
                  title="Ordner löschen"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Documents
        userId={userId}
        objectType="document"
        heading="Dokumente"
        lockedProjectId={project.id}
        folderId={null}
        emptyLabel="Noch keine Dokumente auf dieser Ebene."
      />
    </div>
  );
}
