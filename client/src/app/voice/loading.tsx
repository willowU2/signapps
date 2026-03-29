import { AppLayout } from "@/components/layout/app-layout";
import { CardGridSkeleton } from "@/components/ui/skeleton-loader";

export default function VoiceLoading() {
  return (
    <AppLayout>
      <div className="p-6">
        <CardGridSkeleton count={4} />
      </div>
    </AppLayout>
  );
}
