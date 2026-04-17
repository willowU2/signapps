/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Map, Plus, Settings2, Trash2, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  useFloorPlans,
  useDeleteFloorPlan,
} from "@/lib/scheduling/api/resources";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePageTitle } from "@/hooks/use-page-title";

export default function AdminFloorPlans() {
  usePageTitle("Plans");
  const { data: floorPlans = [], isLoading } = useFloorPlans();
  const deletePlan = useDeleteFloorPlan();
  const router = useRouter();
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        <PageHeader
          title="FloorPlan Builder"
          description="Gérer les cartes interactives des locaux de l'entreprise."
          icon={<Map className="h-5 w-5 text-primary" />}
          actions={
            <Button
              onClick={() => router.push("/admin/floorplans/new")}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouveau Plan
            </Button>
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground animate-pulse">
            Chargement des plans...
          </div>
        ) : floorPlans.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed bg-muted/30">
            <Map className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-1">Aucun plan configuré</h3>
            <p className="text-muted-foreground text-sm max-w-[400px] mb-6">
              Vous n'avez pas encore d'espace cartographié. Ajoutez un plan SVG
              pour commencer à rendre vos réservations interactives.
            </p>
            <Button
              onClick={() => router.push("/admin/floorplans/new")}
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Importer un premier plan
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {floorPlans.map((plan) => (
              <Card
                key={plan.id}
                className="overflow-hidden flex flex-col hover:border-blue-200 transition-colors group"
              >
                <div className="h-32 bg-muted/50 border-b flex items-center justify-center relative overflow-hidden">
                  {plan.svgContent ? (
                    <img
                      src={
                        plan.svgContent.startsWith("<svg")
                          ? `data:image/svg+xml;utf8,${encodeURIComponent(plan.svgContent)}`
                          : plan.svgContent
                      }
                      alt={plan.name}
                      className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <Map className="w-10 h-10 text-muted-foreground opacity-30" />
                  )}
                  <div className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">
                    Étage {plan.floor}
                  </div>
                </div>
                <CardHeader className="pb-2 flex-grow">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground truncate">
                    {plan.description || "Aucune description"}
                  </p>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-sm">
                      {plan.resources.length} Hitbox
                      {plan.resources.length > 1 ? "s" : ""}
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 flex items-center gap-2 border-t bg-muted/20 p-3">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 gap-2 shadow-none"
                    onClick={() => router.push(`/admin/floorplans/${plan.id}`)}
                  >
                    <Settings2 className="w-4 h-4" />
                    Éditer le Layout
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeletePlanId(plan.id)}
                    disabled={deletePlan.isPending}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={!!deletePlanId}
        onOpenChange={() => setDeletePlanId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce plan ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletePlanId) {
                  deletePlan.mutate(deletePlanId, {
                    onSuccess: () => toast.success("Plan supprime"),
                    onError: (e) =>
                      toast.error(
                        "Erreur: " + (e instanceof Error ? e.message : "Echec"),
                      ),
                  });
                  setDeletePlanId(null);
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
