import { getFileUrl, type DocumentObject } from "./objects";

export type ShareResult = "shared" | "downloaded" | "cancelled";

function fileNameFor(track: DocumentObject): string {
  const base = [track.artist, track.title].filter(Boolean).join(" - ") || "track";
  return `${base.replace(/[\\/:*?"<>|]/g, "_")}.mp3`;
}

// Teilt die MP3 als Anhang über das System-Share-Sheet (WhatsApp, Threema,
// Mail, …). Der Nutzer wählt die App selbst — wir senden nichts an Dritte.
// Wo Datei-Sharing nicht verfügbar ist (v. a. Desktop-Browser), wird die
// Datei stattdessen heruntergeladen und kann manuell angehängt werden.
export async function shareTrackFile(track: DocumentObject): Promise<ShareResult> {
  if (!track.storage_path) throw new Error("Track hat keine Datei");
  const res = await fetch(await getFileUrl(track.storage_path));
  if (!res.ok) throw new Error("Datei konnte nicht geladen werden");
  const blob = await res.blob();
  const file = new File([blob], fileNameFor(track), { type: "audio/mpeg" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: track.title });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // z. B. NotAllowedError (Nutzergeste durch langen Download verfallen) → Download-Fallback
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
