import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function MeetLoading() {
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>

        {/* Quick join */}
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 max-w-sm rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>

        {/* Meeting cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex -space-x-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton
                    key={j}
                    className="h-7 w-7 rounded-full border-2 border-card"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
