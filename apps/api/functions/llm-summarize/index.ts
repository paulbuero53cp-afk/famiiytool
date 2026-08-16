// Supabase Edge Function — Deno-Laufzeit.
// Einziger Aufrufweg für "Mit KI zusammenfassen": expliziter Klick im Frontend
// ruft genau diesen Endpoint auf. Es gibt keinen automatischen Trigger beim
// Speichern eines Dokuments (siehe /CLAUDE.md, Sicherheitsregel 4).
//
// Bewusst als EINE Datei gehalten (kein Import aus packages/llm-client),
// damit sie 1:1 in den Supabase-Dashboard-Function-Editor eingefügt werden
// kann — Deploy dort braucht keinen CLI-Login. Die Wrapper-Logik in
// packages/llm-client/src/wrapper.ts ist die dokumentierte Referenzversion;
// bei Änderungen beide Stellen synchron halten.

import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
};

// Nur Modelle aus PRICING_PER_MILLION_TOKENS sind wählbar — verhindert, dass
// über das model-Feld ein beliebiger String an die Anthropic-API durchgereicht
// wird, und stellt sicher, dass die Kostenschätzung im Admin-Panel stimmt.
const ALLOWED_MODELS = Object.keys(PRICING_PER_MILLION_TOKENS);

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING_PER_MILLION_TOKENS[model];
  if (!pricing) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

async function summarize(apiKey: string, text: string, context: string | undefined, model = "claude-sonnet-5") {
  const userContent = context ? `Kontext: ${context}\n\nText:\n${text}` : text;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Fasse den folgenden Text präzise auf Deutsch zusammen:\n\n${userContent}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API Fehler (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  const summary = data.content?.[0]?.text ?? "";
  const inputTokens: number = data.usage?.input_tokens ?? 0;
  const outputTokens: number = data.usage?.output_tokens ?? 0;

  return {
    summary,
    model,
    inputTokens,
    outputTokens,
    estimatedCostUsd: estimateCostUsd(model, inputTokens, outputTokens),
  };
}

// Browser ruft diese Function direkt vom Frontend-Origin auf (kein eigener
// Reverse-Proxy) — daher muss der Preflight (OPTIONS) explizit beantwortet
// werden, sonst blockt der Browser den eigentlichen POST-Request per CORS.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
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
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const { objectId, text, context, model } = await req.json();

  if (!objectId || !text) {
    return new Response("objectId und text sind Pflichtfelder", { status: 400, headers: corsHeaders });
  }

  if (model && !ALLOWED_MODELS.includes(model)) {
    return new Response(`Unbekanntes Modell: ${model}`, { status: 400, headers: corsHeaders });
  }

  // Bestätigt implizit die RLS-Sichtbarkeit: schlägt fehl, wenn das Objekt
  // nicht dem aufrufenden Nutzer gehört oder nicht freigegeben ist.
  const { data: object, error: objectError } = await userClient
    .from("objects")
    .select("id")
    .eq("id", objectId)
    .single();

  if (objectError || !object) {
    return new Response("Objekt nicht gefunden oder kein Zugriff", { status: 404, headers: corsHeaders });
  }

  const result = await summarize(Deno.env.get("ANTHROPIC_API_KEY")!, text, context, model);

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
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
