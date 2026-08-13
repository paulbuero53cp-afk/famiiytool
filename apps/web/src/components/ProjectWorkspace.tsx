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
  // Alle Ordner des Projekts (nicht nur die aktuelle Ebene) — echte
  // Baumstruktur, folder_id referenziert generisch objects(id), Ordner
  // können selbst wieder folder_id auf einen anderen Ordner setzen. Wird
  // client-seitig nach aktueller Ebene gefiltert (gleiches Muster wie
  // Documents.tsx: alles laden, im State filtern).
  const [allFolders, setAllFolders] = useState<DocumentObject[]>([]);
  const [expenseSum, setExpenseSum] = useState(0);
  const [expenseCount, setExpenseCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Breadcrumb-Stack: leer = Projekt-Root, sonst jeweils der aktuelle Pfad.
  const [folderPath, setFolderPath] = useState<DocumentObject[]>([]);
  const currentFolder = folderPath[folderPath.length - 1] ?? null;
  const currentFolderId = currentFolder?.id ?? null;
  const foldersHere = allFolders.filter((f) => (f.folder_id ?? null) === currentFolderId);

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
      setAllFolders(projectItems.filter((d) => d.type === "folder"));

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
          folderId: currentFolderId,
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
        `Ordner "${folder.title}" wirklich löschen? Enthaltene Dokumente/Unterordner bleiben erhalten, verlieren aber die Ordner-Zuordnung.`,
      )
    )
      return;
    setError(null);
    try {
      await deleteDocument(folder.id, null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }

  function formatDate(d: string | null): string {
    if (!d) return "";
    return new Date(d).toLocaleDateString("de-DE");
  }

  if (currentFolder) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <nav className="flex flex-wrap items-center gap-1 text-sm text-neutral-500">
          <button onClick={() => setFolderPath([])} className="hover:text-neutral-900 hover:underline">
            {project.title}
          </button>
          {folderPath.map((f, i) => (
            <span key={f.id} className="flex items-center gap-1">
              <span className="text-neutral-300">/</span>
              <button
                onClick={() => setFolderPath(folderPath.slice(0, i + 1))}
                className={i === folderPath.length - 1 ? "text-neutral-900" : "hover:text-neutral-900 hover:underline"}
              >
                {f.title}
              </button>
            </span>
          ))}
        </nav>

        {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {foldersHere.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {foldersHere.map((f) => (
              <div
                key={f.id}
                className="group relative rounded-xl border border-neutral-200 bg-white p-3.5 text-center hover:shadow-sm"
              >
                <button
                  onClick={() => setFolderPath([...folderPath, f])}
                  className="flex w-full flex-col items-center gap-1"
                >
                  <span className="text-xl">📁</span>
                  <span className="text-sm">{f.title}</span>
                </button>
                <button
                  onClick={() => handleDeleteFolder(f)}
                  className="absolute right-1.5 top-1.5 hidden text-xs text-red-600 group-hover:block"
                  title="Ordner löschen"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">Unterordner</span>
          {!folderFormOpen && (
            <button
              onClick={() => setFolderFormOpen(true)}
              className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-200"
            >
              ➕ Ordner
            </button>
          )}
        </div>

        {folderFormOpen && (
          <form
            onSubmit={handleCreateFolder}
            className="flex flex-wrap items-end gap-2 rounded-xl border border-neutral-200 bg-white p-2.5"
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
              className="rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {folderSaving ? "…" : "Anlegen"}
            </button>
            <button type="button" onClick={() => setFolderFormOpen(false)} className="text-xs text-neutral-500 underline">
              Abbrechen
            </button>
          </form>
        )}

        <Documents
          userId={userId}
          objectType="document"
          heading={`Dokumente in „${currentFolder.title}"`}
          lockedProjectId={project.id}
          folderId={currentFolder.id}
          emptyLabel="Noch keine Dokumente in diesem Ordner."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <button onClick={onBack} className="text-sm text-neutral-500 underline">
          ← Zur Projektübersicht
        </button>
        <h2 className="mt-2 font-display text-2xl">{project.title}</h2>
        {project.content && <p className="mt-1 text-sm text-neutral-600">{project.content}</p>}
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg">Meilensteine</h3>
          {!milestoneFormOpen && (
            <button
              onClick={() => setMilestoneFormOpen(true)}
              className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-200"
            >
              ➕ Meilenstein
            </button>
          )}
        </div>

        {milestoneFormOpen && (
          <form
            onSubmit={handleCreateMilestone}
            className="flex flex-wrap items-end gap-2 rounded-xl border border-neutral-200 bg-white p-2.5"
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
              className="rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
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
          <div className="space-y-1.5">
            {milestones.map((m) => (
              <div
                key={m.id}
                className={`flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-1.5 ${
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
        <section className="rounded-xl border border-neutral-200 bg-white p-3.5">
          <h3 className="font-display text-lg">Ausgaben</h3>
          <p className="mt-1 text-sm text-neutral-600">
            {expenseCount} {expenseCount === 1 ? "Eintrag" : "Einträge"}, Summe:{" "}
            <span className="font-medium text-emerald-700">{expenseSum.toFixed(2)} €</span>
          </p>
          <p className="mt-1 text-xs text-neutral-500">Details und Verwaltung im Finanzen-Modul.</p>
        </section>
      )}

      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg">Ordner</h3>
          {!folderFormOpen && (
            <button
              onClick={() => setFolderFormOpen(true)}
              className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-200"
            >
              ➕ Ordner
            </button>
          )}
        </div>

        {folderFormOpen && (
          <form
            onSubmit={handleCreateFolder}
            className="flex flex-wrap items-end gap-2 rounded-xl border border-neutral-200 bg-white p-2.5"
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
              className="rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {folderSaving ? "…" : "Anlegen"}
            </button>
            <button type="button" onClick={() => setFolderFormOpen(false)} className="text-xs text-neutral-500 underline">
              Abbrechen
            </button>
          </form>
        )}

        {!loading && foldersHere.length === 0 && <p className="text-sm text-neutral-500">Noch keine Unterordner.</p>}
        {foldersHere.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {foldersHere.map((f) => (
              <div
                key={f.id}
                className="group relative rounded-xl border border-neutral-200 bg-white p-3.5 text-center hover:shadow-sm"
              >
                <button onClick={() => setFolderPath([f])} className="flex w-full flex-col items-center gap-1">
                  <span className="text-xl">📁</span>
                  <span className="text-sm">{f.title}</span>
                </button>
                <button
                  onClick={() => handleDeleteFolder(f)}
                  className="absolute right-1.5 top-1.5 hidden text-xs text-red-600 group-hover:block"
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
