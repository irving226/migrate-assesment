import type { Story, StoryType } from "./types";
import type { Weights } from "./scoring";

// The only place the frontend talks to the backend. Each function maps to one
// route handler. Mock data is gone — these hit the real endpoints, which hold
// the OpenAI/Supabase keys server-side.

export interface Comment {
  id: number;
  by: string;
  text: string;
  time: number;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// GET /api/stories — fetch + tag a feed page.
export async function fetchStories(
  type: StoryType,
  page = 0
): Promise<Story[]> {
  const res = await fetch(`/api/stories?type=${type}&page=${page}`);
  if (!res.ok) throw new Error(`Failed to load ${type} stories`);
  const data = await res.json();
  return data.stories as Story[];
}

// POST /api/search — natural-language query -> weighted tag affinities.
export async function fetchWeights(
  query: string
): Promise<{ weights: Weights; explanation: string }> {
  return postJSON("/api/search", { query });
}

// POST /api/tag — summarize a story's discussion from its comment tree.
// (Route is named /api/tag for historical reasons; it summarizes. Rename to
//  /api/summarize when convenient — see README.)
export async function fetchSummary(
  storyId: number
): Promise<{ summary: string; commentCount: number }> {
  return postJSON("/api/tag", { storyId });
}

// GET /api/comments — top comments for the detail view. (You'll add this thin
// route; it wraps lib/hn.ts getTopComments. Included here so the UI is ready.)
export async function fetchComments(storyId: number): Promise<Comment[]> {
  const res = await fetch(`/api/comments?storyId=${storyId}`);
  if (!res.ok) throw new Error("Failed to load comments");
  const data = await res.json();
  return data.comments as Comment[];
}