import type { Tag } from "./types";

// Deterministic domain heuristics. A surprising fraction of HN links come from
// a small set of domains whose tag is obvious from the host alone. Tagging
// these here means zero LLM cost and zero latency for that slice, and it gives
// the LLM a head start (we pass these as hints) on everything else.
//
// These are HINTS, not final answers — the title still carries most of the
// meaning, so the LLM can add tags on top. We never tag a story from the URL
// alone; we tag from title + these domain hints together.
const DOMAIN_TAGS: Record<string, Tag[]> = {
  // Research / papers
  "arxiv.org": ["science_research", "ai_ml"],
  "biorxiv.org": ["science_research"],
  "nature.com": ["science_research"],
  "science.org": ["science_research"],
  "pubmed.ncbi.nlm.nih.gov": ["science_research"],
  "acm.org": ["science_research", "technical_deep_dive"],
  "ieee.org": ["science_research", "technical_deep_dive"],

  // Code / tools
  "github.com": ["new_tool_or_library"],
  "gitlab.com": ["new_tool_or_library"],
  "huggingface.co": ["ai_ml", "new_tool_or_library"],
  "pypi.org": ["new_tool_or_library"],
  "npmjs.com": ["new_tool_or_library"],
  "crates.io": ["new_tool_or_library"],

  // businesses
  "techcrunch.com": ["company_or_startup_news"],
  "bloomberg.com": ["company_or_startup_news"],
  "reuters.com": ["company_or_startup_news"],
  "wsj.com": ["company_or_startup_news"],
  "cnbc.com": ["company_or_startup_news"],
  "ft.com": ["company_or_startup_news"],
  "economist.com": ["company_or_startup_news", "opinion_analysis"],
  "theverge.com": ["company_or_startup_news"],
  "arstechnica.com": ["technical_deep_dive"],

  // Security
  "krebsonsecurity.com": ["security_privacy"],
  "thehackernews.com": ["security_privacy"],
  "portswigger.net": ["security_privacy"],

  // Policy / law
  "eff.org": ["policy_regulation_law", "security_privacy"],
  "supremecourt.gov": ["policy_regulation_law"],
  "ftc.gov": ["policy_regulation_law"],

  // Personal tech blogs 
  "simonwillison.net": ["ai_ml", "opinion_analysis"],
  "paulgraham.com": ["opinion_analysis"],
  "danluu.com": ["technical_deep_dive"],
  "jvns.ca": ["technical_deep_dive"],

  // Company eng/research blogs. 
  "anthropic.com": ["ai_ml"],
  "openai.com": ["ai_ml"],
  "devblogs.microsoft.com": ["technical_deep_dive"],
  "phoronix.com": ["technical_deep_dive"],


};

// Domains where the path adds a strong second signal. Checked only when the
// host matched nothing decisive above. Kept tiny on purpose path parsing is
// noisy and we don't want to over-fit.
const PATH_HINTS: { host: string; segment: string; tags: Tag[] }[] = [
  { host: "openai.com", segment: "research", tags: ["ai_ml", "science_research"] },
  { host: "openai.com", segment: "blog", tags: ["ai_ml", "company_or_startup_news"] },
  { host: "google.com", segment: "research", tags: ["science_research"] },
];


export function extractDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}


export function domainTags(domain: string | null): Tag[] {
  if (!domain) return ["show_hn_launch"];

  if (DOMAIN_TAGS[domain]) return [...DOMAIN_TAGS[domain]];

  const matchKey = Object.keys(DOMAIN_TAGS).find((d) => domain.endsWith(d));
  if (matchKey) return [...DOMAIN_TAGS[matchKey]];

  return [];
}


export function domainTagHints(url?: string | null): Tag[] {
  const domain = extractDomain(url);
  const base = domainTags(domain);
  if (!url || !domain) return base;

  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    for (const hint of PATH_HINTS) {
      if (domain.endsWith(hint.host) && segments.includes(hint.segment)) {
        return Array.from(new Set([...base, ...hint.tags]));
      }
    }
  } catch {
    return []

  }
  return base;
}