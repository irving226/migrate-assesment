import { NextRequest, NextResponse } from "next/server";
import { getStories } from "@/lib/hn";
import { tagStories } from "@/lib/tagger";
import type { StoryType } from "@/lib/types";

const VALID_TYPES: StoryType[] = ["top", "new", "best", "ask", "show", "job"];

// GET /api/stories?type=top&page=0&limit=30
//
// Fetches one page of a HN feed, then tags it (cache-first). The OpenAI token
// never leaves this handler — the client only ever sees finished Story objects.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const type = (searchParams.get("type") ?? "top") as StoryType;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const page = Math.max(0, Number(searchParams.get("page") ?? 0));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 30)));

  try {
    const stories = await getStories(type, page, limit);
    const tagged = await tagStories(stories);
    return NextResponse.json({ stories: tagged, page, type });
  } catch (err) {
    console.error("/api/stories failed:", err);
    return NextResponse.json(
      { error: "Failed to load stories" },
      { status: 502 }
    );
  }
}