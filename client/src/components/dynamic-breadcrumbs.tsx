"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard", mail: "Mail", calendar: "Calendrier", contacts: "Contacts",
  drive: "Drive", docs: "Documents", chat: "Chat", admin: "Administration",
  ai: "IA", analytics: "Analytics", apps: "Applications", forms: "Formulaires",
  tasks: "Taches", settings: "Parametres", backups: "Sauvegardes", meet: "Reunion",
};

export function DynamicBreadcrumbs() {
  const pathname = usePathname();
  if (!pathname || pathname === "/") return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4" aria-label="Breadcrumb">
      <Link href="/dashboard" className="hover:text-foreground transition-colors">Accueil</Link>
      {segments.map((seg, i) => {
        const href = "/" + segments.slice(0, i + 1).join("/");
        const label = LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
        const isLast = i === segments.length - 1;
        return (
          <span key={href} className="flex items-center gap-1.5">
            <span className="text-muted-foreground/50">/</span>
            {isLast ? <span className="text-foreground font-medium">{label}</span> : <Link href={href} className="hover:text-foreground transition-colors">{label}</Link>}
          </span>
        );
      })}
    </nav>
  );
}
