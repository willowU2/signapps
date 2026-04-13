"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      className={`transition-all duration-150 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-0.5"
      }`}
    >
      {children}
    </div>
  );
}
