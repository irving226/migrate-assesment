// The signature element. Shows discussion contention at a glance: a slim bar

import { tempColor, temperature, tempLabel } from "@/lib/ui";

// that fills and warms as a thread gets more contentious relative to its score.
export function TemperatureGauge({
  score,
  comments,
}: {
  score: number;
  comments: number;
}) {
  const t = temperature(score, comments);
  const color = tempColor(t);
  return (
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
  );
}
