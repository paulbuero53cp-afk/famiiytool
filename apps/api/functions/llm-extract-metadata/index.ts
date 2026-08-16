// Supabase Edge Function — Deno-Laufzeit.
// Einziger Aufrufweg: expliziter Klick "Metadaten aus Scan vorschlagen" im
// Anlege-Formular (siehe Documents.tsx) — kein automatischer Trigger beim
// Datei-Upload (siehe /CLAUDE.md, Sicherheitsregel 4). Nimmt ein Foto/Scan
// (Bild oder PDF) als Base64 entgegen und lässt Claude Vision Titel,
// passende Tags und ein evtl. erkennbares Fälligkeits-/Ablaufdatum
// vorschlagen — der Nutzer sieht die Vorschläge nur im Formular und
// entscheidet selbst, ob/wie er sie übernimmt, es wird nichts automatisch
// gespeichert.
//
// Bewusst als EINE Datei gehalten (kein Import aus packages/llm-client),
// damit sie 1:1 in den Supabase-Dashboard-Function-Editor eingefügt werden
// kann, wie llm-summarize/llm-generate.

import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
};

const ALLOWED_MODELS = Object.keys(PRICING_PER_MILLION_TOKENS);
const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
// Kategorien, die im Haus-Modul als Tags vorgeschlagen werden (siehe
// lib/modules.tsx) — Claude wird gebeten, sich nach Möglichkeit daran zu
// orientieren, ist aber nicht strikt darauf beschränkt.
const SUGGESTED_TAG_HINTS = ["steuern", "versicherung", "grundbuch", "technik", "vertrag", "zaehlerstand"];

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING_PER_MILLION_TOKENS[model];
  if (!pricing) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

async function extractMetadata(
  apiKey: string,
  base64Data: string,
  mediaType: string,
  model = "claude-sonnet-5",
) {
  const fileBlock =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: mediaType, data: base64Data } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-beta": "pdfs-2024-09-25",
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            {
              type: "text",
              text:
                "Das ist ein gescanntes Haushalts-Dokument (z. B. Vertrag, Rechnung, Versicherungspolice, " +
                "Steuerbescheid, Zählerstand). Gib GENAU ein JSON-Objekt zurück, ohne Markdown-Codeblock und " +
                "ohne weiteren Text, mit den Feldern: " +
                `"title" (kurzer, prägnanter Titel auf Deutsch), ` +
                `"tags" (Array mit 1-3 passenden Stichworten, bevorzugt aus [${SUGGESTED_TAG_HINTS.join(", ")}], ` +
                "aber auch andere treffende Begriffe sind ok), " +
                '"dueDate" (Fälligkeits- oder Ablaufdatum im Format YYYY-MM-DD, falls im Dokument erkennbar, ' +
                'sonst null). Beispiel: {"title":"Hausratversicherung Musterversicherung","tags":["versicherung"],"dueDate":"2027-01-15"}',
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API Fehler (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  const rawText: string = data.content?.[0]?.text ?? "{}";
  const inputTokens: number = data.usage?.input_tokens ?? 0;
  const outputTokens: number = data.usage?.output_tokens ?? 0;

  let parsed: { title?: string; tags?: string[]; dueDate?: string | null };
  try {
    // Claude hält sich meist ans JSON-only-Format, aber zur Sicherheit
    // eventuelle Markdown-Codeblock-Zäune (```json ... ```) entfernen.
    const cleaned = rawText.replace(/^```json\s*|```\s*$/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Konnte KI-Antwort nicht als JSON lesen");
  }

  return {
    title: typeof parsed.title === "string" ? parsed.title : "",
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t) => typeof t === "string") : [],
    dueDate: typeof parsed.dueDate === "string" ? parsed.dueDate : null,
    model,
    inputTokens,
    outputTokens,
    estimatedCostUsd: estimateCostUsd(model, inputTokens, outputTokens),
  };
}

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

  const { fileData, mediaType, model } = await req.json();

  if (!fileData || !mediaType) {
    return new Response("fileData und mediaType sind Pflichtfelder", { status: 400, headers: corsHeaders });
  }

  if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
    return new Response(`Nicht unterstützter Dateityp: ${mediaType}`, { status: 400, headers: corsHeaders });
  }

  if (model && !ALLOWED_MODELS.includes(model)) {
    return new Response(`Unbekanntes Modell: ${model}`, { status: 400, headers: corsHeaders });
  }

  let result;
  try {
    result = await extractMetadata(Deno.env.get("ANTHROPIC_API_KEY")!, fileData, mediaType, model);
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Metadaten-Erkennung fehlgeschlagen", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  await serviceClient.from("llm_usage_log").insert({
    user_id: user.id,
    object_id: null,
    model: result.model,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    estimated_cost_usd: result.estimatedCostUsd,
  });

  return new Response(JSON.stringify({ title: result.title, tags: result.tags, dueDate: result.dueDate }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
