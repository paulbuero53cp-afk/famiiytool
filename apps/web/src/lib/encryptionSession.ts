// Hält den vom Passwort abgeleiteten AES-Schlüssel NUR im Arbeitsspeicher der
// laufenden Session — kein localStorage, kein Server. Ein Seiten-Reload
// verwirft den Schlüssel bewusst (siehe crypto.ts): das ist der Preis für
// "niemand außer dem Nutzer kann entschlüsseln", nicht ein Bug.

import { supabase } from "./supabaseClient";
import { decryptText, deriveKey, encryptText, generateSaltBase64 } from "./crypto";

let currentKey: CryptoKey | null = null;

export function getEncryptionKey(): CryptoKey | null {
  return currentKey;
}

export function clearEncryptionKey(): void {
  currentKey = null;
}

// Nach jedem erfolgreichen Login aufrufen (Login.tsx hat an dieser Stelle
// noch das Klartext-Passwort aus dem Formular vorliegen — später nie wieder).
export async function unlockEncryption(userId: string, password: string): Promise<void> {
  const { data: profile, error: selectError } = await supabase
    .from("profiles")
    .select("encryption_salt")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) throw selectError;

  let salt = profile?.encryption_salt;

  if (!salt) {
    salt = generateSaltBase64();
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({ id: userId, encryption_salt: salt });
    if (upsertError) throw upsertError;
  }

  currentKey = await deriveKey(password, salt);
}

// Passwort-Ändern bedeutet: neuer Salt + neuer Schlüssel, also müssen ALLE
// eigenen encrypted_field-Werte mit dem alten Schlüssel entschlüsselt und
// mit dem neuen wieder verschlüsselt werden — sonst wären sie mit dem neuen
// Passwort für immer unlesbar. currentKey ist hier bereits der korrekte alte
// Schlüssel (durch den erfolgreichen Login schon verifiziert), daher wird
// das aktuelle Passwort hier nicht nochmal separat abgefragt.
export async function changePassword(userId: string, newPassword: string): Promise<void> {
  const oldKey = currentKey;
  if (!oldKey) {
    throw new Error("Verschlüsselung nicht bereit — bitte einmal aus- und wieder einloggen.");
  }

  const { data: ownDocs, error: selectError } = await supabase
    .from("objects")
    .select("id, encrypted_field")
    .eq("owner_id", userId)
    .not("encrypted_field", "is", null);
  if (selectError) throw selectError;

  const newSalt = generateSaltBase64();
  const newKey = await deriveKey(newPassword, newSalt);

  const reencrypted: { id: string; encrypted_field: string }[] = [];
  for (const doc of ownDocs ?? []) {
    const plaintext = await decryptText(oldKey, doc.encrypted_field as string);
    reencrypted.push({ id: doc.id, encrypted_field: await encryptText(newKey, plaintext) });
  }

  // Erst alle neu verschlüsselten Werte schreiben, DANN Salt + Auth-Passwort
  // ändern — bricht die Reihenfolge ab, bleibt der alte Schlüssel weiter gültig.
  for (const doc of reencrypted) {
    const { error } = await supabase
      .from("objects")
      .update({ encrypted_field: doc.encrypted_field })
      .eq("id", doc.id);
    if (error) throw error;
  }

  const { error: saltError } = await supabase
    .from("profiles")
    .update({ encryption_salt: newSalt })
    .eq("id", userId);
  if (saltError) throw saltError;

  const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
  if (authError) throw authError;

  currentKey = newKey;
}
