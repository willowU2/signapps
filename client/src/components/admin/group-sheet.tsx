"use client";
import { SpinnerInfinity } from "spinners-react";

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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCreateGroup, useUpdateGroup, Group } from "@/hooks/use-groups";

const groupSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères."),
  description: z.string().optional().nullable(),
});

type GroupFormValues = z.infer<typeof groupSchema>;

interface GroupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName?: string;
  initialData?: Group | null;
}

export function GroupSheet({
  open,
  onOpenChange,
  initialData,
}: GroupSheetProps) {
  const isEditing = !!initialData;
  const createMutation = useCreateGroup();
  const updateMutation = useUpdateGroup();

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (initialData && open) {
      form.reset({
        name: initialData.name,
        description: initialData.description || "",
      });
    } else if (!open) {
      form.reset({ name: "", description: "" });
    }
  }, [initialData, open, form]);

  const onSubmit = async (values: GroupFormValues) => {
    try {
      if (isEditing && initialData) {
        await updateMutation.mutateAsync({ id: initialData.id, data: values });
        toast.success("Groupe mis à jour avec succès");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("Groupe créé avec succès");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde du groupe");
      console.error(error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? "Modifier le groupe" : "Ajouter un groupe"}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modifiez les informations de ce groupe."
              : "Remplissez ce formulaire pour créer un nouveau groupe RBAC."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 mt-6"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du groupe</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Administrateurs, Utilisateurs..."
                      {...field}
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
                      placeholder="Description du rôle de ce groupe..."
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
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <SpinnerInfinity
                    size={24}
                    secondaryColor="rgba(128,128,128,0.2)"
                    color="currentColor"
                    speed={120}
                  />
                )}
                {isEditing ? "Mettre à jour" : "Créer"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
