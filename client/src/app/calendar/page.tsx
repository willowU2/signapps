"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy /calendar route - redirects to the new unified calendar UI at /cal.
 */
export default function CalendarPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/cal");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground">Redirection vers le calendrier...</p>
    </div>
  );
}
