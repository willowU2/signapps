/**
 * COH-013: Standard toast message helpers.
 * Use these instead of raw toast.success/error/info calls for consistency.
 */
import { toast } from "sonner";

export const notify = {
  /** Generic success: "Item créé avec succès" */
  created: (item: string) => toast.success(`${item} créé avec succès`),
  /** Generic update: "Item mis à jour" */
  updated: (item: string) => toast.success(`${item} mis à jour`),
  /** Generic delete: "Item supprimé" */
  deleted: (item: string) => toast.success(`${item} supprimé`),
  /** Generic save: "Modifications enregistrées" */
  saved: () => toast.success("Modifications enregistrées"),
  /** Generic copy: "Copié dans le presse-papiers" */
  copied: () => toast.success("Copié dans le presse-papiers"),
  /** Generic error with optional detail */
  error: (message?: string) =>
    toast.error(message ?? "Une erreur est survenue"),
  /** Network/API error */
  networkError: () => toast.error("Erreur de connexion. Réessayez."),
  /** Permission error */
  forbidden: () => toast.error("Action non autorisée"),
};
