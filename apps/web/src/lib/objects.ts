import { supabase } from "./supabaseClient";
import { decryptText, encryptText } from "./crypto";
import { getEncryptionKey } from "./encryptionSession";

// Muss mit ALLOWED_MODELS in apps/api/functions/llm-generate|llm-summarize
// und PRICING_PER_MILLION_TOKENS dort übereinstimmen — neues Modell braucht
// Einträge an allen drei Stellen.
export const LLM_MODELS: { value: string; label: string }[] = [
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5 — günstig & schnell" },
  { value: "claude-sonnet-5", label: "Sonnet 5 — Standard" },
];

const LLM_MODEL_STORAGE_KEY = "familientool-llm-model";

export function getPreferredLlmModel(): string {
  return localStorage.getItem(LLM_MODEL_STORAGE_KEY) ?? "claude-sonnet-5";
}

export function setPreferredLlmModel(model: string): void {
  localStorage.setItem(LLM_MODEL_STORAGE_KEY, model);
}

export interface DocumentObject {
  id: string;
  owner_id: string;
  type: string;
  title: string;
  content: string | null;
  // Passwort-abgeleitet AES-GCM-verschlüsselt (siehe lib/crypto.ts). Enthält
  // NIE Klartext in der DB — Ver-/Entschlüsselung passiert ausschließlich im
  // Browser mit dem session-lokalen Schlüssel aus lib/encryptionSession.ts.
  encrypted_field: string | null;
  storage_path: string | null;
  is_template: boolean;
  tags: string[];
  // Generische Verknüpfung Objekt -> Projekt (siehe 0011_projects_and_finance.sql).
  // Ein "Projekt" ist selbst nur ein objects-Eintrag mit type='project'.
  project_id: string | null;
  // Generisches Betrags-Feld, primär für type='expense' (Finanzverwaltung) —
  // keine eigene Tabelle, bewusst wiederverwendbar für andere Typen.
  amount: number | null;
  // Siehe 0012_folders_and_milestones.sql — Ordner sind objects-Einträge mit
  // type='folder', Dokumente in einem Unterordner tragen dessen id hier.
  // Ordner können wieder folder_id auf einen anderen Ordner setzen (echte
  // Baumstruktur, kein Tiefenlimit im Schema).
  folder_id: string | null;
  // Primär für type='milestone' — Zieldatum bzw. Erledigt-Status.
  due_date: string | null;
  done: boolean;
  // Siehe 0013_music.sql — primär für type='track' (Interpret/Album, Genre
  // liegt in tags). artist/album bewusst eigene Spalten statt Tag-Hack, da
  // strukturiert sortiert/angezeigt wird (gleiche Linie wie amount/due_date).
  artist: string | null;
  album: string | null;
  // Primär für type='playlist' — geordnetes Array von Track-IDs, kein
  // Join-Table (siehe 0013_music.sql).
  track_ids: string[];
  // Siehe 0014_project_planning.sql. status: primär für type='project'
  // ('geplant'|'laeuft'|'pausiert'|'abgeschlossen'). start_date: Projektbeginn
  // (due_date wird für Projekte als Ende wiederverwendet). parent_id: für
  // type='task' — verweist auf den übergeordneten Meilenstein.
  // linked_document_id: optionale Verknüpfung zu einem Projekt-Dokument.
  status: string | null;
  start_date: string | null;
  parent_id: string | null;
  linked_document_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewDocumentInput {
  type: string;
  title: string;
  content: string;
  sensitiveField: string;
  isTemplate: boolean;
  tags: string[];
  projectId: string | null;
  amount: number | null;
  folderId?: string | null;
  dueDate?: string | null;
  artist?: string | null;
  album?: string | null;
  status?: string | null;
  startDate?: string | null;
  parentId?: string | null;
  linkedDocumentId?: string | null;
}

export async function listMyDocuments(): Promise<DocumentObject[]> {
  const { data, error } = await supabase
    .from("objects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as DocumentObject[];
}

// type='project' — Projekte sind bewusst keine eigene Tabelle (siehe
// CLAUDE.md, Datenmodell-Grundsatz), nur eine gefilterte Sicht auf objects.
export async function listMyProjects(): Promise<DocumentObject[]> {
  const { data, error } = await supabase
    .from("objects")
    .select("*")
    .eq("type", "project")
    .order("title");

  if (error) throw error;
  return data as DocumentObject[];
}

export async function createDocument(input: NewDocumentInput, ownerId: string): Promise<DocumentObject> {
  let encryptedField: string | null = null;
  if (input.sensitiveField) {
    const key = getEncryptionKey();
    if (!key) {
      throw new Error("Verschlüsselung nicht bereit — bitte einmal aus- und wieder einloggen.");
    }
    encryptedField = await encryptText(key, input.sensitiveField);
  }

  const { data, error } = await supabase
    .from("objects")
    .insert({
      owner_id: ownerId,
      type: input.type,
      title: input.title,
      content: input.content,
      encrypted_field: encryptedField,
      is_template: input.isTemplate,
      tags: input.tags,
      project_id: input.projectId,
      amount: input.amount,
      folder_id: input.folderId ?? null,
      due_date: input.dueDate ?? null,
      ...(input.artist !== undefined ? { artist: input.artist } : {}),
      ...(input.album !== undefined ? { album: input.album } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.startDate !== undefined ? { start_date: input.startDate } : {}),
      ...(input.parentId !== undefined ? { parent_id: input.parentId } : {}),
      ...(input.linkedDocumentId !== undefined ? { linked_document_id: input.linkedDocumentId } : {}),
    })
    .select()
    .single();

  if (error) throw error;
  return data as DocumentObject;
}

export interface UpdateDocumentInput {
  title: string;
  content: string;
  sensitiveField: string;
  tags: string[];
  projectId: string | null;
  amount: number | null;
  dueDate?: string | null;
  artist?: string | null;
  album?: string | null;
  status?: string | null;
  startDate?: string | null;
  linkedDocumentId?: string | null;
}

export async function updateDocument(objectId: string, input: UpdateDocumentInput): Promise<DocumentObject> {
  let encryptedField: string | null = null;
  if (input.sensitiveField) {
    const key = getEncryptionKey();
    if (!key) {
      throw new Error("Verschlüsselung nicht bereit — bitte einmal aus- und wieder einloggen.");
    }
    encryptedField = await encryptText(key, input.sensitiveField);
  }

  const { data, error } = await supabase
    .from("objects")
    .update({
      title: input.title,
      content: input.content,
      encrypted_field: encryptedField,
      tags: input.tags,
      project_id: input.projectId,
      amount: input.amount,
      ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
      ...(input.artist !== undefined ? { artist: input.artist } : {}),
      ...(input.album !== undefined ? { album: input.album } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.startDate !== undefined ? { start_date: input.startDate } : {}),
      ...(input.linkedDocumentId !== undefined ? { linked_document_id: input.linkedDocumentId } : {}),
    })
    .eq("id", objectId)
    .select()
    .single();

  if (error) throw error;
  return data as DocumentObject;
}

export interface ProjectOverviewInput {
  title: string;
  content: string;
  status: string | null;
  startDate: string | null;
  dueDate: string | null;
}

// Schlankes Update nur für die Projekt-Übersicht (Titel/Ziele/Status/
// Zeitraum) — bewusst NICHT über updateDocument, das immer encrypted_field
// und tags mitschickt (würde ein evtl. gesetztes sensibles Feld ohne
// erneute Entschlüsselung überschreiben/löschen). Rührt encrypted_field/
// tags/project_id/amount gar nicht an.
export async function updateProjectOverview(objectId: string, input: ProjectOverviewInput): Promise<DocumentObject> {
  const { data, error } = await supabase
    .from("objects")
    .update({
      title: input.title,
      content: input.content,
      status: input.status,
      start_date: input.startDate,
      due_date: input.dueDate,
    })
    .eq("id", objectId)
    .select()
    .single();

  if (error) throw error;
  return data as DocumentObject;
}

// Kompaktes Update für den Erledigt-Status eines Meilensteins ODER einer
// Aufgabe (type='task', siehe 0014_project_planning.sql — beide nutzen
// denselben done-Mechanismus) — eigene Funktion statt updateDocument, weil
// eine Checkbox nicht Titel/Inhalt/Tags im Formular mitschleppen soll.
export async function setMilestoneDone(objectId: string, done: boolean): Promise<void> {
  const { error } = await supabase.from("objects").update({ done }).eq("id", objectId);
  if (error) throw error;
}

// Playlist-Reihenfolge/-Inhalt ist nur das track_ids-Array — eigene, schlanke
// Funktion statt updateDocument, das Titel/Inhalt/Tags erwartet.
export async function updatePlaylistTracks(playlistId: string, trackIds: string[]): Promise<void> {
  const { error } = await supabase.from("objects").update({ track_ids: trackIds }).eq("id", playlistId);
  if (error) throw error;
}

export async function deleteDocument(objectId: string, storagePath: string | null): Promise<void> {
  if (storagePath) {
    // Storage-Löschung vor der DB-Zeile: schlägt die Zeile fehl, bleibt die
    // Datei wenigstens noch da statt eines toten storage_path-Verweises.
    const { error: storageError } = await supabase.storage.from("objects").remove([storagePath]);
    if (storageError) throw storageError;
  }

  const { error } = await supabase.from("objects").delete().eq("id", objectId);
  if (error) throw error;
}

export async function removeFile(objectId: string, storagePath: string): Promise<DocumentObject> {
  const { error: storageError } = await supabase.storage.from("objects").remove([storagePath]);
  if (storageError) throw storageError;

  const { data, error } = await supabase
    .from("objects")
    .update({ storage_path: null })
    .eq("id", objectId)
    .select()
    .single();

  if (error) throw error;
  return data as DocumentObject;
}

// Gibt null zurück, wenn kein Schlüssel vorhanden ist (z. B. nach Reload,
// siehe encryptionSession.ts) oder das Feld leer ist — die UI zeigt dann
// einen Gesperrt-Hinweis statt eines Fehlers.
export async function decryptSensitiveField(encryptedField: string | null): Promise<string | null> {
  if (!encryptedField) return null;
  const key = getEncryptionKey();
  if (!key) return null;
  return decryptText(key, encryptedField);
}

// Binärdatei gehört NIE in die DB-Zeile — landet in Supabase Storage,
// objects.storage_path hält nur den Verweis (siehe CLAUDE.md).
// Pfad-Konvention '{owner_id}/{object_id}/{dateiname}' — die Storage-Policy
// prüft ausschließlich das erste Pfadsegment (siehe 0003_storage.sql).
export async function attachFile(object: DocumentObject, file: File, ownerId: string): Promise<DocumentObject> {
  const storagePath = `${ownerId}/${object.id}/${file.name}`;

  const { error: uploadError } = await supabase.storage.from("objects").upload(storagePath, file, {
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("objects")
    .update({ storage_path: storagePath })
    .eq("id", object.id)
    .select()
    .single();

  if (error) throw error;
  return data as DocumentObject;
}

// expiresInSeconds default bleibt bei 60 für einmalige Downloads — der
// Musik-Player übergibt einen längeren Wert (siehe lib/player.tsx), da ein
// Song länger als 60s laufen/gebuffert werden kann.
export async function getFileUrl(storagePath: string, expiresInSeconds = 60): Promise<string> {
  const { data, error } = await supabase.storage.from("objects").createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function instantiateTemplate(template: DocumentObject, ownerId: string): Promise<DocumentObject> {
  const { data, error } = await supabase
    .from("objects")
    .insert({
      owner_id: ownerId,
      type: template.type,
      title: `${template.title} (Kopie)`,
      content: template.content,
      encrypted_field: template.encrypted_field,
      is_template: false,
      tags: template.tags,
      project_id: template.project_id,
      amount: template.amount,
    })
    .select()
    .single();

  if (error) throw error;
  return data as DocumentObject;
}

// Teilen ist immer explizit und pro Objekt (siehe CLAUDE.md) — sucht die
// user_id über die eng begrenzte RPC-Function (kein direktes Durchsuchen der
// Nutzerliste möglich), legt dann den object_permissions-Eintrag an.
export async function shareDocument(objectId: string, granteeEmail: string): Promise<void> {
  const { data: granteeId, error: lookupError } = await supabase.rpc("find_user_id_by_email", {
    p_email: granteeEmail,
  });
  if (lookupError) throw lookupError;
  if (!granteeId) throw new Error(`Kein Nutzer mit E-Mail "${granteeEmail}" gefunden.`);

  const { error } = await supabase
    .from("object_permissions")
    .upsert({ object_id: objectId, user_id: granteeId, permission_level: "read" });

  if (error) throw error;
}

export interface ShareEntry {
  userId: string;
  email: string | null;
}

// Nutzt eine eng begrenzte RPC statt eines direkten profiles-SELECT — normale
// Nutzer dürfen sonst nur ihr eigenes Profil lesen (siehe 0010_list_shares.sql).
export async function listShares(objectId: string): Promise<ShareEntry[]> {
  const { data, error } = await supabase.rpc("list_shares", { p_object_id: objectId });
  if (error) throw error;
  return (data ?? []).map((row: { user_id: string; email: string | null }) => ({
    userId: row.user_id,
    email: row.email,
  }));
}

export async function revokeShare(objectId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("object_permissions")
    .delete()
    .eq("object_id", objectId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function summarizeDocument(objectId: string, text: string, model?: string): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Nicht eingeloggt");

  const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/llm-summarize`;
  const response = await fetch(functionsUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ objectId, text, model }),
  });

  if (!response.ok) {
    throw new Error(`Zusammenfassung fehlgeschlagen: ${await response.text()}`);
  }

  const { summary } = await response.json();
  return summary as string;
}

// Spiegelbildlich zu summarizeDocument: aus einem kurzen Prompt wird neuer
// Dokumentinhalt generiert (siehe apps/api/functions/llm-generate). Kein
// objectId nötig — das Dokument existiert zu diesem Zeitpunkt noch nicht.
export async function generateDocumentContent(prompt: string, context?: string, model?: string): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Nicht eingeloggt");

  const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/llm-generate`;
  const response = await fetch(functionsUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ prompt, context, model }),
  });

  if (!response.ok) {
    throw new Error(`KI-Erstellung fehlgeschlagen: ${await response.text()}`);
  }

  const { content } = await response.json();
  return content as string;
}

const EXTRACTABLE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_EXTRACT_FILE_SIZE = 8 * 1024 * 1024;

export interface ExtractedMetadata {
  documentType: string;
  title: string;
  tags: string[];
  dueDate: string | null;
  amount: number | null;
  // Typspezifische Felder (z. B. Vertragspartner/Laufzeit bei Verträgen,
  // Autor/Zusammenfassung bei Artikeln) — es gibt keine eigene DB-Spalte
  // pro Feld (siehe CLAUDE.md, Datenmodell-Grundsatz), die Werte werden
  // im Formular als formatierter Text ins content-Feld übernommen.
  fields: Record<string, string>;
}

// Baut aus den typspezifischen Feldern einen lesbaren Text fürs
// content-Feld, z. B. "Vertragspartner: Stadtwerke\nLaufzeit: 24 Monate".
export function formatExtractedFields(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // dataURL hat die Form "data:image/png;base64,AAAA…" — nur der Teil
      // nach dem Komma geht an die Edge Function.
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Datei konnte nicht gelesen werden"));
    reader.readAsDataURL(file);
  });
}

// Lässt Claude Vision Titel/Tags/Fälligkeitsdatum aus einem Foto/Scan
// vorschlagen (siehe apps/api/functions/llm-extract-metadata) — nur auf
// expliziten Klick im Formular, siehe Documents.tsx. Wirft für nicht
// unterstützte Dateitypen/zu große Dateien clientseitig, um unnötige
// Anthropic-API-Kosten zu vermeiden.
export async function extractDocumentMetadata(file: File, model?: string): Promise<ExtractedMetadata> {
  if (!EXTRACTABLE_MEDIA_TYPES.includes(file.type)) {
    throw new Error("Metadaten-Erkennung funktioniert nur für Bilder (JPEG/PNG/WebP/GIF) oder PDFs.");
  }
  if (file.size > MAX_EXTRACT_FILE_SIZE) {
    throw new Error("Datei zu groß für Metadaten-Erkennung (max. 8 MB).");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Nicht eingeloggt");

  const fileData = await fileToBase64(file);

  const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/llm-extract-metadata`;
  const response = await fetch(functionsUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ fileData, mediaType: file.type, model }),
  });

  if (!response.ok) {
    throw new Error(`Metadaten-Erkennung fehlgeschlagen: ${await response.text()}`);
  }

  return (await response.json()) as ExtractedMetadata;
}
