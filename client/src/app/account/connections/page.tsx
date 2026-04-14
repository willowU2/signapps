"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { ConnectionCard } from "@/components/account/ConnectionCard";
import {
  listConnections,
  disconnect,
  type AccountConnection,
} from "@/lib/api/account-connections";

export default function AccountConnectionsPage() {
  const [conns, setConns] = useState<AccountConnection[] | null>(null);

  const reload = () => {
    listConnections()
      .then(setConns)
      .catch((e) => {
        console.error("listConnections failed", e);
        setConns([]);
        toast.error("Impossible de charger vos connexions OAuth.");
      });
  };

  useEffect(reload, []);

  const handleDisconnect = async (sourceTable: string, id: string) => {
    try {
      await disconnect(sourceTable, id);
      toast.success("Connexion révoquée avec succès.");
      reload();
    } catch (e) {
      console.error("disconnect failed", e);
      toast.error("Échec de la déconnexion — veuillez réessayer.");
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Mes connexions
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Comptes externes connectés à votre profil. Reconnectez celles qui ont
          perdu l&apos;autorisation, ou déconnectez celles que vous
          n&apos;utilisez plus.
        </p>

        <div className="mt-6 space-y-2">
          {conns === null ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : conns.length === 0 ? (
            <p className="text-muted-foreground">
              Vous n&apos;avez aucune connexion OAuth active. Contactez votre
              admin pour activer un provider, ou rendez-vous sur la page mail /
              calendrier pour ajouter un compte.
            </p>
          ) : (
            conns.map((c) => (
              <ConnectionCard
                key={`${c.source_table}-${c.id}`}
                conn={c}
                onDisconnect={handleDisconnect}
              />
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
