import { AppLayout } from "@/components/layout/app-layout";
import { CardGridSkeleton } from "@/components/ui/skeleton-loader";

export default function KeepLoading() {
  return (
    <AppLayout>
      <div className="p-6">
        <CardGridSkeleton count={8} />
      </div>
    </AppLayout>
  );
}
