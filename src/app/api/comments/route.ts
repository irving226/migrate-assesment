import { NextRequest, NextResponse } from "next/server";
import { getTopComments } from "@/lib/hn";

// GET /api/comments?storyId=8863
// Returns the top comments for a story, for the detail pane. Separate from the
// summary route so the UI can show raw comments immediately and let the user
// generate the AI summary on demand (the summary is the expensive call).
export async function GET(req: NextRequest) {
  const storyId = Number(new URL(req.url).searchParams.get("storyId"));
  if (!Number.isFinite(storyId)) {
    return NextResponse.json({ error: "storyId (number) required" }, { status: 400 });
  }
  try {
    const comments = await getTopComments(storyId, 15);
    return NextResponse.json({ comments });
  } catch (err) {
    console.error("/api/comments failed:", err);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 502 });
  }
}