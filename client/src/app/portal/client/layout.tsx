"use client";
import { AppLayout } from "@/components/layout/app-layout";

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout portalMode="client">{children}</AppLayout>;
}
