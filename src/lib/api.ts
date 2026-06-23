import type { Story, StoryType } from "./types";
import type { Weights } from "./scoring";

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

// fetch + tag a feed page.
export async function fetchStories(
  type: StoryType,
  page = 0
): Promise<Story[]> {
  const res = await fetch(`/api/stories?type=${type}&page=${page}`);
  if (!res.ok) throw new Error(`Failed to load ${type} stories`);
  const data = await res.json();
  return data.stories as Story[];
}

// NL with weighted tag affinities.
export async function fetchWeights(
  query: string
): Promise<{ weights: Weights; explanation: string }> {
  return postJSON("/api/search", { query });
}

// summarize a story's discussion from its comment tree.
export async function fetchSummary(
  storyId: number
): Promise<{ summary: string; commentCount: number }> {
  return postJSON("/api/summarize", { storyId });
}

// top comments for the detail view. 
export async function fetchComments(storyId: number): Promise<Comment[]> {
  const res = await fetch(`/api/comments?storyId=${storyId}`);
  if (!res.ok) throw new Error("Failed to load comments");
  const data = await res.json();
  return data.comments as Comment[];
}