import { AppLayout } from "@/components/layout/app-layout";
import { CardGridSkeleton } from "@/components/ui/skeleton-loader";

export default function MonitoringLoading() {
  return (
    <AppLayout>
      <div className="p-6">
        <CardGridSkeleton count={6} />
      </div>
    </AppLayout>
  );
}
