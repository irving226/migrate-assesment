import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { TAGS, TAG_DESCRIPTIONS, type Tag } from "@/lib/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = "gpt-4o-mini";
const TAG_SET = new Set<string>(TAGS);

// The "find articles I'm interested in" feature.
//
// One LLM call turns a plain-English phrase into WEIGHTED tag affinities:
//   "AI papers, nothing about funding"
//     -> { ai_ml: 1, science_research: 0.8, company_or_startup_news: -0.6 }
//
// Positive = boost, negative = bury. The client then scores each story locally
// (dot product of the story's cached tags with these weights) and can either
// SORT by score (re-rank, nothing hidden) or DROP non-positives (filter). Same
// response powers both behaviors. No per-story LLM cost — the weights come back
// once, the scoring is pure arithmetic against tags we already cached.

type Weights = Partial<Record<Tag, number>>;

const SYSTEM_PROMPT = `You turn a user's natural-language request into weighted
affinities over a fixed Hacker News tag taxonomy.

Available tags:
${TAGS.map((t) => `- ${t}: ${TAG_DESCRIPTIONS[t]}`).join("\n")}

Return a weight from -1 to 1 for each tag the request implies:
- Positive (up to 1): the user wants more of this. Stronger interest = higher.
- Negative (down to -1): the user wants less of this / explicitly excludes it.
- Omit tags the request says nothing about (treated as 0).

Respond with ONLY JSON, no markdown:
{"weights": {"tag": number, ...}, "explanation": "<one short sentence>"}

Rules:
- Use ONLY tags from the list. Never invent tags.
- Keep it focused — usually 1-4 non-zero weights.
- Use negatives only when the request implies avoidance ("not", "no", "without", "tired of").
- If nothing matches, return {} for weights and say so in the explanation.`;

// Coerce the model's object into valid {tag: number in [-1,1]} only. Drops
// unknown tags and clamps out-of-range numbers rather than trusting the model.
function sanitize(raw: unknown): Weights {
  if (!raw || typeof raw !== "object") return {};
  const out: Weights = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!TAG_SET.has(key)) continue;
    const n = Number(val);
    if (!Number.isFinite(n)) continue;
    out[key as Tag] = Math.max(-1, Math.min(1, n));
  }
  return out;
}

// POST /api/search  { "query": "AI papers but nothing about funding rounds" }
export async function POST(req: NextRequest) {
  let query: string;
  try {
    const body = await req.json();
    query = String(body.query ?? "").trim();
    if (!query) throw new Error("empty");
  } catch {
    return NextResponse.json({ error: "query (string) required" }, { status: 400 });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: query },
      ],
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const weights = sanitize(parsed.weights);
    const hasWeights = Object.keys(weights).length > 0;
    const explanation =
      typeof parsed.explanation === "string"
        ? parsed.explanation
        : hasWeights
        ? `Ranking by: ${Object.keys(weights).join(", ")}`
        : "Couldn't match that to any topics.";

    return NextResponse.json({ query, weights, explanation });
  } catch (err) {
    console.error("/api/search failed:", err);
    return NextResponse.json({ error: "Failed to parse query" }, { status: 502 });
  }
}