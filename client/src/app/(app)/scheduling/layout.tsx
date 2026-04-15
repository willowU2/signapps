"use client";

import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/app-layout";

export default function SchedulingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout>
      <TooltipProvider>{children}</TooltipProvider>
    </AppLayout>
  );
}
