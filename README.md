# grok·hn — a signal reader for Hacker News

A small web app that makes Hacker News easier to *grok*: it tags stories by topic, summarizes the discussion (not just the article), shows how contentious each thread is at a glance, and lets you find what you care about either by clicking topic chips or describing it in plain English.

Built with Next.js (App Router), TypeScript, TanStack Query, OpenAI (`gpt-4o-mini`), and Supabase as a shared tag cache.

---

## How to run it

**Prerequisites:** Node 18+, an OpenAI API key, and a Supabase project (free tier is fine).

1. **Install**
   ```bash
   npm install
   ```

2. **Set environment variables.** Copy `.env.example` to `.env.local` and fill in:
   ```
   OPENAI_API_KEY=sk-...
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-(or-anon)-key
   SUPABASE_SERVICE_ROLE_KEY=your-secret-(or-service-role)-key
   ```
   The two public values are browser-safe; the service-role/secret key is server-only and must never reach the client.

3. **Create the cache table.** In the Supabase dashboard → SQL Editor, paste and run `db/schema.sql`. This creates the `story_tags` table, its index, and a read-only RLS policy. (Verify RLS shows enabled on the table afterward — tables created via the SQL editor don't enable it by default.)

4. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

The app works without Supabase configured — it just re-tags on every load instead of using the cache. OpenAI is required for tagging, summaries, and natural-language search.

---

## What I built

A two-pane reader. The left pane is a dense, scannable list of stories for a chosen feed (top / new / best / ask / show). The right pane opens when you select a story and shows its details, top comments, and an on-demand AI summary of the discussion.

Four capabilities sit on top of the raw HN data:

**AI topic tagging.** Every story is classified into a curated 10-tag taxonomy (`ai_ml`, `technical_deep_dive`, `new_tool_or_library`, `company_or_startup_news`, `security_privacy`, `science_research`, `show_hn_launch`, `career_work_culture`, `policy_regulation_law`, `opinion_analysis`). I narrowed the assessment's ~30 suggested tags to 10 deliberately: fewer categories make the filter UI legible and raise classification accuracy, since the model hedges less across a smaller space.

**Discussion summaries.** Selecting a story and clicking "generate summary" sends the story's *top comments* to the model and returns a tight summary of the conversation — points of agreement, disagreement, and notable corrections. This summarizes the **discussion**, not the linked article, because on HN the thread routinely diverges from the article, and that divergence is the interesting part.

**Two ways to find things.** Topic chips filter the list by tag (structured). A natural-language search box ("ai papers, nothing about funding") handles intent the chips can't express — compound interest and negation. Under the hood the query is translated once into *weighted tag affinities* (e.g. `ai_ml: +1, company_or_startup_news: -0.6`), and the list is then re-ranked locally so relevant stories rise and de-prioritized ones sink. Nothing is hidden; it's a re-ranking, not a hard filter.

**Discussion temperature (the signature feature).** Each story shows a small gauge of how *contentious* its thread is, derived from comments-per-point on a log curve. A thread with 230 comments on a 46-point post reads "blazing" — it's a fight; 95 comments on a 680-point post reads "calm" — broad agreement. This is the one genuinely *grok*-y insight no other HN reader gives you: you can tell a fight from a love-in before opening it.

### Architecture

```
Browser (React, TanStack Query)
  → /api/stories   GET   fetch a feed page + tag it (cache-first)
  → /api/comments  GET   top comments for the detail pane
  → /api/tag       POST  summarize a discussion (on-demand)
  → /api/search    POST  natural language → weighted tag affinities
        ↓
  HN API (Firebase)   ·   OpenAI (gpt-4o-mini)   ·   Supabase story_tags cache
```

The OpenAI and Supabase keys live only in the route handlers — the client never sees them. Tagging is **cache-first**: `/api/stories` reads cached tags from Supabase in one query, sends only the cache misses to OpenAI (batched 10 stories per call, ~10× fewer round-trips), then writes the new tags back. Because a story's tags aren't user-specific — story 8863 is `ai_ml` for everyone — the cache is shared across all users with no auth required. The second person to view a story (or you tomorrow) pays nothing.

A small **domain lookup table** tags a slice of stories for free, with no LLM call at all: `github.com = tool`, `arxiv.org = paper`, known personal blogs (`danluu.com`, `simonwillison.net`) to their lanes, and so on. I sampled the last ~510 HN stories to ground this: the distribution is sharply head-heavy (GitHub alone is ~7% of the feed), and the table free-tags roughly **18%** of stories deterministically. The remaining ~80% is a long tail of single-occurrence domains where no lookup helps, so the LLM + cache carries it. I deliberately left `twitter.com`, `youtube.com`, and generic blog platforms *unmapped* — they signal medium, not topic, so a domain hint there would mislead the model rather than help it.

---

## What works

- Browsing top / new / best / ask / show feeds, cached per-feed so tab switches don't refetch.
- AI tagging with the shared Supabase cache and free domain pre-tagging.
- On-demand discussion summaries from the comment tree.
- Topic-chip filtering and natural-language weighted re-ranking, both running client-side over cached tags (no per-story LLM cost for search).
- The discussion-temperature gauge on every row.
- Two-pane reading on desktop, full-overlay detail on mobile; keyboard focus, reduced-motion support.
- Verified: full `next build` passes, types clean.

---

## What's incomplete

- **Tagging accuracy on weak-signal domains.** Social and video links (Twitter, YouTube) and generic blog platforms get no domain hint and have thin titles, so they're the worst-tagged stories. The honest fix is enriching the prompt input with the linked page's `<title>`/meta description or oEmbed data — not done here to stay within scope.
- **No pagination UI.** The API supports `?page=`, but the frontend only loads the first page of each feed.
- **No tests.** Given the time box I prioritized a working end-to-end product over a test suite. The pure functions (`scoring.ts`, `domain-tags.ts`, the temperature math) are the natural first targets and are written to be easily unit-testable.
- **Summaries aren't cached.** Unlike tags, summaries re-call OpenAI each time a story is opened. They could share the same Supabase pattern.

---

## Tradeoffs I made

- **10 tags, not 30.** Accuracy and a legible UI over exhaustive coverage.
- **Shared cache, no auth.** Tags are story-scoped, not user-scoped, so a shared cache delivers the cost/persistence win without the auth and user-modeling rabbit hole. This was a conscious scope decision: auth adds no value to "help me grok HN."
- **Supabase client over an ORM.** For a single cache table, the Supabase JS client is the lightest tool that fits. In a larger codebase I'd reach for Drizzle (typed queries, migrations), but an ORM is overkill here.
- **"Chat" interpreted as natural-language search, not a chatbot.** The user's goal is finding relevant stories, so I built stateless NL→tags translation that reuses the filter pipeline, rather than a stateful conversation agent — more code, no extra value for this need.
- **Summarize from comments, not the article.** Costs a comment-tree fetch but captures what makes HN HN.
- **Naming wart:** the summarization route is `/api/tag` (a holdover from the prompt's phrasing). It summarizes despite the name; `/api/summarize` would be clearer. Left as-is and flagged here rather than silently renamed.

---

## How I used AI

Two distinct ways.

**As the product's engine.** OpenAI (`gpt-4o-mini`) does the topic classification, discussion summarization, and the natural-language→weighted-tags translation. I chose `gpt-4o-mini` for cost: classification and intent-parsing are cheap, structured tasks that don't need a frontier model, and the design (batching, caching, free domain pre-tagging) is built to minimize calls.

**As a coding assistant.** I used an AI assistant throughout to scaffold, pressure-test architecture decisions, and iterate on the UI. The decisions — cache design, the 10-tag taxonomy, the weighted-ranking approach, the temperature signal, the scope cuts — were mine; the assistant helped me move faster and sanity-check tradeoffs. I sampled real HN domain frequencies to ground the domain table rather than guessing.

---

## What I'd do with more time

- **Saved interest profiles.** The weighted-ranking math already exists per-query. Persisting a user's weights as a profile would let the feed self-rank on load with no typing — same scoring, stored per-user instead of per-query. (This is where auth would finally earn its place.)
- **Enrich weak-signal tagging** with linked-page metadata, as above.
- **Cache summaries** in Supabase alongside tags.
- **Pagination / infinite scroll** and a "load more" path through the existing `?page=` support.
- **A test suite**, starting with the pure scoring and tagging functions.
