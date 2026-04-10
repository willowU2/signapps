"use client";
import { AppLayout } from "@/components/layout/app-layout";

export default function SupplierPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout portalMode="supplier">{children}</AppLayout>;
}
