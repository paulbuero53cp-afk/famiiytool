import type { DocumentObject } from "../lib/objects";

interface ProjectTimelineProps {
  projects: DocumentObject[];
  onOpen: (doc: DocumentObject) => void;
}

function parseDate(d: string | null): Date | null {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function statusBarClass(status: string | null): string {
  switch (status) {
    case "laeuft":
      return "bg-blue-500";
    case "pausiert":
      return "bg-amber-500";
    case "abgeschlossen":
      return "bg-emerald-500";
    default:
      return "bg-neutral-400";
  }
}

// Gantt-artige Übersicht aller Projekte auf einer gemeinsamen Datumsachse
// (Start bis Ende). Rein lesend/navigierend — kein Bearbeiten der Balken
// selbst, Klick öffnet den Projekt-Workspace.
export function ProjectTimeline({ projects, onOpen }: ProjectTimelineProps) {
  const withDates = projects
    .map((p) => ({ project: p, start: parseDate(p.start_date), end: parseDate(p.due_date) }))
    .filter((p): p is { project: DocumentObject; start: Date | null; end: Date | null } => !!(p.start || p.end));
  const withoutDates = projects.filter((p) => !p.start_date && !p.due_date);

  if (withDates.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Noch keine Projekte mit Start- oder Enddatum — die Zeitleiste braucht mindestens ein Datum pro Projekt
        (in der Übersicht eintragbar).
      </p>
    );
  }

  const allDates = withDates.flatMap((p) => [p.start, p.end].filter((d): d is Date => !!d));
  let rangeStart = new Date(Math.min(...allDates.map((d) => d.getTime())));
  let rangeEnd = new Date(Math.max(...allDates.map((d) => d.getTime())));
  if (rangeStart.getTime() === rangeEnd.getTime()) {
    rangeEnd = new Date(rangeStart.getTime() + 14 * 24 * 60 * 60 * 1000);
  }
  const pad = (rangeEnd.getTime() - rangeStart.getTime()) * 0.05;
  rangeStart = new Date(rangeStart.getTime() - pad);
  rangeEnd = new Date(rangeEnd.getTime() + pad);
  const totalMs = rangeEnd.getTime() - rangeStart.getTime();

  function pct(d: Date): number {
    return ((d.getTime() - rangeStart.getTime()) / totalMs) * 100;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-xs text-neutral-500">
        <span>{rangeStart.toLocaleDateString("de-DE")}</span>
        <span>{rangeEnd.toLocaleDateString("de-DE")}</span>
      </div>

      <div className="space-y-3">
        {withDates.map(({ project, start, end }) => {
          const effectiveStart = start ?? end!;
          const effectiveEnd = end ?? start!;
          const left = pct(effectiveStart);
          const width = Math.max(pct(effectiveEnd) - left, 1.5);
          const tooltipParts = [
            project.title,
            start ? `Start ${start.toLocaleDateString("de-DE")}` : null,
            end ? `Ende ${end.toLocaleDateString("de-DE")}` : null,
          ].filter(Boolean);
          return (
            <div key={project.id} className="space-y-1">
              <button
                onClick={() => onOpen(project)}
                className="text-sm font-medium text-neutral-900 hover:underline"
              >
                {project.title}
              </button>
              <div className="relative h-3 rounded bg-neutral-100">
                <button
                  onClick={() => onOpen(project)}
                  title={tooltipParts.join(" — ")}
                  className={`absolute top-0 h-3 rounded ${statusBarClass(project.status)} hover:opacity-80`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {withoutDates.length > 0 && (
        <div className="space-y-1 border-t border-neutral-200 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Ohne Zeitraum</p>
          {withoutDates.map((p) => (
            <button
              key={p.id}
              onClick={() => onOpen(p)}
              className="block text-sm text-neutral-700 hover:underline"
            >
              {p.title}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-neutral-400" /> Geplant
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Läuft
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Pausiert
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Abgeschlossen
        </span>
      </div>
    </div>
  );
}
