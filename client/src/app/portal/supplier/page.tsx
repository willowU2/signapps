"use client";

import Link from "next/link";
import {
  ShoppingCart,
  FileText,
  BookOpen,
  FolderOpen,
  Truck,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

const cards = [
  {
    href: "/portal/supplier/orders",
    icon: ShoppingCart,
    label: "Commandes",
    description: "Gérez les commandes reçues",
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    href: "/portal/supplier/invoices",
    icon: FileText,
    label: "Factures",
    description: "Émettez et suivez vos factures",
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
  },
  {
    href: "/portal/supplier/catalog",
    icon: BookOpen,
    label: "Catalogue",
    description: "Gérez votre catalogue produits",
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
  {
    href: "/storage",
    icon: FolderOpen,
    label: "Documents",
    description: "Accédez à vos documents partagés",
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-900/20",
  },
  {
    href: "/portal/supplier/deliveries",
    icon: Truck,
    label: "Livraisons",
    description: "Suivez vos livraisons en cours",
    color: "text-orange-500",
    bg: "bg-orange-50 dark:bg-orange-900/20",
  },
];

export default function SupplierPortalPage() {
  usePageTitle("Portail Fournisseur");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Portail Fournisseur
        </h1>
        <p className="text-muted-foreground mt-1">
          Bienvenue sur votre espace fournisseur. Gérez vos activités en un
          clic.
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
