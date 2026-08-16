import { useState } from "react";
import { createDocument } from "../lib/objects";
import { STATUS_OPTIONS } from "./ProjectWorkspace";

interface ProjectWizardProps {
  userId: string;
  onDone: () => void;
  onCancel: () => void;
}

const smallInputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none";
const smallLabelClass = "block text-xs font-medium text-neutral-500 mb-1";
const secondaryButtonClass =
  "rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-50";
const primaryButtonClass =
  "rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50";

interface MilestoneDraft {
  title: string;
  date: string;
}

const STEP_COUNT = 4;

export function ProjectWizard({ userId, onDone, onCancel }: ProjectWizardProps) {
  const [step, setStep] = useState(1);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [milestoneDrafts, setMilestoneDrafts] = useState<MilestoneDraft[]>([]);
  const [milestoneTitleDraft, setMilestoneTitleDraft] = useState("");
  const [milestoneDateDraft, setMilestoneDateDraft] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addMilestoneDraft() {
    if (!milestoneTitleDraft.trim()) return;
    setMilestoneDrafts((prev) => [...prev, { title: milestoneTitleDraft.trim(), date: milestoneDateDraft }]);
    setMilestoneTitleDraft("");
    setMilestoneDateDraft("");
  }

  function removeMilestoneDraft(index: number) {
    setMilestoneDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      const project = await createDocument(
        {
          type: "project",
          title,
          content,
          sensitiveField: "",
          isTemplate: false,
          tags: [],
          projectId: null,
          amount: null,
          status: status || null,
          startDate: startDate || null,
          dueDate: endDate || null,
        },
        userId,
      );

      for (const draft of milestoneDrafts) {
        await createDocument(
          {
            type: "milestone",
            title: draft.title,
            content: "",
            sensitiveField: "",
            isTemplate: false,
            tags: [],
            projectId: project.id,
            amount: null,
            dueDate: draft.date || null,
          },
          userId,
        );
      }

      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Projekt konnte nicht angelegt werden");
      setSaving(false);
    }
  }

  const canLeaveStep1 = title.trim().length > 0;

  return (
    <div className="space-y-3 rounded-lg border-t-2 border-t-neutral-900 border-x border-b border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Neues Projekt — Schritt {step} von {STEP_COUNT}
        </h3>
        <button type="button" onClick={onCancel} className="text-xs text-neutral-400 hover:text-neutral-700">
          ✕
        </button>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>}

      {step === 1 && (
        <div>
          <label className={smallLabelClass}>Titel</label>
          <input
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={smallInputClass}
          />
        </div>
      )}

      {step === 2 && (
        <div>
          <label className={smallLabelClass}>Ziele / Beschreibung</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="Was soll mit diesem Projekt erreicht werden?"
            className={smallInputClass}
          />
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={smallLabelClass}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={smallInputClass}>
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
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={smallInputClass} />
          </div>
          <div>
            <label className={smallLabelClass}>Ende</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={smallInputClass} />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-2">
          <label className={smallLabelClass}>Erste Meilensteine (optional)</label>
          {milestoneDrafts.length > 0 && (
            <div className="space-y-1.5">
              {milestoneDrafts.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-sm"
                >
                  <span>
                    {m.title}
                    {m.date && <span className="text-xs text-neutral-500"> ({new Date(m.date).toLocaleDateString("de-DE")})</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMilestoneDraft(i)}
                    className="text-xs text-red-700 underline"
                  >
                    Entfernen
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[8rem] flex-1">
              <label className={smallLabelClass}>Titel</label>
              <input
                value={milestoneTitleDraft}
                onChange={(e) => setMilestoneTitleDraft(e.target.value)}
                className={smallInputClass}
              />
            </div>
            <div>
              <label className={smallLabelClass}>Zieldatum</label>
              <input
                type="date"
                value={milestoneDateDraft}
                onChange={(e) => setMilestoneDateDraft(e.target.value)}
                className={smallInputClass}
              />
            </div>
            <button type="button" onClick={addMilestoneDraft} className={secondaryButtonClass}>
              ➕ Hinzufügen
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="text-xs text-neutral-500 underline disabled:opacity-30"
        >
          ← Zurück
        </button>
        {step < STEP_COUNT ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEP_COUNT, s + 1))}
            disabled={step === 1 && !canLeaveStep1}
            className={primaryButtonClass}
          >
            Weiter →
          </button>
        ) : (
          <button type="button" onClick={handleFinish} disabled={saving} className={primaryButtonClass}>
            {saving ? "Legt an…" : "Projekt anlegen"}
          </button>
        )}
      </div>
    </div>
  );
}
