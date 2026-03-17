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
  OFFICE: true, // Service conversion opérationnel (Sprint 3)

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURES SPÉCIFIQUES NON PRÊTES
  // ═══════════════════════════════════════════════════════════════════════════

  // Admin features
  MEMBER_MANAGEMENT: true, // Gestion des membres workspace (Sprint 11)

  // Storage features
  ARCHIVE_EXTRACTION: false, // Extraction de contenu d'archives
  STORAGE_MODULES: false, // Ajout de modules storage
  VERSION_RESTORE: true, // Restauration de versions (Sprint 9 - backend complet)

  // Drag & Drop features
  DND_FILE_TO_TASK: true, // Lier fichier à tâche via drag (Sprint 7.1)
  DND_TASK_TO_CALENDAR: true, // Créer événement via drag de tâche (Sprint 7.2)

  // Chat features
  CHAT_PRESENCE: false, // Indicateurs de présence en ligne (nécessite WebSocket)
  CHAT_UNREAD_COUNT: true, // Compteur de messages non lus (Sprint 10 - API REST)

  // Export features (Epic 2 - Sprint 3)
  DOCS_EXPORT_DOCX: true,
  DOCS_EXPORT_PDF: true,
  SHEETS_EXPORT_XLSX: true, // Local xlsx lib - functional
  SLIDES_EXPORT_PPTX: false, // Slides export not yet implemented

  // Import features (Epic 3 - Sprint 3.5)
  DOCS_IMPORT_DOCX: true,
  SHEETS_IMPORT_XLSX: true, // Local xlsx lib - functional
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
