"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const contractSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères."),
  type: z.enum(["Fournisseur", "Client", "Employe"]),
  startDate: z.string().min(1, "La date de démarrage est requise."),
  endDate: z.string().min(1, "La date de fin est requise."),
  description: z.string().optional().nullable(),
  parties: z.string().optional().nullable(),
  value: z.string().optional().nullable(),
});

type ContractFormValues = z.infer<typeof contractSchema>;

interface ContractFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: ContractFormValues | null;
  onSubmit: (data: ContractFormValues) => Promise<void>;
}

export function ContractForm({
  open,
  onOpenChange,
  initialData,
  onSubmit,
}: ContractFormProps) {
  const isEditing = !!initialData;
  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      name: "",
      type: "Fournisseur",
      startDate: "",
      endDate: "",
      description: "",
      parties: "",
      value: "",
    },
  });

  useEffect(() => {
    if (initialData && open) {
      form.reset({
        name: initialData.name,
        type: initialData.type,
        startDate: initialData.startDate,
        endDate: initialData.endDate,
        description: initialData.description || "",
        parties: initialData.parties || "",
        value: initialData.value || "",
      });
    } else if (!open) {
      form.reset({
        name: "",
        type: "Fournisseur",
        startDate: "",
        endDate: "",
        description: "",
        parties: "",
        value: "",
      });
    }
  }, [initialData, open, form]);

  const handleSubmit = async (values: ContractFormValues) => {
    try {
      await onSubmit(values);
      toast.success(
        isEditing
          ? "Contrat mis à jour avec succès"
          : "Contrat créé avec succès",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde du contrat");
      console.error(error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? "Modifier le Contrat" : "Ajouter un Contrat"}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modifiez les informations du contrat."
              : "Remplissez ce formulaire pour créer un nouveau contrat."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4 mt-6"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du Contrat</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ex: Contrat Fournisseur ABC"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Fournisseur">Fournisseur</SelectItem>
                      <SelectItem value="Client">Client</SelectItem>
                      <SelectItem value="Employe">Employé</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de Démarrage</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de Fin</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valeur du Contrat (optionnel)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ex: 5000 EUR"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parties"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parties Impliquées (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="ex: Entreprise ABC, Personne XYZ"
                      className="resize-none"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Détails du contrat..."
                      className="resize-none"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4 space-x-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit">
                {isEditing ? "Mettre à jour" : "Créer le Contrat"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
