import OpenAI from "openai";
import { TAGS, TAG_DESCRIPTIONS, type Tag, type Story } from "./types";
import { domainTagHints } from "./domain-tags";
import { supabaseAdmin } from "./supabase/supabase";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = "gpt-4o-mini";
const BATCH_SIZE = 10; // stories per OpenAI call — ~10x fewer round-trips

const TAG_SET = new Set<string>(TAGS);

// Coerce whatever the model returns into valid tags only. The model can
// hallucinate a tag that isn't in our taxonomy; we silently drop those rather
// than trust it. Empty result is fine — "other" by omission.
function sanitize(raw: unknown): Tag[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is Tag => typeof t === "string" && TAG_SET.has(t));
}

// ---- Cache layer -----------------------------------------------------------

// Read any cached tags for these story ids in one query. Returns a map of
// id -> tags so callers can split hits from misses.
async function readCache(ids: number[]): Promise<Map<number, Tag[]>> {
  const out = new Map<number, Tag[]>();
  if (!ids.length) return out;

  const { data, error } = await supabaseAdmin
    .from("story_tags")
    .select("story_id, tags")
    .in("story_id", ids);

  if (error) {
    // A cache read failure should NOT take down tagging — degrade to "all
    // misses" and let the LLM path handle it. Log and move on.
    console.error("story_tags read failed:", error.message);
    return out;
  }

  for (const row of data ?? []) {
    out.set(row.story_id, sanitize(row.tags));
  }
  return out;
}

// Write freshly-tagged stories back to the shared cache. Upsert so a re-tag
// overwrites cleanly. Fire-and-forget from the caller's perspective — a write
// failure means we'll just re-tag next time, no correctness impact.
async function writeCache(
  rows: { story_id: number; title: string; domain: string | null; tags: Tag[]; source: string }[]
): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabaseAdmin
    .from("story_tags")
    .upsert(rows.map((r) => ({ ...r, model: MODEL })), { onConflict: "story_id" });
  if (error) console.error("story_tags write failed:", error.message);
}

// ---- LLM layer -------------------------------------------------------------

const SYSTEM_PROMPT = `You classify Hacker News stories into a fixed tag taxonomy.

Tags and their meanings:
${TAGS.map((t) => `- ${t}: ${TAG_DESCRIPTIONS[t]}`).join("\n")}

Rules:
- Assign 1-3 tags per story. Fewer is better — only tags that clearly apply.
- Use ONLY tags from the list above. Never invent tags.
- The title carries the most meaning. The domain hint is supporting evidence.
- Respond with ONLY a JSON object, no markdown, no prose:
  {"results": [{"id": <story_id>, "tags": ["tag1", "tag2"]}, ...]}
- Include every story id you were given, in any order.`;

// Tag a single batch of stories with one OpenAI call. Returns id -> tags.
async function tagBatch(stories: Story[]): Promise<Map<number, Tag[]>> {
  const payload = stories.map((s) => ({
    id: s.id,
    title: s.title,
    domain: s.domain ?? "(self-post)",
    domain_hint: domainTagHints(s.url), // pre-computed heuristic tags as a nudge
  }));

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ stories: payload }) },
    ],
  });

  const out = new Map<number, Tag[]>();
  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    for (const r of parsed.results ?? []) {
      if (typeof r.id === "number") out.set(r.id, sanitize(r.tags));
    }
  } catch (err) {
    console.error("tag batch parse failed:", err);
    // On a parse failure, fall back to domain hints so stories still get
    // *something* rather than nothing.
    for (const s of stories) out.set(s.id, domainTagHints(s.url));
  }
  return out;
}

// ---- Orchestration ---------------------------------------------------------

// The public entry point. Given stories, return them with tags filled in,
// hitting the cache first and only calling OpenAI for genuine misses.
export async function tagStories(stories: Story[]): Promise<Story[]> {
  if (!stories.length) return stories;

  const cached = await readCache(stories.map((s) => s.id));
  const misses = stories.filter((s) => !cached.has(s.id));

  // Tag misses in batches, in parallel. Each batch is one OpenAI call.
  const batches: Story[][] = [];
  for (let i = 0; i < misses.length; i += BATCH_SIZE) {
    batches.push(misses.slice(i, i + BATCH_SIZE));
  }
  const batchResults = await Promise.all(batches.map(tagBatch));

  const fresh = new Map<number, Tag[]>();
  for (const result of batchResults) {
    for (const [id, tags] of result) fresh.set(id, tags);
  }

  // Persist the fresh tags so the next request (any user) hits the cache.
  await writeCache(
    misses.map((s) => ({
      story_id: s.id,
      title: s.title,
      domain: s.domain,
      tags: fresh.get(s.id) ?? [],
      source: "llm",
    }))
  );

  // Stitch cache + fresh back onto the stories.
  return stories.map((s) => ({
    ...s,
    tags: cached.get(s.id) ?? fresh.get(s.id) ?? s.tags,
  }));
}