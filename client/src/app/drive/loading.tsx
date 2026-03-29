import { AppLayout } from "@/components/layout/app-layout";
import { DataTableSkeleton } from "@/components/ui/skeleton-loader";

export default function DriveLoading() {
  return (
    <AppLayout>
      <div className="p-6">
        <DataTableSkeleton count={8} />
      </div>
    </AppLayout>
  );
}
