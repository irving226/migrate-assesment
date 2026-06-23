import type { Story } from "@/lib/types";
import { TAG_META, SIGNAL_DOMAINS, timeAgo } from "@/lib/ui";
import { TemperatureGauge } from "./TemperatureGauge";

interface Props {
  story: Story;
  index: number;
  selected: boolean;
  onSelect: (id: number) => void;
}

export function StoryRow({ story, index, selected, onSelect }: Props) {
  const isSignal = story.domain ? SIGNAL_DOMAINS.has(story.domain) : false;
  return (
    <button
      className={`row${selected ? " sel" : ""}`}
      onClick={() => onSelect(story.id)}
      aria-pressed={selected}
    >
      <span className="rank mono">{String(index + 1).padStart(2, "0")}</span>
      <span className="rmain">
        <span className="rtitle">{story.title}</span>
        <span className="rmeta">
          <span className={`domain mono${isSignal ? " signal" : ""}`}>
            {story.domain ?? "self.hn"}
          </span>
          <span className="domain mono" style={{ color: "var(--dim-2)" }}>
            · {story.by} · {timeAgo(story.time)}
          </span>
        </span>
        <span className="rtags">
          {story.tags.map((tg) => {
            const meta = TAG_META[tg];
            if (!meta) return null;
            return (
              <span
                key={tg}
                className="tag"
                style={{ color: `var(${meta.cssVar})` }}
              >
                {meta.label}
              </span>
            );
          })}
        </span>
        <TemperatureGauge score={story.score} comments={story.descendants} />
      </span>
      <span className="rstat">
        <span className="n">{story.score}</span>
        <span className="lbl">pts</span>
        <span className="n" style={{ marginTop: 6, display: "block" }}>
          {story.descendants}
        </span>
        <span className="lbl">cmts</span>
      </span>
    </button>
  );
}
