"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LmsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/lms/catalog");
  }, [router]);
  return null;
}
