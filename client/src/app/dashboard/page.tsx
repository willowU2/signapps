import { fetchDashboardData } from "@/lib/server/dashboard";
import { DashboardClient } from "./dashboard-client";

/**
 * Dashboard page — React Server Component.
 *
 * Prefetches the aggregated summary and layout from the identity service
 * on the server so the first HTML chunk already carries real numbers.
 * The client shell (`DashboardClient`) seeds the TanStack cache with the
 * prefetched data and takes over interactivity after hydration.
 */
export default async function DashboardPage() {
  const initialData = await fetchDashboardData();
  return <DashboardClient initialData={initialData} />;
}
