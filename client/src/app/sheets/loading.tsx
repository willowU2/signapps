import { AppLayout } from "@/components/layout/app-layout";
import { DataTableSkeleton } from "@/components/ui/skeleton-loader";

export default function SheetsLoading() {
  return (
    <AppLayout>
      <div className="p-6">
        <DataTableSkeleton count={10} />
      </div>
    </AppLayout>
  );
}
