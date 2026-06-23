import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getItem, getTopComments } from "@/lib/hn";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = "gpt-4o-mini";

// Strip HN's HTML out of comment text so we feed the model clean prose and
// don't waste tokens on markup. Good enough for summarization input.
function stripHtml(html: string): string {
  return html
    .replace(/<p>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .trim();
}

const SYSTEM_PROMPT = `You summarize Hacker News discussions for a busy reader.
Given a story title and its top comments, produce a tight summary of the
DISCUSSION (not the article). Focus on: the main points of agreement, the main
disagreements or criticisms, and any notable insight or correction. 3-5 sentences,
plain prose, no preamble, no bullet lists unless genuinely warranted.`;

// POST /api/tag  { "storyId": 8863 }
//
// Despite the name, this summarizes a story's DISCUSSION. Summarization needs
// the comment tree, not the URL — HN threads routinely diverge from the linked
// article, which is the whole point of reading HN. On-demand only (fires when a
// story is opened), so cost is naturally bounded by what the user actually reads.
export async function POST(req: NextRequest) {
  let storyId: number;
  try {
    const body = await req.json();
    storyId = Number(body.storyId);
    if (!Number.isFinite(storyId)) throw new Error("bad id");
  } catch {
    return NextResponse.json({ error: "storyId (number) required" }, { status: 400 });
  }

  try {
    const story = await getItem(storyId);
    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const comments = await getTopComments(storyId, 15);
    if (!comments.length) {
      return NextResponse.json({
        storyId,
        summary: "No discussion yet — this story has no comments to summarize.",
        commentCount: 0,
      });
    }

    const commentBlock = comments
      .map((c, i) => `Comment ${i + 1} (by ${c.by}):\n${stripHtml(c.text)}`)
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Story: ${story.title}\n\nTop comments:\n\n${commentBlock}`,
        },
      ],
    });

    const summary = completion.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ storyId, summary, commentCount: comments.length });
  } catch (err) {
    console.error("/api/tag (summarize) failed:", err);
    return NextResponse.json({ error: "Failed to summarize discussion" }, { status: 502 });
  }
}