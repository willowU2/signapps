import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function KeepLoading() {
  return (
    <AppLayout>
      <div className="space-y-5 p-6">
        {/* Header + search */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-28" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>

        {/* Quick input */}
        <Skeleton className="h-12 w-full max-w-2xl mx-auto rounded-xl" />

        {/* Filter tabs */}
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>

        {/* Pinned section */}
        <Skeleton className="h-4 w-16" />
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="break-inside-avoid rounded-xl border bg-card p-3 space-y-2"
              style={{ minHeight: `${100 + (i % 3) * 40}px` }}
            >
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              {i % 2 === 0 && <Skeleton className="h-3 w-1/2" />}
              <div className="flex gap-1 pt-1">
                <Skeleton className="h-5 w-12 rounded-full" />
                {i % 3 === 0 && <Skeleton className="h-5 w-14 rounded-full" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
