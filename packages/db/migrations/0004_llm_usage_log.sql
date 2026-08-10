-- Familientool — Token-/Kosten-Logging pro LLM-Aufruf
-- Wird ausschließlich serverseitig (Edge Function, service role) beschrieben,
-- siehe /packages/llm-client — nie direkt vom Client aus.

create table public.llm_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  object_id uuid references public.objects (id) on delete set null,
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  estimated_cost_usd numeric(10, 6) not null,
  created_at timestamptz not null default now()
);

alter table public.llm_usage_log enable row level security;

create policy "llm_usage_log: eigene Nutzung sehen"
  on public.llm_usage_log for select
  using (user_id = auth.uid());

-- Admins sehen die Gesamtnutzung fürs Kosten-Monitoring (kein Content-Zugriff,
-- diese Tabelle enthält keine Dokumentinhalte)
create policy "llm_usage_log: Admin sieht alle Einträge"
  on public.llm_usage_log for select
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role = 'admin'
    )
  );
