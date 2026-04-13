import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-8rem)] gap-0 overflow-hidden rounded-2xl border">
        {/* Channel sidebar */}
        <div className="w-64 shrink-0 border-r p-3 space-y-3">
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 p-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
          <Skeleton className="h-px w-full" />
          <div className="space-y-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 p-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-2 w-2 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        {/* Message area */}
        <div className="flex-1 flex flex-col">
          <div className="border-b px-4 py-3 flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="flex-1 p-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`flex gap-3 ${i % 3 === 1 ? "justify-end" : ""}`}
              >
                {i % 3 !== 1 && (
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                )}
                <div className="space-y-1.5 max-w-[60%]">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
          <div className="border-t p-3">
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
