-- Familientool — Teilen-Funktion (Grundlage für die UI)
--
-- Bisher gab es keinen zuverlässigen Weg, die profiles-Zeile eines Nutzers
-- anzulegen (nur lazy beim ersten Login für den Verschlüsselungs-Salt, siehe
-- 0006). Für "mit Familienmitglied teilen" muss man dessen user_id anhand
-- der E-Mail finden können — dafür braucht profiles jetzt eine email-Spalte,
-- die beim Signup automatisch befüllt wird (Trigger auf auth.users).

alter table public.profiles add column email text;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sucht die user_id zu einer E-Mail — bewusst als eigene, eng begrenzte
-- Function statt direktem SELECT auf profiles, damit Nutzer nicht die
-- komplette Nutzerliste durchsuchen/scrapen können, sondern immer nur
-- gezielt nach einer bekannten E-Mail (z. B. des Familienmitglieds) fragen.
create function public.find_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.profiles where email = p_email limit 1;
$$;

revoke all on function public.find_user_id_by_email(text) from public;
grant execute on function public.find_user_id_by_email(text) to authenticated;

-- Backfill: profiles-Zeilen, die vor diesem Trigger schon lazy angelegt
-- wurden (siehe 0006, Verschlüsselungs-Salt), hatten noch keine E-Mail.
insert into public.profiles (id, email)
select u.id, u.email from auth.users u
on conflict (id) do update set email = excluded.email;
