import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function AiLoading() {
  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border">
        {/* Conversation sidebar */}
        <div className="w-64 shrink-0 border-r p-3 space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="space-y-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <div className="border-b px-4 py-3">
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-4 max-w-md">
              <Skeleton className="h-16 w-16 rounded-2xl mx-auto" />
              <Skeleton className="h-6 w-48 mx-auto" />
              <Skeleton className="h-4 w-64 mx-auto" />
              <div className="grid grid-cols-2 gap-2 pt-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
          <div className="border-t p-4">
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
