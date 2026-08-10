-- Familientool — Basis-Schema
-- Sicherheitsregeln siehe /CLAUDE.md — RLS ist Pflicht ab dieser ersten Migration.

create extension if not exists "pgcrypto";

-- Rollen-Erweiterung auf auth.users via eigener Profiltabelle
-- (auth.users selbst darf nicht per RLS/Migration verändert werden)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: eigenes Profil lesen"
  on public.profiles for select
  using (id = auth.uid());

-- Generisches Objekt-Schema (siehe CLAUDE.md, Datenmodell-Grundsatz)
create table public.objects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  content text,
  encrypted_field text,
  storage_path text,
  is_template boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.objects enable row level security;

-- Explizites Teilen: object_id + user_id + permission_level
create table public.object_permissions (
  object_id uuid not null references public.objects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  permission_level text not null check (permission_level in ('read', 'write')),
  created_at timestamptz not null default now(),
  primary key (object_id, user_id)
);

alter table public.object_permissions enable row level security;

-- Pflicht-Log bei jedem Break-Glass-Zugriff eines Admins
create table public.access_log (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  admin_id uuid not null references auth.users (id),
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.access_log enable row level security;

-- RLS: objects
-- Default: nur Owner sieht/ändert sein Objekt.
create policy "objects: Owner sieht eigene Objekte"
  on public.objects for select
  using (owner_id = auth.uid());

create policy "objects: Owner verwaltet eigene Objekte"
  on public.objects for insert
  with check (owner_id = auth.uid());

create policy "objects: Owner aktualisiert eigene Objekte"
  on public.objects for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "objects: Owner löscht eigene Objekte"
  on public.objects for delete
  using (owner_id = auth.uid());

-- Erweiterung: explizit freigegebene Objekte sind für die Freigabe-Empfänger sichtbar
create policy "objects: freigegeben lesen"
  on public.objects for select
  using (
    exists (
      select 1 from public.object_permissions p
      where p.object_id = objects.id
        and p.user_id = auth.uid()
    )
  );

-- RLS: object_permissions — nur der Owner des zugehörigen Objekts verwaltet Freigaben
create policy "object_permissions: Owner verwaltet Freigaben"
  on public.object_permissions for all
  using (
    exists (
      select 1 from public.objects o
      where o.id = object_permissions.object_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.objects o
      where o.id = object_permissions.object_id
        and o.owner_id = auth.uid()
    )
  );

create policy "object_permissions: Empfänger sieht eigene Freigabe"
  on public.object_permissions for select
  using (user_id = auth.uid());

-- RLS: access_log
-- Admin erzeugt Einträge nur über die Break-Glass-Funktion (siehe 0002_break_glass.sql),
-- nicht per Direkt-Insert — daher hier keine Insert-Policy für normale Nutzer.
create policy "access_log: Owner des betroffenen Objekts sieht Zugriffe"
  on public.access_log for select
  using (
    exists (
      select 1 from public.objects o
      where o.id = access_log.object_id
        and o.owner_id = auth.uid()
    )
  );

create policy "access_log: Admin sieht eigene Break-Glass-Einträge"
  on public.access_log for select
  using (admin_id = auth.uid());

-- updated_at automatisch pflegen
create function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger objects_set_updated_at
  before update on public.objects
  for each row execute function public.set_updated_at();
