"use client";

import { useQuery } from "@tanstack/react-query";
import { listVersions, listHistory } from "@/lib/api/deploy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function VersionsPage() {
  const versions = useQuery({
    queryKey: ["deploy", "versions"],
    queryFn: listVersions,
  });
  const history = useQuery({
    queryKey: ["deploy", "history"],
    queryFn: () => listHistory(undefined, 50),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Versions distinctes</CardTitle>
        </CardHeader>
        <CardContent>
          {versions.isLoading && <p>Chargement…</p>}
          {!versions.isLoading && (versions.data?.length ?? 0) === 0 && (
            <p className="text-muted-foreground">
              Aucune version déployée pour le moment.
            </p>
          )}
          {versions.data && versions.data.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Dernier déploiement</TableHead>
                  <TableHead>Environnements</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.data.map((v) => (
                  <TableRow key={v.version}>
                    <TableCell className="font-mono">{v.version}</TableCell>
                    <TableCell>
                      {new Date(v.last_deployed_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {v.envs.map((env) => (
                        <Badge key={env} variant="secondary" className="mr-1">
                          {env}
                        </Badge>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent>
          {history.isLoading && <p>Chargement…</p>}
          {!history.isLoading && (history.data?.length ?? 0) === 0 && (
            <p className="text-muted-foreground">
              Aucun déploiement dans l&apos;historique.
            </p>
          )}
          {history.data && history.data.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Env</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Durée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      {new Date(d.triggered_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{d.env}</TableCell>
                    <TableCell className="font-mono">{d.version}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          d.status === "success"
                            ? "default"
                            : d.status === "failed" ||
                                d.status === "rolled_back"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {d.duration_seconds ? `${d.duration_seconds}s` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
