import { supabase } from "./supabaseClient";

export interface DocumentObject {
  id: string;
  owner_id: string;
  type: string;
  title: string;
  content: string | null;
  // TODO(Verschlüsselung): aktuell Klartext-Platzhalter. Bevor echte sensible
  // Daten gespeichert werden, muss hier anwendungsseitige Verschlüsselung
  // rein (siehe CLAUDE.md, Sicherheitsregel 3) — Schlüsselverwaltung ist noch
  // nicht entschieden (Session 1 offen gelassen).
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
  const { data, error } = await supabase
    .from("objects")
    .insert({
      owner_id: ownerId,
      type: "document",
      title: input.title,
      content: input.content,
      // TODO(Verschlüsselung): siehe DocumentObject.encrypted_field
      encrypted_field: input.sensitiveField || null,
      is_template: input.isTemplate,
    })
    .select()
    .single();

  if (error) throw error;
  return data as DocumentObject;
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
