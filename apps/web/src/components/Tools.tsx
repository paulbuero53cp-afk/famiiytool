// Landing-Seite für die "Tools"-Kategorie (siehe lib/modules.tsx). Tools
// sind bewusst zustandslose Standalone-Dateien unter apps/web/public/
// (siehe CLAUDE.md, Mini-Tools) — kein Schreiben in die Datenbank, reiner
// Upload → Verarbeitung im Browser → Download. Werden hier nur verlinkt,
// nicht nach React portiert.

interface Tool {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: string;
}

const tools: Tool[] = [
  {
    id: "pdf-tool",
    title: "PDF-Werkzeug",
    description: "PDFs zusammenführen, trennen, mit Wasserzeichen versehen, Seiten verwalten, kommentieren.",
    href: "/pdf-tool.html",
    icon: "📄",
  },
];

export function Tools() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">Tools</h2>
      <p className="text-sm text-neutral-500">
        Eigenständige Werkzeuge ohne Datenbank-Anbindung — Dateien werden nur im Browser verarbeitet, nichts wird
        gespeichert oder hochgeladen.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <a
            key={tool.id}
            href={tool.href}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 hover:shadow-sm"
          >
            <span className="text-2xl">{tool.icon}</span>
            <span className="font-medium text-neutral-900">{tool.title}</span>
            <span className="text-sm text-neutral-500">{tool.description}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
