// Supabase Edge Function — Deno-Laufzeit.
// Einziger Aufrufweg für "Mit KI zusammenfassen": expliziter Klick im Frontend
// ruft genau diesen Endpoint auf. Es gibt keinen automatischen Trigger beim
// Speichern eines Dokuments (siehe /CLAUDE.md, Sicherheitsregel 4).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { summarize } from "../../../../packages/llm-client/src/wrapper.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Client mit dem Auth-Token des aufrufenden Nutzers — RLS greift hier ganz normal,
  // damit niemand eine object_id fremder Nutzer zusammenfassen lassen kann.
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { objectId, text, context } = await req.json();

  if (!objectId || !text) {
    return new Response("objectId und text sind Pflichtfelder", { status: 400 });
  }

  // Bestätigt implizit die RLS-Sichtbarkeit: schlägt fehl, wenn das Objekt
  // nicht dem aufrufenden Nutzer gehört oder nicht freigegeben ist.
  const { data: object, error: objectError } = await userClient
    .from("objects")
    .select("id")
    .eq("id", objectId)
    .single();

  if (objectError || !object) {
    return new Response("Objekt nicht gefunden oder kein Zugriff", { status: 404 });
  }

  const result = await summarize({
    apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
    text,
    context,
  });

  // Service-Role-Client NUR für das Kosten-Log — nicht für Content-Zugriff.
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  await serviceClient.from("llm_usage_log").insert({
    user_id: user.id,
    object_id: objectId,
    model: result.model,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    estimated_cost_usd: result.estimatedCostUsd,
  });

  return new Response(JSON.stringify({ summary: result.summary }), {
    headers: { "content-type": "application/json" },
  });
});
