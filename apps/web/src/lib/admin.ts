import { supabase } from "./supabaseClient";

export interface Profile {
  id: string;
  email: string | null;
  role: "admin" | "user";
}

export interface UsageLogEntry {
  id: string;
  user_id: string;
  object_id: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  created_at: string;
}

export interface AccessLogEntry {
  id: string;
  object_id: string;
  admin_id: string;
  reason: string;
  created_at: string;
}

export async function isCurrentUserAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data?.role === "admin";
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select("id, email, role").order("email");
  if (error) throw error;
  return data as Profile[];
}

export async function setUserRole(userId: string, role: "admin" | "user"): Promise<void> {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw error;
}

async function callAdminFunction(name: string, body: Record<string, unknown>): Promise<unknown> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Nicht eingeloggt");

  const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
  const response = await fetch(functionsUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

// Legt einen Nutzer-Account direkt an (ohne Selbstregistrierung/Bestätigungs-
// mail) — nur für Admins, siehe apps/api/functions/admin-create-user.
export async function createUser(email: string, password: string): Promise<void> {
  await callAdminFunction("admin-create-user", { email, password });
}

// Löscht einen Nutzer-Account unwiderruflich inkl. ALLER seiner Objekte
// (cascade, siehe 0001_init.sql) — nur für Admins, siehe
// apps/api/functions/admin-delete-user. Die UI muss vor dem Aufruf eine
// starke Bestätigung einholen (siehe Admin.tsx).
export async function deleteUser(userId: string): Promise<void> {
  await callAdminFunction("admin-delete-user", { userId });
}

export async function listUsageLog(): Promise<UsageLogEntry[]> {
  const { data, error } = await supabase
    .from("llm_usage_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as UsageLogEntry[];
}

// Einziger Weg für Admins, ein fremdes Objekt zu lesen — protokolliert IMMER
// zuerst den Zugriff (siehe 0002_break_glass.sql), bevor das Objekt
// zurückkommt. Liefert weder encrypted_field im Klartext (das kann selbst
// der Admin ohne das Passwort des Owners nicht entschlüsseln) noch
// storage-Dateien — nur die unverschlüsselten Metadaten/Content-Felder.
export async function breakGlassRead(objectId: string, reason: string) {
  const { data, error } = await supabase.rpc("admin_break_glass_read", {
    p_object_id: objectId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function listAccessLogForObject(objectId: string): Promise<AccessLogEntry[]> {
  const { data, error } = await supabase
    .from("access_log")
    .select("*")
    .eq("object_id", objectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as AccessLogEntry[];
}
