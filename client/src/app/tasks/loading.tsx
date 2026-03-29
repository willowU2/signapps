import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-8rem)] w-full p-4 md:p-6 lg:p-8">
        <div className="w-full bg-card/40 backdrop-blur-3xl border border-border/50 rounded-[2rem] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-7 w-40" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
          {/* Task list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/40">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 flex-1" style={{ maxWidth: `${50 + (i % 5) * 10}%` }} />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
