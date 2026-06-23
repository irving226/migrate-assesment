"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import type { Story } from "@/lib/types";
import { fetchComments, fetchSummary } from "@/lib/api";
import { tempColor, temperature, tempLabel, timeAgo } from "@/lib/ui";
import { Tooltip } from "./Tooltip";

function htmlToText(html: string): string {
  if (typeof document === "undefined") return html;
  const el = document.createElement("div");
  el.innerHTML = html.replace(/<p>/gi, "\n");
  return el.textContent ?? "";
}

export function StoryDetail({
  story,
  onClose,
}: {
  story: Story;
  onClose: () => void;
}) {
  const t = temperature(story.score, story.descendants);
  const heat = tempColor(t);

  const comments = useQuery({
    queryKey: ["comments", story.id],
    queryFn: () => fetchComments(story.id),
    staleTime: 5 * 60 * 1000,
  });

  const summary = useMutation({
    mutationFn: () => fetchSummary(story.id),
  });

  const kicker =
    story.type === "story" && !story.url
      ? "ask hn"
      : story.tags.includes("show_hn_launch")
      ? "show hn"
      : "story";

  const kickerTooltip =
    kicker === "ask hn"
      ? "Community Q&A / Text Post"
      : kicker === "show hn"
      ? "A project built by the community"
      : null;

  return (
    <div className="detail">
      <div className="dt-inner">
        <button
          className="dt-close"
          onClick={onClose}
          aria-label="Close detail"
        >
          ✕
        </button>

        {kickerTooltip ? (
          <Tooltip content={kickerTooltip}>
            <div className="dt-kicker" style={{ cursor: "help" }}>
              {kicker}
            </div>
          </Tooltip>
        ) : (
          <div className="dt-kicker">{kicker}</div>
        )}

        <h2 className="dt-title">{story.title}</h2>

        <div className="dt-meta">
          <span>
            <b>{story.score}</b> points
          </span>
          <span>
            <b>{story.descendants}</b> comments
          </span>
          <span>
            by <b>{story.by}</b>
          </span>
          <span>{timeAgo(story.time)} ago</span>

          <Tooltip content="Heat indicates how intensely this post is being debated based on the comment-to-points ratio.">
            <span style={{ color: heat, cursor: "help" }}>
              ● {tempLabel(t)} thread
            </span>
          </Tooltip>
        </div>

        {story.url && (
          <a
            className="dt-link"
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {story.domain} ↗
          </a>
        )}

        <div className="summary-card">
          <div className="sc-head">
            <span className="dot" /> ai discussion summary
          </div>
          <div className={`sc-body${summary.isPending ? " loading" : ""}`}>
            {summary.isPending ? (
              "reading the thread…"
            ) : summary.isError ? (
              "Couldn't generate a summary. Try again."
            ) : summary.data ? (
              summary.data.summary
            ) : (
              <Tooltip content="Use AI to read all comments and generate a brief recap">
                <button className="gen-btn" onClick={() => summary.mutate()}>
                  ✦ generate summary
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--dim)",
            margin: "20px 0 4px",
          }}
        >
          top comments
        </div>
        {comments.isLoading && (
          <div className="state mono">loading comments…</div>
        )}
        {comments.isError && (
          <div className="state err mono">couldn&apos;t load comments</div>
        )}
        {comments.data?.length === 0 && (
          <div className="state mono">no comments yet</div>
        )}
        {comments.data?.map((c) => (
          <div key={c.id} className="comment">
            <div className="cm-by mono">
              <b>{c.by}</b>
            </div>
            <div className="cm-text">{htmlToText(c.text)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
