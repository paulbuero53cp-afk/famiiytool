-- Fix: "infinite recursion detected in policy for relation objects" (42P17)
--
-- Ursache: die objects-Policy "freigegeben lesen" fragt object_permissions ab,
-- dessen eigene Policy wiederum objects abfragt (Owner-Check) — beide Male
-- greift dabei erneut RLS auf die jeweils andere Tabelle, was sich endlos
-- fortsetzt. Fix: SECURITY DEFINER-Hilfsfunktionen kapseln den Check und
-- umgehen dabei die RLS-Auswertung der abgefragten Tabelle (laufen mit den
-- Rechten des Funktions-Owners), wodurch der Zirkelbezug durchbrochen wird.

create function public.is_object_owner(p_object_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.objects o
    where o.id = p_object_id and o.owner_id = auth.uid()
  );
$$;

create function public.is_object_shared_with_me(p_object_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.object_permissions p
    where p.object_id = p_object_id and p.user_id = auth.uid()
  );
$$;

revoke all on function public.is_object_owner(uuid) from public;
revoke all on function public.is_object_shared_with_me(uuid) from public;
grant execute on function public.is_object_owner(uuid) to authenticated;
grant execute on function public.is_object_shared_with_me(uuid) to authenticated;

drop policy "objects: freigegeben lesen" on public.objects;
create policy "objects: freigegeben lesen"
  on public.objects for select
  using (public.is_object_shared_with_me(id));

drop policy "object_permissions: Owner verwaltet Freigaben" on public.object_permissions;
create policy "object_permissions: Owner verwaltet Freigaben"
  on public.object_permissions for all
  using (public.is_object_owner(object_id))
  with check (public.is_object_owner(object_id));
