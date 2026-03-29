import { AppLayout } from "@/components/layout/app-layout";
import { ListSkeleton } from "@/components/ui/skeleton-loader";

export default function SearchLoading() {
  return (
    <AppLayout>
      <div className="p-6">
        <ListSkeleton count={8} />
      </div>
    </AppLayout>
  );
}
