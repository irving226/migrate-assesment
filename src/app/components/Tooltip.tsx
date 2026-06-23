import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";

export function Tooltip({
  children,
  content,
  delayDuration = 200,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  delayDuration?: number;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={4}
            style={{
              backgroundColor: "var(--bg-elevated, #222)",
              color: "var(--fg, #eee)",
              padding: "6px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              fontFamily: "var(--mono)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              zIndex: 50,
              maxWidth: "250px",
              lineHeight: "1.4",
              animation: "fade-in 0.15s ease-out",
            }}
          >
            {content}
            <TooltipPrimitive.Arrow
              width={11}
              height={5}
              style={{ fill: "var(--bg-elevated, #222)" }}
            />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
