"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import WhiteboardClient from "./whiteboard-client";

export default function WhiteboardPage() {
  usePageTitle("Tableau blanc");
  return <WhiteboardClient />;
}
