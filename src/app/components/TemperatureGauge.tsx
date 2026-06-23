import { tempColor, temperature, tempLabel } from "@/lib/ui";
import { Tooltip } from "./Tooltip";

export function TemperatureGauge({
  score,
  comments,
}: {
  score: number;
  comments: number;
}) {
  const t = temperature(score, comments);
  const color = tempColor(t);

  const tooltipContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <strong>Discussion Heat: {tempLabel(t)}</strong>
      <span style={{ opacity: 0.8 }}>
        A high ratio of comments compared to upvotes usually means the topic is
        highly debated or contentious.
      </span>
    </div>
  );

  return (
    <Tooltip content={tooltipContent}>
      <div className="temp">
        <div className="temp-track">
          <div
            className="temp-fill"
            style={{ width: `${Math.round(t * 100)}%`, background: color }}
          />
        </div>
        <span className="temp-lbl" style={{ color }}>
          {tempLabel(t)}
        </span>
      </div>
    </Tooltip>
  );
}
