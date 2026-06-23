// -- story_tags: a SHARED, story-scoped cache of AI-derived tags.
// --
// -- The central design decision: tags belong to a STORY, not to a user.
// -- Story 8863 is "ai_ml" for everyone, forever. So we key purely by HN item id
// -- and any visitor benefits from a tag another visitor already paid OpenAI for.
// -- No auth, no per-user rows, no RLS-by-owner — just a public read cache that
// -- the server writes to on a miss.
// --
// -- This is the whole persistence story. It exists to avoid re-paying the LLM
// -- for work already done, NOT to track sessions or identity.

// create table if not exists story_tags (
//   -- HN item id IS the primary key. One row per story, period.
//   story_id      bigint primary key,

//   -- The story metadata we tagged from, kept for debugging / re-tagging.
//   title         text not null,
//   domain        text,

//   -- The derived tags. text[] keeps filtering trivial with the && (overlap)
//   -- and @> (contains) array operators — "stories tagged ai_ml OR paper" is
//   -- one indexed query.
//   tags          text[] not null default '{}',

//   -- How the tags were produced: 'domain' (free, no LLM) or 'llm'. Lets us
//   -- distinguish cheap heuristic tags from model tags, and re-tag the former
//   -- later if we want higher quality.
//   source        text not null default 'llm',

//   -- Cache bookkeeping.
//   model         text,                              -- e.g. 'gpt-4o-mini'
//   created_at    timestamptz not null default now(),
//   updated_at    timestamptz not null default now()
// );

// -- GIN index on the tags array so chip filtering (tags && '{ai_ml,paper}')
// -- stays fast as the cache grows.
// create index if not exists story_tags_tags_idx
//   on story_tags using gin (tags);

// -- Keep updated_at honest on re-tag.
// create or replace function touch_story_tags()
// returns trigger as $$
// begin
//   new.updated_at = now();
//   return new;
// end;
// $$ language plpgsql;

// drop trigger if exists story_tags_touch on story_tags;
// create trigger story_tags_touch
//   before update on story_tags
//   for each row execute function touch_story_tags();

// -- RLS: reads are public (the cache is not sensitive). Writes happen only from
// -- the server using the service-role key, which bypasses RLS — so we enable RLS
// -- and add a read-only policy for the anon key. Belt and suspenders.
// alter table story_tags enable row level security;

// drop policy if exists story_tags_public_read on story_tags;
// create policy story_tags_public_read
//   on story_tags for select
//   using (true);