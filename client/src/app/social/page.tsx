"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { SocialDashboard } from "@/components/social/social-dashboard";

export default function SocialPage() {
  usePageTitle("Social");
  return <SocialDashboard />;
}
