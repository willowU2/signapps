"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/app-layout";

const tabs = [
  { href: "/admin/deploy", label: "Environnements" },
  { href: "/admin/deploy/versions", label: "Versions" },
  { href: "/admin/deploy/feature-flags", label: "Feature Flags" },
  { href: "/admin/deploy/maintenance", label: "Maintenance" },
  { href: "/admin/deploy/runtime-config", label: "Runtime Config" },
  { href: "/admin/deploy/on-premise", label: "On-premise" },
];

export default function DeployLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Déploiement</h1>
          <p className="text-muted-foreground">
            Gestion des environnements prod/dev, versions, feature flags et
            maintenances.
          </p>
        </div>

        <nav
          aria-label="Onglets déploiement"
          className="border-b border-border"
        >
          <ul className="flex gap-1">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    className={cn(
                      "inline-block rounded-t-md px-4 py-2 text-sm transition-colors",
                      active
                        ? "bg-card text-foreground border-b-2 border-primary font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div>{children}</div>
      </div>
    </AppLayout>
  );
}
