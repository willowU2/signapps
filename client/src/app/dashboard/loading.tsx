import { AppLayout } from "@/components/layout/app-layout";
import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton-loader";

export default function DashboardLoading() {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <PageHeaderSkeleton />
        <CardGridSkeleton count={6} />
      </div>
    </AppLayout>
  );
}
