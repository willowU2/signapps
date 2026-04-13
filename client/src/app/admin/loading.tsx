import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-8 w-52" />
        </div>

        {/* Stats row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>

        {/* Content sections */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
