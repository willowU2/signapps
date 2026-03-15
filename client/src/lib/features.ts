/**
 * Feature Flags - SignApps Platform
 *
 * RÈGLE NO DEAD ENDS:
 * - Si une feature n'est pas prête, elle doit être désactivée ici
 * - Aucun élément UI ne doit pointer vers du code non-fonctionnel
 * - Code review: pas de merge si UI pointe vers du vide
 *
 * @see C:\Users\Etienne\.claude\plans\purring-frolicking-book.md
 */

export const FEATURES = {
  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICES PLEINEMENT FONCTIONNELS
  // ═══════════════════════════════════════════════════════════════════════════
  IDENTITY: true,
  STORAGE: true,
  CONTAINERS: true,
  AI: true,
  SCHEDULER: true,
  CALENDAR: true,
  METRICS: true,
  MEDIA: true,
  PROXY: true,

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICES PARTIELS (fonctionnent mais features spécifiques manquantes)
  // ═══════════════════════════════════════════════════════════════════════════
  MAIL: true,
  MEET: true,
  VPN: true,
  DOCS: true,
  COLLAB: true,

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICES SKELETON (NON FONCTIONNELS - CACHÉS)
  // ═══════════════════════════════════════════════════════════════════════════
  REMOTE: false, // Canvas rendering incomplet
  PXE: false, // Service non implémenté
  IT_ASSETS: false, // Service non implémenté
  OFFICE: false, // Service conversion non implémenté

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURES SPÉCIFIQUES NON PRÊTES
  // ═══════════════════════════════════════════════════════════════════════════

  // Admin features
  MEMBER_MANAGEMENT: false, // Gestion des membres workspace

  // Storage features
  ARCHIVE_EXTRACTION: false, // Extraction de contenu d'archives
  STORAGE_MODULES: false, // Ajout de modules storage
  VERSION_RESTORE: false, // Restauration de versions de fichiers (backend 501)

  // Drag & Drop features
  DND_FILE_TO_TASK: false, // Lier fichier à tâche via drag
  DND_TASK_TO_CALENDAR: false, // Créer événement via drag de tâche

  // Chat features
  CHAT_PRESENCE: false, // Indicateurs de présence en ligne
  CHAT_UNREAD_COUNT: false, // Compteur de messages non lus

  // Export features (Epic 2 - backlog)
  DOCS_EXPORT_DOCX: false,
  DOCS_EXPORT_PDF: false,
  SHEETS_EXPORT_XLSX: false,
  SLIDES_EXPORT_PPTX: false,

  // Import features (Epic 3 - backlog)
  DOCS_IMPORT_DOCX: false,
  SHEETS_IMPORT_XLSX: false,
} as const;

/**
 * Type pour les clés de features
 */
export type FeatureKey = keyof typeof FEATURES;

/**
 * Vérifie si une feature est activée
 */
export function isFeatureEnabled(feature: FeatureKey): boolean {
  return FEATURES[feature];
}

/**
 * Hook React pour vérifier une feature (utilisable côté client)
 */
export function useFeature(feature: FeatureKey): boolean {
  return FEATURES[feature];
}
