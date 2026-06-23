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

  // Business / startup press. General-interest outlets get company_or_startup_news
  // as a weak base; the title routinely overrides (a Reuters piece can be policy
  // or science), which is exactly why these are hints and the LLM gets the title.
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

  // Personal tech blogs — recurring HN fixtures with a consistent voice.
  // These are the single most reliable domain hints in the whole table: one
  // author, one lane, title rarely overrides. Picked from the consistently
  // top-scoring individual HN authors in public BigQuery analyses.
  "simonwillison.net": ["ai_ml", "opinion_analysis"],
  "paulgraham.com": ["opinion_analysis"],
  "danluu.com": ["technical_deep_dive"],
  "jvns.ca": ["technical_deep_dive"],

  // Company eng/research blogs. NOTE the domain says "company" but the content
  // is almost always technical or AI — so we lead with the technical tag and let
  // the title confirm. A clean example of domain-as-medium vs title-as-topic.
  "anthropic.com": ["ai_ml"],
  "openai.com": ["ai_ml"],
  "devblogs.microsoft.com": ["technical_deep_dive"],
  "phoronix.com": ["technical_deep_dive"],

  // DELIBERATELY UNMAPPED: twitter.com, x.com, youtube.com, medium.com,
  // substack.com, blogspot.com, wordpress.com.
  // Two reasons. Social/video carry medium, not topic — a YouTube link could be
  // a conf talk, a demo, or a research presentation, and a tweet's HN title is
  // often just the author. Generic blogging platforms host every topic under one
  // domain, so the host tells you nothing. In both cases a domain hint would
  // mislead the model rather than help it, so we leave them out and tag from the
  // title alone. (Public HN analyses note the community itself heavily filters
  // these out — consistent with them being low-signal.) Known weak spot; see README.
};

// Domains where the path adds a strong second signal. Checked only when the
// host matched nothing decisive above. Kept tiny on purpose — path parsing is
// noisy and we don't want to over-fit.
const PATH_HINTS: { host: string; segment: string; tags: Tag[] }[] = [
  { host: "openai.com", segment: "research", tags: ["ai_ml", "science_research"] },
  { host: "openai.com", segment: "blog", tags: ["ai_ml", "company_or_startup_news"] },
  { host: "google.com", segment: "research", tags: ["science_research"] },
];

// Pull a bare hostname from a URL. Strips the leading www. and lowercases.
// Returns null for self-posts (Ask HN etc.) which have no url.
export function extractDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

// Return any tags we can infer from the domain alone. Empty array means
// "no opinion — let the LLM decide." Self-posts (null domain) get show_hn_launch
// as a weak default since they're almost always Ask/Show HN.
export function domainTags(domain: string | null): Tag[] {
  if (!domain) return ["show_hn_launch"];

  if (DOMAIN_TAGS[domain]) return [...DOMAIN_TAGS[domain]];

  // Subdomain fallback: blog.acme.github.io should still match github.io etc.
  const matchKey = Object.keys(DOMAIN_TAGS).find((d) => domain.endsWith(d));
  if (matchKey) return [...DOMAIN_TAGS[matchKey]];

  return [];
}

// Slightly richer lookup that also peeks at the path. Used by the tagger to
// build LLM hints; the cheap domainTags() above is enough for initial render.
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
    // malformed path — fall through to base
  }
  return base;
}