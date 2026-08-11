-- Fix: E-Mail-Suche beim Teilen war case-sensitiv, Supabase Auth normalisiert
-- E-Mails beim Signup aber auf Kleinschreibung — "TestB@..." fand die intern
-- als "testb@..." gespeicherte Zeile nicht. Vergleich jetzt case-insensitiv.

create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.profiles where lower(email) = lower(p_email) limit 1;
$$;
