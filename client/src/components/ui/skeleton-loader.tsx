import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  count?: number;
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

export function CardGridSkeleton({ className, count = 6 }: SkeletonProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
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
