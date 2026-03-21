import { SpinnerInfinity } from 'spinners-react';


export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-primary">
          <span className="text-3xl font-bold text-primary-foreground">S</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-5 w-5 " />
          <span>Loading...</span>
        </div>
      </div>
    </div>
  );
}
