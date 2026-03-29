import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function CRMLoading() {
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-9 w-48" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
        {/* Tabs */}
        <div className="flex gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-md" />
          ))}
        </div>
        {/* Kanban columns */}
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, col) => (
            <div key={col} className="flex-1 min-w-[200px] space-y-2">
              <Skeleton className="h-8 w-full rounded-lg" />
              {Array.from({ length: 3 - (col % 2) }).map((_, card) => (
                <Skeleton key={card} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
