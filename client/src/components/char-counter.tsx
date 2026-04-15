"use client";

export function CharCounter({
  current,
  max,
}: {
  current: number;
  max: number;
}) {
  const remaining = max - current;
  return (
    <span
      className={`text-xs tabular-nums ${remaining < 0 ? "text-red-500 font-medium" : remaining < max * 0.1 ? "text-yellow-500" : "text-muted-foreground"}`}
    >
      {current}/{max}
    </span>
  );
}
