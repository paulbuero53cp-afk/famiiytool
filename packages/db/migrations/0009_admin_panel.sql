-- Familientool — Grundlage für das Admin-Panel
--
-- Admin muss alle Profile sehen + Rollen ändern können (Nutzerverwaltung,
-- siehe CLAUDE.md). Direkte Policies, die auf profiles selbst wieder
-- profiles abfragen, wären erneut selbstreferenziell rekursiv (wie schon in
-- 0005 bei objects/object_permissions) — deshalb wieder eine SECURITY
-- DEFINER-Hilfsfunktion, die die RLS-Auswertung für den eigenen Rollen-Check
-- umgeht.

create function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create policy "profiles: Admin sieht alle Profile"
  on public.profiles for select
  using (public.is_current_user_admin());

-- Nur die Rolle ist zum Ändern gedacht (Nutzerverwaltung) — email/salt
-- gehören dem jeweiligen Nutzer selbst, RLS kann das nicht spaltenweise
-- einschränken, aber die App-UI bietet nur den Rollen-Wechsel an.
create policy "profiles: Admin verwaltet Rollen"
  on public.profiles for update
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());
