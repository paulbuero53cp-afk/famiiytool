import { supabase } from "./supabaseClient";
import { decryptText, encryptText } from "./crypto";
import { getEncryptionKey } from "./encryptionSession";

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
  created_at: string;
  updated_at: string;
}

export interface NewDocumentInput {
  title: string;
  content: string;
  sensitiveField: string;
  isTemplate: boolean;
}

export async function listMyDocuments(): Promise<DocumentObject[]> {
  const { data, error } = await supabase
    .from("objects")
    .select("*")
    .order("created_at", { ascending: false });

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
      type: "document",
      title: input.title,
      content: input.content,
      encrypted_field: encryptedField,
      is_template: input.isTemplate,
    })
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

export async function getFileUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from("objects").createSignedUrl(storagePath, 60);
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
    })
    .select()
    .single();

  if (error) throw error;
  return data as DocumentObject;
}

export async function summarizeDocument(objectId: string, text: string): Promise<string> {
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
    body: JSON.stringify({ objectId, text }),
  });

  if (!response.ok) {
    throw new Error(`Zusammenfassung fehlgeschlagen: ${await response.text()}`);
  }

  const { summary } = await response.json();
  return summary as string;
}
