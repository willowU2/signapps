"use client";
import { SpinnerInfinity } from "spinners-react";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { usePageTitle } from "@/hooks/use-page-title";

export default function Home() {
  usePageTitle("Accueil");
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-2">
        <SpinnerInfinity
          size={32}
          secondaryColor="rgba(128,128,128,0.2)"
          color="currentColor"
          speed={120}
        />
        <span>Chargement...</span>
      </div>
    </div>
  );
}
