// Hält den vom Passwort abgeleiteten AES-Schlüssel NUR im Arbeitsspeicher der
// laufenden Session — kein localStorage, kein Server. Ein Seiten-Reload
// verwirft den Schlüssel bewusst (siehe crypto.ts): das ist der Preis für
// "niemand außer dem Nutzer kann entschlüsseln", nicht ein Bug.

import { supabase } from "./supabaseClient";
import { deriveKey, generateSaltBase64 } from "./crypto";

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
