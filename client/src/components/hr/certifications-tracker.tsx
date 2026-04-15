"use client";

/**
 * Certifications Tracker Component
 *
 * Table displaying employee certifications with status tracking.
 * Shows: name, certification, obtained date, expiry date, status (color-coded),
 * days remaining, and alert icon if <90 days to expiry.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AlertCircle, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

export interface CertificationRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  certificationName: string;
  obtainedDate: Date;
  expiryDate: Date;
}

export interface CertificationsTrackerProps {
  certifications: CertificationRecord[];
  onAddCertification?: (data: Omit<CertificationRecord, "id">) => void;
  className?: string;
}

const certificationSchema = z.object({
  employeeName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  certificationName: z
    .string()
    .min(2, "Le nom de certification doit contenir au moins 2 caractères"),
  obtainedDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), "Date invalide"),
  expiryDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), "Date invalide"),
});

type CertificationFormValues = z.infer<typeof certificationSchema>;

function calculateDaysRemaining(expiryDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diff = expiry.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getStatusBadge(daysRemaining: number) {
  if (daysRemaining < 0) {
    return <Badge variant="destructive">Expiré</Badge>;
  }
  if (daysRemaining < 90) {
    return (
      <Badge
        variant="secondary"
        className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
      >
        Expiration prochaine
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="bg-green-500/20 text-green-700 dark:text-green-400"
    >
      Valide
    </Badge>
  );
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function CertificationFormDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CertificationFormValues) => void;
}) {
  const form = useForm<CertificationFormValues>({
    resolver: zodResolver(certificationSchema),
    defaultValues: {
      employeeName: "",
      certificationName: "",
      obtainedDate: "",
      expiryDate: "",
    },
  });

  const handleSubmit = (data: CertificationFormValues) => {
    onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Ajouter une certification</DialogTitle>
          <DialogDescription>
            Enregistrez une nouvelle certification employé
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="employeeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de l'employé</FormLabel>
                  <FormControl>
                    <Input placeholder="Jean Dupont" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="certificationName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la certification</FormLabel>
                  <FormControl>
                    <Input placeholder="AWS Solutions Architect" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="obtainedDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date d'obtention</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expiryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date d'expiration</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit">Ajouter</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function CertificationsTracker({
  certifications,
  onAddCertification,
  className,
}: CertificationsTrackerProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleAddCertification = (data: CertificationFormValues) => {
    const obtainedDate = new Date(data.obtainedDate);
    const expiryDate = new Date(data.expiryDate);

    if (expiryDate <= obtainedDate) {
      toast.error("La date d'expiration doit être après la date d'obtention");
      return;
    }

    if (onAddCertification) {
      onAddCertification({
        employeeId: `emp-${Date.now()}`,
        employeeName: data.employeeName,
        certificationName: data.certificationName,
        obtainedDate,
        expiryDate,
      });
      toast.success("Certification ajoutée avec succès");
    }
  };

  if (certifications.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Suivi des certifications</CardTitle>
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aucune certification enregistrée
          </p>
        </CardContent>
        <CertificationFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleAddCertification}
        />
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Suivi des certifications</CardTitle>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-semibold min-w-[150px] bg-muted/50">
                  Employé
                </th>
                <th className="px-3 py-2 text-left font-semibold min-w-[180px] bg-muted/50">
                  Certification
                </th>
                <th className="px-3 py-2 text-left font-semibold min-w-[110px] bg-muted/50">
                  Date d'obtention
                </th>
                <th className="px-3 py-2 text-left font-semibold min-w-[110px] bg-muted/50">
                  Date d'expiration
                </th>
                <th className="px-3 py-2 text-left font-semibold min-w-[100px] bg-muted/50">
                  Statut
                </th>
                <th className="px-3 py-2 text-center font-semibold min-w-[100px] bg-muted/50">
                  Jours restants
                </th>
              </tr>
            </thead>
            <tbody>
              {certifications.map((cert) => {
                const daysRemaining = calculateDaysRemaining(cert.expiryDate);
                const isAlertNeeded = daysRemaining < 90 && daysRemaining >= 0;

                return (
                  <tr
                    key={cert.id}
                    className="border-b hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 py-3 font-medium">
                      {cert.employeeName}
                    </td>
                    <td className="px-3 py-3">{cert.certificationName}</td>
                    <td className="px-3 py-3">
                      {formatDate(cert.obtainedDate)}
                    </td>
                    <td className="px-3 py-3">{formatDate(cert.expiryDate)}</td>
                    <td className="px-3 py-3">
                      {getStatusBadge(daysRemaining)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {isAlertNeeded && (
                          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        )}
                        <span
                          className={
                            daysRemaining < 0
                              ? "text-red-600 dark:text-red-400 font-semibold"
                              : ""
                          }
                        >
                          {daysRemaining < 0
                            ? `−${Math.abs(daysRemaining)}`
                            : daysRemaining}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      <CertificationFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleAddCertification}
      />
    </Card>
  );
}
