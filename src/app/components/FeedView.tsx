"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Story, StoryType, Tag } from "@/lib/types";
import { rankStories, type Weights } from "@/lib/scoring";
import { TAG_META } from "@/lib/ui";
import { fetchStories, fetchWeights } from "@/lib/api";
import { StoryRow } from "./StoryRow";
import { StoryDetail } from "./StoryDetail";
import { Tooltip } from "./Tooltip";

const FEEDS: StoryType[] = ["top", "new", "best", "ask", "show"];

const FEED_TOOLTIPS: Partial<Record<StoryType, string>> = {
  ask: "Ask HN: Text posts asking the community questions",
  show: "Show HN: Builders sharing their own projects/launches",
};

export function FeedView() {
  const [feed, setFeed] = useState<StoryType>("top");
  const [activeTags, setActiveTags] = useState<Set<Tag>>(new Set());
  const [weights, setWeights] = useState<Weights | null>(null);
  const [explanation, setExplanation] = useState<string>("");
  const [selected, setSelected] = useState<number | null>(null);
  const [queryText, setQueryText] = useState("");

  const stories = useQuery({
    queryKey: ["stories", feed],
    queryFn: () => fetchStories(feed),
    staleTime: 60 * 1000,
  });

  const search = useMutation({
    mutationFn: (q: string) => fetchWeights(q),
    onSuccess: (data) => {
      setWeights(Object.keys(data.weights).length ? data.weights : null);
      setExplanation(data.explanation);
    },
  });

  const visible = useMemo(() => {
    let rows = stories.data ?? [];
    if (activeTags.size) {
      rows = rows.filter((s) => s.tags.some((t) => activeTags.has(t)));
    }
    if (weights) rows = rankStories(rows, weights);
    return rows;
  }, [stories.data, activeTags, weights]);

  const toggleTag = (t: Tag) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };

  const clearAll = () => {
    setActiveTags(new Set());
    setWeights(null);
    setExplanation("");
    setQueryText("");
  };

  const selectedStory =
    selected != null ? visible.find((s) => s.id === selected) ?? null : null;
  const hasDetail = selectedStory != null;

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="mark">
            <b>grok</b>·hn
          </span>
          <span className="sub">signal reader</span>
        </div>

        <div className="feeds">
          {FEEDS.map((f) => {
            const btn = (
              <button
                key={f}
                className={`feed-btn${feed === f ? " on" : ""}`}
                onClick={() => setFeed(f)}
              >
                {f}
              </button>
            );

            return FEED_TOOLTIPS[f] ? (
              <Tooltip key={f} content={FEED_TOOLTIPS[f]}>
                {btn}
              </Tooltip>
            ) : (
              btn
            );
          })}
        </div>

        <Tooltip content="Type a natural language query to rank stories">
          <div className="search-wrap">
            <span className="si mono">{search.isPending ? "⏳" : "⌕"}</span>
            <input
              className="nl"
              placeholder={
                search.isPending
                  ? "analyzing intent and ranking..."
                  : "describe what you want — e.g. ai papers, nothing about funding"
              }
              value={queryText}
              disabled={search.isPending}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && queryText.trim())
                  search.mutate(queryText.trim());
              }}
            />
          </div>
        </Tooltip>
      </header>

      <div className="filterbar">
        <span className="fb-label">topics</span>
        {(Object.keys(TAG_META) as Tag[]).map((tag) => {
          const on = activeTags.has(tag);
          const color = `var(${TAG_META[tag].cssVar})`;
          return (
            <button
              key={tag}
              className={`chip${on ? " on" : ""}`}
              onClick={() => toggleTag(tag)}
              style={
                on
                  ? {
                      background: `color-mix(in srgb, ${color} 14%, transparent)`,
                      color,
                      borderColor: `color-mix(in srgb, ${color} 34%, transparent)`,
                    }
                  : undefined
              }
            >
              {TAG_META[tag].label}
            </button>
          );
        })}
        {(activeTags.size > 0 || weights) && (
          <button className="clear-btn" onClick={clearAll}>
            clear
          </button>
        )}
        {weights && explanation && (
          <div className="nl-readout">
            <b>ranking</b> → {explanation}
          </div>
        )}
      </div>

      <div className="panes">
        <div className={`list${hasDetail ? " has-detail" : ""}`}>
          {stories.isLoading && (
            <div className="state mono">loading {feed} stories…</div>
          )}
          {stories.isError && (
            <div className="state err mono">
              couldn&apos;t reach the feed — is the server running?
            </div>
          )}
          {stories.data && visible.length === 0 && (
            <div className="state">
              No stories match these filters.
              <span className="mono">loosen a topic or clear the search</span>
            </div>
          )}
          {visible.map((s: Story, i: number) => (
            <StoryRow
              key={s.id}
              story={s}
              index={i}
              selected={selected === s.id}
              onSelect={setSelected}
            />
          ))}
        </div>
        {selectedStory && (
          <StoryDetail
            story={selectedStory}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}
