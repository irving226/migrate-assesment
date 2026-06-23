import type { Story, Tag } from "./types";

export type Weights = Partial<Record<Tag, number>>;

// Score one story against the query weights: sum the weight of each tag the
// story has. A story tagged [ai_ml, technical_deep_dive] against weights
// { ai_ml: 1, company_or_startup_news: -0.6 } scores 1 (it has ai_ml, doesn't
// have the negative one). Pure arithmetic over already-cached tags — no LLM,
// no network, runs instantly on the client.
export function scoreStory(story: Story, weights: Weights): number {
  let score = 0;
  for (const tag of story.tags) {
    score += weights[tag] ?? 0;
  }
  return score;
}

// RANK mode (default): keep every story, sort most-relevant first. Stories the
// query said nothing about score 0 and sink to the middle; explicitly-excluded
// topics score negative and sink to the bottom. Nothing disappears.
export function rankStories(stories: Story[], weights: Weights): Story[] {
  if (!Object.keys(weights).length) return stories;
  return [...stories]
    .map((s) => ({ s, score: scoreStory(s, weights) }))
    .sort((a, b) => b.score - a.score)
    .map(({ s }) => s);
}

// FILTER mode: stricter — drop anything that doesn't positively match. Useful
// when the user wants a focused list rather than a reordering. A story survives
// only if it scores above 0 (has at least one boosted tag and no net negative).
export function filterStories(stories: Story[], weights: Weights): Story[] {
  if (!Object.keys(weights).length) return stories;
  return stories.filter((s) => scoreStory(s, weights) > 0);
}