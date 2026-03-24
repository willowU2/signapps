export function AppVersion() {
  return (
    <span className="text-[10px] text-muted-foreground/50 font-mono">
      SignApps v0.1.0 | {process.env.NODE_ENV}
    </span>
  );
}
