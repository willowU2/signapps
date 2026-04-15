"use client";

export interface ToolCallInfo {
  tool: string;
  parameters?: Record<string, unknown>;
  pending: boolean;
  success?: boolean;
  result?: string;
  error?: string;
}

interface ToolCallDisplayProps {
  toolCalls?: ToolCallInfo[];
  toolCall?: ToolCallInfo;
  compact?: boolean;
}

export function ToolCallDisplay({
  toolCalls,
  toolCall,
  compact,
}: ToolCallDisplayProps) {
  const items = toolCalls || (toolCall ? [toolCall] : []);
  if (!items.length) return null;

  return (
    <div className="space-y-1">
      {items.map((call, i) => (
        <div
          key={`${call.tool}-${i}`}
          className={`text-xs text-muted-foreground flex items-center gap-1 ${compact ? "" : ""}`}
        >
          <span
            className={
              call.error
                ? "text-red-500"
                : call.success
                  ? "text-green-500"
                  : "text-yellow-500"
            }
          >
            {call.pending
              ? "..."
              : call.success
                ? "\u2713"
                : call.error
                  ? "\u2717"
                  : "\u25CB"}
          </span>
          <span>{call.tool}</span>
        </div>
      ))}
    </div>
  );
}
