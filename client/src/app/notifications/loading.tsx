import { AppLayout } from "@/components/layout/app-layout";
import { ListSkeleton } from "@/components/ui/skeleton-loader";

export default function NotificationsLoading() {
  return (
    <AppLayout>
      <div className="p-6">
        <ListSkeleton count={10} />
      </div>
    </AppLayout>
  );
}
