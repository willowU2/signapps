"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  Map, Package, ShoppingCart, Truck, AlertTriangle, Users, BarChart2,
} from "lucide-react";

const subPages = [
  { href: "/supply-chain/warehouse-map",       icon: Map,          label: "Carte entrepôt",         color: "text-blue-500" },
  { href: "/supply-chain/inventory",           icon: Package,      label: "Inventaire",             color: "text-green-500" },
  { href: "/supply-chain/purchase-orders",     icon: ShoppingCart, label: "Bons de commande",       color: "text-yellow-500" },
  { href: "/supply-chain/receiving-shipping",  icon: Truck,        label: "Réception / Expédition", color: "text-orange-500" },
  { href: "/supply-chain/stock-alerts",        icon: AlertTriangle,label: "Alertes stock",          color: "text-red-500" },
  { href: "/supply-chain/supplier-portal",     icon: Users,        label: "Portail fournisseurs",   color: "text-purple-500" },
  { href: "/supply-chain/delivery-tracking",   icon: BarChart2,    label: "Suivi livraisons",       color: "text-teal-500" },
];

export default function SupplyChainPage() {
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chaîne d&apos;approvisionnement</h1>
          <p className="text-muted-foreground mt-1">Gérez vos stocks, commandes et livraisons.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subPages.map(({ href, icon: Icon, label, color }) => (
            <Link key={href} href={href}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md hover:border-primary/50">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                  <Icon className={`h-6 w-6 ${color}`} />
                  <CardTitle className="text-base">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Accéder à {label.toLowerCase()}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
