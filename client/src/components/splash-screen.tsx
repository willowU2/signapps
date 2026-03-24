export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      <div className="text-center space-y-4 animate-pulse">
        <div className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
          SignApps
        </div>
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    </div>
  );
}
