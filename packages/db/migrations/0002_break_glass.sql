-- Familientool — Break-Glass-Zugriff für Admins
-- Admin hat laut CLAUDE.md KEINEN automatischen Content-Zugriff.
-- Diese Function ist der EINZIGE Weg, wie ein Admin ein fremdes Objekt lesen kann:
-- security definer, prüft die Rolle, erzwingt eine Begründung, schreibt IMMER
-- zuerst den access_log-Eintrag, bevor das Objekt zurückgegeben wird.

create function public.admin_break_glass_read(
  p_object_id uuid,
  p_reason text
)
returns public.objects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_object public.objects;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if v_role is distinct from 'admin' then
    raise exception 'nur Admins dürfen Break-Glass-Zugriffe auslösen';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Begründung ist Pflicht für Break-Glass-Zugriff';
  end if;

  insert into public.access_log (object_id, admin_id, reason)
  values (p_object_id, auth.uid(), p_reason);

  select * into v_object from public.objects where id = p_object_id;

  return v_object;
end;
$$;

-- Nur eingeloggten Nutzern erlaubt aufzurufen (Rollenprüfung passiert innerhalb der Function)
revoke all on function public.admin_break_glass_read(uuid, text) from public;
grant execute on function public.admin_break_glass_read(uuid, text) to authenticated;
