// Client-seitige Verschlüsselung für das sensible Feld (Entscheidung
// 2026-08-11: Passwort-abgeleiteter Schlüssel pro Nutzer). Läuft komplett im
// Browser über WebCrypto — Passwort und abgeleiteter Schlüssel verlassen den
// Client nie. Damit kann niemand außer dem Nutzer selbst entschlüsseln, auch
// nicht Admin oder Betreiber — im Gegenzug ist ein Passwort-Reset gleich­
// bedeutend mit dem endgültigen Verlust aller verschlüsselten Inhalte.

const PBKDF2_ITERATIONS = 100_000;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function generateSaltBase64(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(password: string, saltBase64: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: fromBase64(saltBase64) as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// Ausgabeformat: base64(iv[12 Bytes] || ciphertext) — IV ist pro Verschlüsselung
// neu zufällig, muss nicht geheim sein, wird einfach mitgespeichert.
export async function encryptText(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return toBase64(combined);
}

// Wirft, wenn der Schlüssel falsch ist (falsches Passwort) — AES-GCM erkennt
// das über den Auth-Tag, statt stillschweigend Datenmüll zu liefern.
export async function decryptText(key: CryptoKey, payloadBase64: string): Promise<string> {
  const combined = fromBase64(payloadBase64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
