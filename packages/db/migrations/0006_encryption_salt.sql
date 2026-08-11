-- Familientool — Verschlüsselungs-Salt pro Nutzer
-- Entscheidung 2026-08-11: Passwort-abgeleiteter Schlüssel pro Nutzer.
-- Der Salt selbst ist nicht geheim (nur die Kombination aus Salt + Passwort
-- ergibt den AES-Schlüssel), darf also in der DB liegen — die eigentliche
-- Ver-/Entschlüsselung passiert ausschließlich im Browser (siehe
-- apps/web/src/lib/crypto.ts). Niemand außer dem Nutzer selbst (auch nicht
-- Admin oder Betreiber) kann encrypted_field ohne das Nutzer-Passwort lesen.

alter table public.profiles add column encryption_salt text;

-- Bisher gab es keine INSERT-Policy auf profiles — Zeilen mussten von Hand
-- angelegt werden. Für den Verschlüsselungs-Flow legt die App beim ersten
-- Login automatisch die eigene Profilzeile inkl. frischem Salt an.
create policy "profiles: eigenes Profil anlegen"
  on public.profiles for insert
  with check (id = auth.uid());
