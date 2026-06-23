import type { HNItem, Story, Comment, StoryType } from "./types";
import { domainTags, extractDomain } from "./domain-tags";

const HN_BASE = "https://hacker-news.firebaseio.com/v0";

// Map story-type param to the HN list endpoint 
const LIST_ENDPOINT: Record<StoryType, string> = {
  top: "topstories",
  new: "newstories",
  best: "beststories",
  ask: "askstories",
  show: "showstories",
  job: "jobstories",
};

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${HN_BASE}/${path}.json`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`HN ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export async function getItem(id: number): Promise<HNItem | null> {
  return getJSON<HNItem | null>(`item/${id}`);
}

// Returns the ordered list of story IDs for a given feed.
export async function getStoryIds(type: StoryType): Promise<number[]> {
  return getJSON<number[]>(LIST_ENDPOINT[type]);
}

// Normalize a raw HN item into our Story shape. Tags start as whatever the
// domain table can infer for free; the LLM fills the rest in downstream.
function toStory(item: HNItem): Story {
  const domain = extractDomain(item.url);
  return {
    id: item.id,
    title: item.title ?? "(untitled)",
    url: item.url ?? null,
    domain,
    by: item.by ?? "unknown",
    score: item.score ?? 0,
    descendants: item.descendants ?? 0,
    time: item.time ?? 0,
    kids: item.kids,
    type: item.type ?? "story",
    text: item.text ?? null,
    tags: domainTags(domain),
  };
}

// Fetch a page of stories for a feed. We slice the ID list to `limit` BEFORE
// fetching items, so we only ever load the page the user actually sees —
// HN returns up to 500 IDs and we are not going to fetch 500 items.
export async function getStories(
  type: StoryType,
  page = 0,
  limit = 30
): Promise<Story[]> {
  const ids = await getStoryIds(type);
  const slice = ids.slice(page * limit, page * limit + limit);
  const items = await Promise.all(slice.map(getItem));
  return items
    .filter((it): it is HNItem => !!it && !it.deleted && !it.dead)
    .map(toStory);
}

// Pull the top N comments for summarization. We walk only the top-level kids
// (ranked order is preserved by HN) and take their text — no deep recursion,
// because a flat sample of the highest-ranked comments is plenty of signal
// for a discussion summary and keeps the fetch bounded.
export async function getTopComments(
  storyId: number,
  limit = 15
): Promise<Comment[]> {
  const story = await getItem(storyId);
  if (!story?.kids?.length) return [];
  const topKids = story.kids.slice(0, limit);
  const items = await Promise.all(topKids.map(getItem));
  return items
    .filter(
      (it): it is HNItem =>
        !!it && !it.deleted && !it.dead && !!it.text
    )
    .map((it) => ({
      id: it.id,
      by: it.by ?? "unknown",
      text: it.text ?? "",
      time: it.time ?? 0,
      kids: it.kids,
    }));
}