import { useEffect, useState, type FormEvent } from "react";
import {
  createDocument,
  deleteDocument,
  listMyDocuments,
  setMilestoneDone,
  updateProjectOverview,
  type DocumentObject,
} from "../lib/objects";
import { Documents } from "./Documents";

interface ProjectWorkspaceProps {
  userId: string;
  project: DocumentObject;
  onBack: () => void;
}

const smallInputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none";
const smallLabelClass = "block text-xs font-medium text-neutral-500 mb-1";
const secondaryButtonClass =
  "rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-50";
const primaryButtonClass =
  "rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50";

type Tab = "overview" | "milestones" | "documents" | "costs";

export const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "geplant", label: "Geplant" },
  { value: "laeuft", label: "Läuft" },
  { value: "pausiert", label: "Pausiert" },
  { value: "abgeschlossen", label: "Abgeschlossen" },
];

function statusLabel(status: string | null): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? "Kein Status";
}

function statusBadgeClass(status: string | null): string {
  switch (status) {
    case "laeuft":
      return "border-blue-300 text-blue-700";
    case "pausiert":
      return "border-amber-300 text-amber-700";
    case "abgeschlossen":
      return "border-emerald-300 text-emerald-700";
    default:
      return "border-neutral-300 text-neutral-600";
  }
}

function formatDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("de-DE");
}

