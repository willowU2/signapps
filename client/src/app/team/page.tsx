"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TeamPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/team/org-chart");
  }, [router]);
  return null;
}
