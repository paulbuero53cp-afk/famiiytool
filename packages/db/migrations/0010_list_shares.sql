-- Familientool — Freigabe-Übersicht
--
-- Normale Nutzer dürfen laut RLS nur ihr eigenes profiles lesen (Admin sieht
-- alle, siehe 0009). Damit ein Owner sieht, MIT WEM sein Dokument geteilt
-- ist (E-Mail statt nur user_id), braucht es eine eng begrenzte
-- SECURITY DEFINER-Function statt einer generellen Lese-Policy auf
-- profiles — sie gibt ausschließlich E-Mails der tatsächlichen
-- Freigabe-Empfänger dieses einen Objekts zurück, nichts sonst.

create function public.list_shares(p_object_id uuid)
returns table (user_id uuid, email text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_object_owner(p_object_id) then
    raise exception 'nur der Owner darf die Freigabe-Liste eines Objekts einsehen';
  end if;

  return query
    select p.user_id, pr.email
    from public.object_permissions p
    join public.profiles pr on pr.id = p.user_id
    where p.object_id = p_object_id;
end;
$$;

revoke all on function public.list_shares(uuid) from public;
grant execute on function public.list_shares(uuid) to authenticated;
