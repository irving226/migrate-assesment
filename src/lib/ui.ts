import type { Tag } from "@/lib/types";

// Display metadata for tags: short label + the CSS var holding its hue.
// The CSS vars live in globals.css; keeping the mapping here means components
// never hardcode colors.
export const TAG_META: Record<Tag, { label: string; cssVar: string }> = {
  ai_ml: { label: "ai/ml", cssVar: "--t-ai" },
  technical_deep_dive: { label: "deep dive", cssVar: "--t-tech" },
  new_tool_or_library: { label: "tool", cssVar: "--t-tool" },
  company_or_startup_news: { label: "company", cssVar: "--t-co" },
  security_privacy: { label: "security", cssVar: "--t-sec" },
  science_research: { label: "research", cssVar: "--t-sci" },
  show_hn_launch: { label: "show hn", cssVar: "--t-show" },
  career_work_culture: { label: "career", cssVar: "--t-career" },
  policy_regulation_law: { label: "policy", cssVar: "--t-policy" },
  opinion_analysis: { label: "opinion", cssVar: "--t-op" },
};

export const SIGNAL_DOMAINS = new Set([
  "github.com", "arxiv.org", "simonwillison.net", "danluu.com",
]);

// Discussion temperature: comments-per-point on a log curve -> 0..1.
// A thread with many comments relative to its score is contentious (hot);
// high score with few comments is broad agreement (calm).
export function temperature(score: number, comments: number): number {
  const ratio = comments / Math.max(score, 1);
  return Math.max(0, Math.min(1, Math.log10(ratio + 1) / Math.log10(7)));
}

export function tempLabel(t: number): string {
  return t < 0.3 ? "calm" : t < 0.55 ? "warm" : t < 0.78 ? "spirited" : "blazing";
}

// Heat ramp: cool slate -> amber -> HN orange at blazing. Orange at the top
// doubles as a quiet HN echo.
export function tempColor(t: number): string {
  if (t < 0.3) return "#5d8a9e";
  if (t < 0.55) return "#c6a35a";
  if (t < 0.78) return "#e08544";
  return "#ff6a1a";
}

export function timeAgo(unixSec: number): string {
  const m = Math.floor((Date.now() / 1000 - unixSec) / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}