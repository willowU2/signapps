"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/forms");
  }, [router]);
  return null;
}
