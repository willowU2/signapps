import { Skeleton } from "@/components/ui/skeleton";

export default function MailLoading() {
  return (
    <div className="flex h-screen bg-muted dark:bg-[#111111]">
      {/* Sidebar skeleton */}
      <div className="w-[256px] shrink-0 flex flex-col gap-3 p-4">
        <Skeleton className="h-14 w-36 rounded-2xl" />
        <Skeleton className="h-9 w-28" />
        <div className="flex flex-col gap-1 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-r-full" />
          ))}
        </div>
      </div>
      {/* List skeleton */}
      <div className="flex-1 flex flex-col rounded-3xl bg-background m-2 ml-0 overflow-hidden shadow-lg">
        <div className="px-4 py-2 border-b">
          <Skeleton className="h-9 w-full rounded-full" />
        </div>
        <div className="flex-1 flex flex-col gap-2 p-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg border border-border/40"
            >
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
              <Skeleton className="h-3 w-10 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
