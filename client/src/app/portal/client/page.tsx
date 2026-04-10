"use client";

import Link from "next/link";
import {
  FileText,
  Ticket,
  FolderOpen,
  ClipboardList,
  MessageSquare,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

const cards = [
  {
    href: "/portal/client/invoices",
    icon: FileText,
    label: "Factures",
    description: "Consultez et téléchargez vos factures",
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    href: "/portal/client/tickets",
    icon: Ticket,
    label: "Tickets",
    description: "Suivez vos demandes de support",
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
  },
  {
    href: "/storage",
    icon: FolderOpen,
    label: "Documents",
    description: "Accédez à vos documents partagés",
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
  {
    href: "/portal/client/forms",
    icon: ClipboardList,
    label: "Formulaires",
    description: "Remplissez vos formulaires en ligne",
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-900/20",
  },
  {
    href: "/mail",
    icon: MessageSquare,
    label: "Messages",
    description: "Communiquez avec nos équipes",
    color: "text-rose-500",
    bg: "bg-rose-50 dark:bg-rose-900/20",
  },
];

export default function ClientPortalPage() {
  usePageTitle("Portail Client");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portail Client</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenue sur votre espace client. Accédez à vos services en un clic.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5"
            >
              <div className={`w-fit rounded-lg p-2.5 ${card.bg}`}>
                <Icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <div>
                <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {card.label}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {card.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
