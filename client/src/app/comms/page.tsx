"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  Megaphone,
  Newspaper,
  Lightbulb,
  BarChart2,
  Mail,
  Monitor,
} from "lucide-react";

const subPages = [
  {
    href: "/comms/announcements",
    icon: Megaphone,
    label: "Annonces",
    color: "text-blue-500",
  },
  {
    href: "/comms/news-feed",
    icon: Newspaper,
    label: "Actualités",
    color: "text-green-500",
  },
  {
    href: "/comms/suggestions",
    icon: Lightbulb,
    label: "Suggestions",
    color: "text-yellow-500",
  },
  {
    href: "/comms/polls",
    icon: BarChart2,
    label: "Sondages",
    color: "text-purple-500",
  },
  {
    href: "/comms/newsletter",
    icon: Mail,
    label: "Newsletter",
    color: "text-pink-500",
  },
  {
    href: "/comms/digital-signage",
    icon: Monitor,
    label: "Affichage numérique",
    color: "text-orange-500",
  },
];

export default function CommsPage() {
  usePageTitle("Communication");
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Communication</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos communications internes et externes.
          </p>
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
                  <p className="text-sm text-muted-foreground">
                    Accéder à {label.toLowerCase()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
