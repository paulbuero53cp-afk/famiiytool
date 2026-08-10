# packages/llm-client

Zentraler Claude-API-Wrapper (`src/wrapper.ts`). Reine Fetch-Logik ohne
Framework-Bindung — läuft in der Supabase-Edge-Function-Laufzeit (Deno) unter
`/apps/api/functions/llm-summarize`.

## Warum nicht direkt im Frontend

`ANTHROPIC_API_KEY` darf niemals als `VITE_`-Variable existieren — alles mit
diesem Präfix landet im Client-Bundle und wäre für jeden Besucher lesbar.
Deshalb ruft das Frontend ausschließlich die Edge Function auf, nie die
Claude API direkt.

## Kosten-/Token-Logging

Jeder Aufruf schreibt einen Eintrag in `public.llm_usage_log`
(`packages/db/migrations/0004_llm_usage_log.sql`) — Token-Zahlen kommen direkt
aus der Claude-API-Response, die Kostenschätzung nutzt die Preistabelle in
`wrapper.ts` (`PRICING_PER_MILLION_TOKENS`, bei Modelländerungen pflegen).

## Deployment

```bash
supabase functions deploy llm-summarize
supabase secrets set ANTHROPIC_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
```