export function ProjectWorkspace({ userId, project: initialProject, onBack }: ProjectWorkspaceProps) {
  const [project, setProject] = useState(initialProject);
  const [tab, setTab] = useState<Tab>("overview");

  const [milestones, setMilestones] = useState<DocumentObject[]>([]);
  const [tasks, setTasks] = useState<DocumentObject[]>([]);
  const [projectDocuments, setProjectDocuments] = useState<DocumentObject[]>([]);
  // Alle Ordner des Projekts (nicht nur die aktuelle Ebene) — echte
  // Baumstruktur, folder_id referenziert generisch objects(id), Ordner
  // können selbst wieder folder_id auf einen anderen Ordner setzen. Wird
  // client-seitig nach aktueller Ebene gefiltert (gleiches Muster wie
  // Documents.tsx: alles laden, im State filtern).
  const [allFolders, setAllFolders] = useState<DocumentObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Breadcrumb-Stack innerhalb des Dokumente-Tabs: leer = Projekt-Root.
  const [folderPath, setFolderPath] = useState<DocumentObject[]>([]);
  const currentFolder = folderPath[folderPath.length - 1] ?? null;
  const currentFolderId = currentFolder?.id ?? null;
  const foldersHere = allFolders.filter((f) => (f.folder_id ?? null) === currentFolderId);

  const [milestoneFormOpen, setMilestoneFormOpen] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [milestoneSaving, setMilestoneSaving] = useState(false);
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(null);

  const [taskFormFor, setTaskFormFor] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskLinkedDoc, setTaskLinkedDoc] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);

  const [folderFormOpen, setFolderFormOpen] = useState(false);
  const [folderTitle, setFolderTitle] = useState("");
  const [folderSaving, setFolderSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editSaving, setEditSaving] = useState(false);

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
      setTasks(projectItems.filter((d) => d.type === "task"));
      setProjectDocuments(projectItems.filter((d) => d.type === "document"));
      setAllFolders(projectItems.filter((d) => d.type === "folder"));

      // Projekt-Objekt selbst frisch halten (Status/Ziele könnten sich seit
      // dem Öffnen geändert haben, z. B. durch die andere Person).
      const freshProject = all.find((d) => d.id === project.id);
      if (freshProject) setProject(freshProject);

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

  function openEdit() {
    setEditTitle(project.title);
    setEditContent(project.content ?? "");
    setEditStatus(project.status ?? "");
    setEditStartDate(project.start_date ?? "");
    setEditEndDate(project.due_date ?? "");
    setEditOpen(true);
    setError(null);
  }

  async function handleSaveOverview(e: FormEvent) {
    e.preventDefault();
    setEditSaving(true);
    setError(null);
    try {
      await updateProjectOverview(project.id, {
        title: editTitle,
        content: editContent,
        status: editStatus || null,
        startDate: editStartDate || null,
        dueDate: editEndDate || null,
      });
      setEditOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setEditSaving(false);
    }
  }

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

  async function handleToggleDone(item: DocumentObject) {
    setError(null);
    try {
      await setMilestoneDone(item.id, !item.done);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status konnte nicht geändert werden");
    }
  }

  async function handleDeleteMilestone(milestone: DocumentObject) {
    if (
      !window.confirm(`Meilenstein "${milestone.title}" wirklich löschen? Enthaltene Aufgaben werden mitgelöscht.`)
    )
      return;
    setError(null);
    try {
      await deleteDocument(milestone.id, null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }

  function openTaskForm(milestoneId: string) {
    setTaskFormFor(taskFormFor === milestoneId ? null : milestoneId);
    setTaskTitle("");
    setTaskDueDate("");
    setTaskLinkedDoc("");
  }

  async function handleCreateTask(milestoneId: string, e: FormEvent) {
    e.preventDefault();
    setTaskSaving(true);
    setError(null);
    try {
      await createDocument(
        {
          type: "task",
          title: taskTitle,
          content: "",
          sensitiveField: "",
          isTemplate: false,
          tags: [],
          projectId: project.id,
          amount: null,
          parentId: milestoneId,
          dueDate: taskDueDate || null,
          linkedDocumentId: taskLinkedDoc || null,
        },
        userId,
      );
      setTaskFormFor(null);
      setTaskTitle("");
      setTaskDueDate("");
      setTaskLinkedDoc("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aufgabe konnte nicht angelegt werden");
    } finally {
      setTaskSaving(false);
    }
  }

  async function handleDeleteTask(task: DocumentObject) {
    if (!window.confirm(`Aufgabe "${task.title}" wirklich löschen?`)) return;
    setError(null);
    try {
      await deleteDocument(task.id, null);
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

  function linkedDocTitle(id: string | null): string | null {
    if (!id) return null;
    return projectDocuments.find((d) => d.id === id)?.title ?? null;
  }

  const firstMilestone = milestones[0] ?? null;
  const lastMilestone = milestones.length > 0 ? milestones[milestones.length - 1] : null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Übersicht" },
    { id: "milestones", label: "Meilensteine & Aufgaben" },
    { id: "documents", label: "Dokumente" },
    { id: "costs", label: "Kosten" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <button onClick={onBack} className="text-sm text-neutral-500 underline">
          ← Zur Projektübersicht
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">{project.title}</h2>
          <span className={`rounded border px-2 py-0.5 text-xs ${statusBadgeClass(project.status)}`}>
            {statusLabel(project.status)}
          </span>
        </div>
        {(project.start_date || project.due_date) && (
          <p className="mt-1 text-xs text-neutral-500">
            {project.start_date ? formatDate(project.start_date) : "?"} – {project.due_date ? formatDate(project.due_date) : "offen"}
          </p>
        )}
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-1 border-b border-neutral-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === t.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section className="space-y-3">
          {!editOpen ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Ziele / Beschreibung</h3>
                <button onClick={openEdit} className={secondaryButtonClass}>
                  ✏️ Bearbeiten
                </button>
              </div>
              {project.content ? (
                <p className="rounded-lg border border-neutral-200 bg-white p-3.5 text-sm text-neutral-700">
                  {project.content}
                </p>
              ) : (
                <p className="text-sm text-neutral-500">Noch keine Ziele/Beschreibung hinterlegt.</p>
              )}
            </div>
          ) : (
            <form
              onSubmit={handleSaveOverview}
              className="space-y-2.5 rounded-lg border-t-2 border-t-neutral-900 border-x border-b border-neutral-200 bg-white p-3.5 shadow-sm"
            >
              <div>
                <label className={smallLabelClass}>Titel</label>
                <input required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={smallInputClass} />
              </div>
              <div>
                <label className={smallLabelClass}>Ziele / Beschreibung</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={4}
                  className={smallInputClass}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={smallLabelClass}>Status</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className={smallInputClass}>
                    <option value="">Kein Status</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={smallLabelClass}>Start</label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className={smallInputClass}
                  />
                </div>
                <div>
                  <label className={smallLabelClass}>Ende</label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className={smallInputClass}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={editSaving} className={primaryButtonClass}>
                  {editSaving ? "Speichert…" : "Speichern"}
                </button>
                <button type="button" onClick={() => setEditOpen(false)} className="text-xs text-neutral-500 underline">
                  Abbrechen
                </button>
              </div>
            </form>
          )}

          {(firstMilestone || lastMilestone) && (
            <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
              <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Meilensteine (Kurzblick)</h3>
              <p className="mt-1 text-sm text-neutral-700">
                Erster: {firstMilestone?.title} {firstMilestone?.due_date && `(${formatDate(firstMilestone.due_date)})`}
              </p>
              {lastMilestone && lastMilestone !== firstMilestone && (
                <p className="text-sm text-neutral-700">
                  Letzter: {lastMilestone.title} {lastMilestone.due_date && `(${formatDate(lastMilestone.due_date)})`}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {tab === "milestones" && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Meilensteine</h3>
            {!milestoneFormOpen && (
              <button onClick={() => setMilestoneFormOpen(true)} className={secondaryButtonClass}>
                ➕ Meilenstein
              </button>
            )}
          </div>

          {milestoneFormOpen && (
            <form
              onSubmit={handleCreateMilestone}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 bg-white p-2.5"
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
              <button type="submit" disabled={milestoneSaving} className={primaryButtonClass}>
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

          {!loading && milestones.length === 0 && <p className="text-sm text-neutral-500">Noch keine Meilensteine.</p>}

          {milestones.length > 0 && (
            <div className="space-y-1.5">
              {milestones.map((m) => {
                const milestoneTasks = tasks.filter((t) => t.parent_id === m.id);
                const isExpanded = expandedMilestoneId === m.id;
                return (
                  <div key={m.id} className="rounded-lg border border-neutral-200 bg-white">
                    <div className={`flex items-center justify-between px-3 py-1.5 ${m.done ? "opacity-50" : ""}`}>
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
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setExpandedMilestoneId(isExpanded ? null : m.id)}
                          className="text-xs text-neutral-500 underline"
                        >
                          {milestoneTasks.length} {milestoneTasks.length === 1 ? "Aufgabe" : "Aufgaben"}{" "}
                          {isExpanded ? "▲" : "▼"}
                        </button>
                        <button onClick={() => handleDeleteMilestone(m)} className="text-xs text-red-700 underline">
                          Löschen
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="space-y-1.5 border-t border-neutral-200 p-2.5">
                        {milestoneTasks.map((t) => (
                          <div
                            key={t.id}
                            className={`flex items-center justify-between rounded border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 ${
                              t.done ? "opacity-50" : ""
                            }`}
                          >
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={t.done}
                                onChange={() => handleToggleDone(t)}
                                className="rounded border-neutral-300"
                              />
                              <span className={t.done ? "line-through" : ""}>{t.title}</span>
                              {t.due_date && <span className="text-xs text-neutral-500">({formatDate(t.due_date)})</span>}
                              {linkedDocTitle(t.linked_document_id) && (
                                <span className="rounded border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-600">
                                  📄 {linkedDocTitle(t.linked_document_id)}
                                </span>
                              )}
                            </label>
                            <button onClick={() => handleDeleteTask(t)} className="text-xs text-red-700 underline">
                              Löschen
                            </button>
                          </div>
                        ))}

                        {taskFormFor === m.id ? (
                          <form
                            onSubmit={(e) => handleCreateTask(m.id, e)}
                            className="flex flex-wrap items-end gap-2 rounded border border-neutral-200 bg-white p-2"
                          >
                            <div className="min-w-[8rem] flex-1">
                              <label className={smallLabelClass}>Titel</label>
                              <input
                                required
                                value={taskTitle}
                                onChange={(e) => setTaskTitle(e.target.value)}
                                className={smallInputClass}
                              />
                            </div>
                            <div>
                              <label className={smallLabelClass}>Zieldatum</label>
                              <input
                                type="date"
                                value={taskDueDate}
                                onChange={(e) => setTaskDueDate(e.target.value)}
                                className={smallInputClass}
                              />
                            </div>
                            {projectDocuments.length > 0 && (
                              <div className="min-w-[9rem]">
                                <label className={smallLabelClass}>Dokument</label>
                                <select
                                  value={taskLinkedDoc}
                                  onChange={(e) => setTaskLinkedDoc(e.target.value)}
                                  className={smallInputClass}
                                >
                                  <option value="">Kein Dokument</option>
                                  {projectDocuments.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <button type="submit" disabled={taskSaving} className={primaryButtonClass}>
                              {taskSaving ? "…" : "Anlegen"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setTaskFormFor(null)}
                              className="text-xs text-neutral-500 underline"
                            >
                              Abbrechen
                            </button>
                          </form>
                        ) : (
                          <button onClick={() => openTaskForm(m.id)} className={secondaryButtonClass}>
                            ➕ Aufgabe
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "documents" &&
        (currentFolder ? (
          <section className="space-y-3">
            <nav className="flex flex-wrap items-center gap-1 text-sm text-neutral-500">
              <button onClick={() => setFolderPath([])} className="hover:text-neutral-900 hover:underline">
                {project.title}
              </button>
              {folderPath.map((f, i) => (
                <span key={f.id} className="flex items-center gap-1">
                  <span className="text-neutral-300">/</span>
                  <button
                    onClick={() => setFolderPath(folderPath.slice(0, i + 1))}
                    className={
                      i === folderPath.length - 1 ? "text-neutral-900" : "hover:text-neutral-900 hover:underline"
                    }
                  >
                    {f.title}
                  </button>
                </span>
              ))}
            </nav>

            {foldersHere.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {foldersHere.map((f) => (
                  <div
                    key={f.id}
                    className="group relative rounded-lg border border-neutral-200 bg-white p-3.5 text-center hover:shadow-sm"
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
                      className="absolute right-1.5 top-1.5 hidden text-xs text-red-700 group-hover:block"
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
                <button onClick={() => setFolderFormOpen(true)} className={secondaryButtonClass}>
                  ➕ Ordner
                </button>
              )}
            </div>

            {folderFormOpen && (
              <form
                onSubmit={handleCreateFolder}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 bg-white p-2.5"
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
                <button type="submit" disabled={folderSaving} className={primaryButtonClass}>
                  {folderSaving ? "…" : "Anlegen"}
                </button>
                <button
                  type="button"
                  onClick={() => setFolderFormOpen(false)}
                  className="text-xs text-neutral-500 underline"
                >
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
          </section>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">Ordner</span>
              {!folderFormOpen && (
                <button onClick={() => setFolderFormOpen(true)} className={secondaryButtonClass}>
                  ➕ Ordner
                </button>
              )}
            </div>

            {folderFormOpen && (
              <form
                onSubmit={handleCreateFolder}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-neutral-200 bg-white p-2.5"
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
                <button type="submit" disabled={folderSaving} className={primaryButtonClass}>
                  {folderSaving ? "…" : "Anlegen"}
                </button>
                <button
                  type="button"
                  onClick={() => setFolderFormOpen(false)}
                  className="text-xs text-neutral-500 underline"
                >
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
                    className="group relative rounded-lg border border-neutral-200 bg-white p-3.5 text-center hover:shadow-sm"
                  >
                    <button onClick={() => setFolderPath([f])} className="flex w-full flex-col items-center gap-1">
                      <span className="text-xl">📁</span>
                      <span className="text-sm">{f.title}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(f)}
                      className="absolute right-1.5 top-1.5 hidden text-xs text-red-700 group-hover:block"
                      title="Ordner löschen"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Documents
              userId={userId}
              objectType="document"
              heading="Dokumente"
              lockedProjectId={project.id}
              folderId={null}
              emptyLabel="Noch keine Dokumente auf dieser Ebene."
            />
          </section>
        ))}

      {tab === "costs" && (
        <Documents
          userId={userId}
          objectType="expense"
          heading="Kosten"
          lockedProjectId={project.id}
          showAmount
          showSum
          emptyLabel="Noch keine Ausgaben für dieses Projekt erfasst."
        />
      )}
    </div>
  );
}
