import type { Story, Tag } from "./types";

export type Weights = Partial<Record<Tag, number>>;


export function scoreStory(story: Story, weights: Weights): number {
  let score = 0;
  for (const tag of story.tags) {
    score += weights[tag] ?? 0;
  }
  return score;
}


export function rankStories(stories: Story[], weights: Weights): Story[] {
  if (!Object.keys(weights).length) return stories;
  return [...stories]
    .map((s) => ({ s, score: scoreStory(s, weights) }))
    .sort((a, b) => b.score - a.score)
    .map(({ s }) => s);
}


export function filterStories(stories: Story[], weights: Weights): Story[] {
  if (!Object.keys(weights).length) return stories;
  return stories.filter((s) => scoreStory(s, weights) > 0);
}