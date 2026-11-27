// Supabase Edge Function (Deno). Requires the ANTHROPIC_API_KEY secret.
// POST { action: "transcribe", image: <base64 jpeg> } -> { text }
// POST { action: "analyze", text } -> { analysis }
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5-5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const TRANSCRIBE_SYSTEM = `You transcribe photographed handwritten pages from a garage's daily log. The handwriting is in Hebrew and may include numbers, licence plates, prices and car or part names in Hebrew or English.
Return only the transcription, in the original language, keeping the page's line breaks. Do not summarise, translate, correct or add anything. Where a word cannot be read, write [?] in its place rather than guessing.`;

const ANALYZE_SYSTEM = `You read a garage owner's free-text summary of one working day, written in Hebrew, and pull out four lists:
- good: things that went well that day.
- bad: things that went badly, problems or delays.
- positive_reviews: praise or good feedback from customers.
- negative_reviews: complaints or bad feedback from customers.
Each item is one short Hebrew sentence. Use only what the text says; a list with nothing to report stays empty. Do not repeat a customer review in the good or bad lists.`;

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    good: { type: "array", items: { type: "string" } },
    bad: { type: "array", items: { type: "string" } },
    positive_reviews: { type: "array", items: { type: "string" } },
    negative_reviews: { type: "array", items: { type: "string" } },
  },
  required: ["good", "bad", "positive_reviews", "negative_reviews"],
  additionalProperties: false,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function isSignedIn(req: Request): Promise<boolean> {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return false;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

async function ask(params: {
  system: string;
  content: Anthropic.Beta.BetaMessageParam["content"];
  effort: "low" | "medium";
  schema?: Record<string, unknown>;
}): Promise<string> {
  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // If the model declines a request, the API retries it on a fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: params.system,
    output_config: {
      effort: params.effort,
      ...(params.schema ? { format: { type: "json_schema", schema: params.schema } } : {}),
    },
    messages: [{ role: "user", content: params.content }],
  });

  if (response.stop_reason === "refusal") throw new Error("The model declined the request");
  if (response.stop_reason === "max_tokens") throw new Error("The response was cut off");

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // The anon key alone is public, so require a real signed-in user.
    if (!(await isSignedIn(req))) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();

    if (body.action === "transcribe" && typeof body.image === "string") {
      const text = await ask({
        system: TRANSCRIBE_SYSTEM,
        effort: "medium",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: body.image } },
          { type: "text", text: "Transcribe this page." },
        ],
      });
      return json({ text });
    }

    if (body.action === "analyze" && typeof body.text === "string") {
      const raw = await ask({
        system: ANALYZE_SYSTEM,
        effort: "low",
        content: body.text,
        schema: ANALYSIS_SCHEMA,
      });
      return json({ analysis: JSON.parse(raw) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error("Anthropic API error", error.status, error.message);
      return json({ error: "AI request failed" }, 502);
    }
    console.error(error);
    return json({ error: "Internal error" }, 500);
  }
});
