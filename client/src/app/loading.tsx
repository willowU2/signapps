export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-primary">
          <span className="text-3xl font-bold text-primary-foreground">S</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
            role="status"
            aria-label="Chargement"
          />
          <span>Chargement...</span>
        </div>
      </div>
    </div>
  );
}
