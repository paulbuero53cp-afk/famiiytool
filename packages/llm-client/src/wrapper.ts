// Zentraler Claude-API-Wrapper. Läuft ausschließlich serverseitig
// (Supabase Edge Function, siehe apps/api/functions/llm-summarize) —
// ANTHROPIC_API_KEY darf nie in einem VITE_-Client-Bundle landen.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// USD pro 1M Token, Stand siehe claude-api-Skill — bei Modellwechsel hier pflegen.
const PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
};

export interface SummarizeParams {
  apiKey: string;
  text: string;
  context?: string;
  model?: string;
}

export interface SummarizeResult {
  summary: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export async function summarize(params: SummarizeParams): Promise<SummarizeResult> {
  const model = params.model ?? "claude-sonnet-5";

  const userContent = params.context
    ? `Kontext: ${params.context}\n\nText:\n${params.text}`
    : params.text;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": params.apiKey,
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
    const errorBody = await response.text();
    throw new Error(`Claude API Fehler (${response.status}): ${errorBody}`);
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

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING_PER_MILLION_TOKENS[model];
  if (!pricing) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}
