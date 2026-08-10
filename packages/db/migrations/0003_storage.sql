-- Familientool — Storage-Bucket + Policies
-- Binärdateien liegen NIE in der DB (siehe CLAUDE.md), sondern in diesem
-- privaten Bucket. Zugriff ausschließlich über signierte, zeitlich begrenzte
-- URLs — der Bucket selbst ist nicht öffentlich.
--
-- Konvention: storage_path = '{owner_id}/{object_id}/{dateiname}'
-- Die Storage-Policy prüft ausschließlich das erste Pfadsegment (owner_id)
-- und ist damit UNABHÄNGIG von der objects-RLS-Policy — eine DB-Policy
-- schützt nicht automatisch die zugehörige Datei im Bucket (siehe Requirement).

insert into storage.buckets (id, name, public)
values ('objects', 'objects', false)
on conflict (id) do nothing;

create policy "storage objects: Owner lädt in eigenen Ordner hoch"
  on storage.objects for insert
  with check (
    bucket_id = 'objects'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage objects: Owner liest eigene Dateien"
  on storage.objects for select
  using (
    bucket_id = 'objects'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage objects: Owner löscht eigene Dateien"
  on storage.objects for delete
  using (
    bucket_id = 'objects'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Freigegebene Dateien: lesbar, wenn das zugehörige objects-Objekt über
-- object_permissions explizit mit dem aktuellen Nutzer geteilt ist.
-- Erfordert, dass storage_path in objects hinterlegt und dessen erstes
-- Pfadsegment mit dem Ordnernamen hier übereinstimmt.
create policy "storage objects: freigegeben lesen"
  on storage.objects for select
  using (
    bucket_id = 'objects'
    and exists (
      select 1
      from public.objects o
      join public.object_permissions p on p.object_id = o.id
      where o.storage_path = storage.objects.name
        and p.user_id = auth.uid()
    )
  );
