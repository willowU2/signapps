"use client";

import { Users, Server } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useMyTeam } from "@/hooks/use-my-team";
import { TeamToday } from "@/components/team/team-today";
import { TeamDirectory } from "@/components/team/team-directory";
import { TeamIndicators } from "@/components/team/team-indicators";
import { TeamInfrastructure } from "@/components/team/team-infrastructure";

export default function MyTeamPage() {
  usePageTitle("Mon équipe");
  const { data, isLoading } = useMyTeam();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Aucun rapport direct</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Vous n&apos;avez pas de collaborateurs directs dans votre équipe pour
          le moment.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Mon équipe</h1>
        <Badge variant="secondary" className="text-sm">
          {data.total} membre{data.total !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="today" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="today">Aujourd&apos;hui</TabsTrigger>
          <TabsTrigger value="team">Équipe</TabsTrigger>
          <TabsTrigger value="indicators">Indicateurs</TabsTrigger>
          <TabsTrigger value="infrastructure">
            <Server className="h-4 w-4 mr-1.5" />
            Infrastructure
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <TeamToday />
        </TabsContent>

        <TabsContent value="team">
          <TeamDirectory members={data.members} />
        </TabsContent>

        <TabsContent value="indicators">
          <TeamIndicators />
        </TabsContent>

        <TabsContent value="infrastructure">
          <TeamInfrastructure />
        </TabsContent>
      </Tabs>
    </div>
  );
}
