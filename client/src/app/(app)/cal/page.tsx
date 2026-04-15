"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { CalendarHub } from "@/components/calendar/CalendarHub";

export default function CalendarPage() {
  usePageTitle("Calendrier");
  return <CalendarHub />;
}
