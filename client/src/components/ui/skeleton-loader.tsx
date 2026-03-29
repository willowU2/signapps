import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  count?: number;
}

// COH-068 — Skeleton presets

/** TableSkeleton: full table with header + rows */
export function TableSkeleton({ className, count = 5 }: SkeletonProps) {
  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex gap-4 border-b pb-2 mb-1">
        {[40, 25, 20, 15].map((w, i) => (
          <Skeleton key={i} className={`h-4 w-[${w}%]`} />
        ))}
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          {[40, 25, 20, 15].map((w, j) => (
            <Skeleton key={j} className={`h-4 w-[${w}%]`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** CardGridSkeleton: grid of card placeholders */
export function CardGridSkeleton({ className, count = 6 }: SkeletonProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-8 w-1/3 mt-2" />
        </div>
      ))}
    </div>
  );
}

/** ListSkeleton: vertical list of rows */
export function ListSkeleton({ className, count = 6 }: SkeletonProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="h-6 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function DataTableSkeleton({ className, count = 5 }: SkeletonProps) {
  return (
    <div className={cn("w-full space-y-3", className)}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-10 w-[250px]" />
        <Skeleton className="h-10 w-[100px]" />
      </div>
      <div className="rounded-xl border bg-card/40 backdrop-blur-md overflow-hidden">
        <div className="border-b bg-muted/30 p-4">
          <Skeleton className="h-6 w-full" />
        </div>
        <div className="p-4 space-y-4">
          {Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PageHeaderSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-2 mb-8", className)}>
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-4 w-1/4" />
    </div>
  );
}

export function SidebarSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("w-full space-y-4 p-4", className)}>
      <Skeleton className="h-8 w-full mb-6" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
