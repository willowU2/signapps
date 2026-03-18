'use client';

/**
 * ChangeNotifications
 *
 * Toast notifications for document collaboration actions.
 */

import React from 'react';
import { toast } from 'sonner';
import {
  MessageSquare,
  Check,
  X,
  CheckCheck,
  XCircle,
  Plus,
  Minus,
  Reply,
  Edit2,
  Trash2,
  GitCommit,
} from 'lucide-react';

// ============================================================================
// Comment Notifications
// ============================================================================

export const commentNotifications = {
  /**
   * Show notification when a comment is added
   */
  added: (authorName: string) => {
    toast.success('Commentaire ajouté', {
      description: `${authorName} a ajouté un commentaire`,
      icon: <MessageSquare className="h-4 w-4" />,
    });
  },

  /**
   * Show notification when a comment is resolved
   */
  resolved: (authorName?: string) => {
    toast.success('Commentaire résolu', {
      description: authorName
        ? `Résolu par ${authorName}`
        : 'Le commentaire a été marqué comme résolu',
      icon: <CheckCheck className="h-4 w-4 text-green-600" />,
    });
  },

  /**
   * Show notification when a comment is reopened
   */
  reopened: () => {
    toast.info('Commentaire rouvert', {
      description: 'Le commentaire a été rouvert',
      icon: <X className="h-4 w-4" />,
    });
  },

  /**
   * Show notification when a reply is added
   */
  replied: (authorName: string) => {
    toast.success('Réponse ajoutée', {
      description: `${authorName} a répondu au commentaire`,
      icon: <Reply className="h-4 w-4" />,
    });
  },

  /**
   * Show notification when a comment is edited
   */
  edited: () => {
    toast.success('Commentaire modifié', {
      description: 'Votre commentaire a été mis à jour',
      icon: <Edit2 className="h-4 w-4" />,
    });
  },

  /**
   * Show notification when a comment is deleted
   */
  deleted: () => {
    toast.success('Commentaire supprimé', {
      description: 'Le commentaire a été supprimé',
      icon: <Trash2 className="h-4 w-4" />,
    });
  },
};

// ============================================================================
// Track Changes Notifications
// ============================================================================

export const trackChangesNotifications = {
  /**
   * Show notification when a change is accepted
   */
  accepted: (changeType: 'insertion' | 'deletion' | 'format' | 'replacement') => {
    const typeLabels = {
      insertion: "L'insertion",
      deletion: 'La suppression',
      format: 'Le formatage',
      replacement: 'Le remplacement',
    };

    toast.success('Modification acceptée', {
      description: `${typeLabels[changeType]} a été appliquée au document`,
      icon: <Check className="h-4 w-4 text-green-600" />,
    });
  },

  /**
   * Show notification when a change is rejected
   */
  rejected: (changeType: 'insertion' | 'deletion' | 'format' | 'replacement') => {
    const typeLabels = {
      insertion: "L'insertion",
      deletion: 'La suppression',
      format: 'Le formatage',
      replacement: 'Le remplacement',
    };

    toast.success('Modification rejetée', {
      description: `${typeLabels[changeType]} a été annulée`,
      icon: <X className="h-4 w-4 text-red-600" />,
    });
  },

  /**
   * Show notification when all changes are accepted
   */
  allAccepted: (count: number) => {
    toast.success('Toutes les modifications acceptées', {
      description: `${count} modification${count > 1 ? 's' : ''} appliquée${count > 1 ? 's' : ''} au document`,
      icon: <CheckCheck className="h-4 w-4 text-green-600" />,
    });
  },

  /**
   * Show notification when all changes are rejected
   */
  allRejected: (count: number) => {
    toast.success('Toutes les modifications rejetées', {
      description: `${count} modification${count > 1 ? 's' : ''} annulée${count > 1 ? 's' : ''}`,
      icon: <XCircle className="h-4 w-4 text-red-600" />,
    });
  },

  /**
   * Show notification when track changes is enabled
   */
  trackingEnabled: () => {
    toast.info('Suivi des modifications activé', {
      description: 'Les modifications seront maintenant enregistrées',
      icon: <GitCommit className="h-4 w-4" />,
    });
  },

  /**
   * Show notification when track changes is disabled
   */
  trackingDisabled: () => {
    toast.info('Suivi des modifications désactivé', {
      description: 'Les modifications ne seront plus enregistrées',
      icon: <GitCommit className="h-4 w-4 text-muted-foreground" />,
    });
  },

  /**
   * Show notification when a new change is detected
   */
  newChange: (authorName: string, changeType: 'insertion' | 'deletion' | 'format' | 'replacement') => {
    const typeLabels = {
      insertion: 'a inséré du texte',
      deletion: 'a supprimé du texte',
      format: 'a modifié le formatage',
      replacement: 'a remplacé du texte',
    };

    const icons = {
      insertion: <Plus className="h-4 w-4 text-green-600" />,
      deletion: <Minus className="h-4 w-4 text-red-600" />,
      format: <GitCommit className="h-4 w-4 text-blue-600" />,
      replacement: <GitCommit className="h-4 w-4 text-amber-600" />,
    };

    toast.info('Nouvelle modification', {
      description: `${authorName} ${typeLabels[changeType]}`,
      icon: icons[changeType],
    });
  },
};

// ============================================================================
// Collaboration Notifications
// ============================================================================

export const collaborationNotifications = {
  /**
   * Show notification when a user joins the document
   */
  userJoined: (userName: string) => {
    toast.info(`${userName} a rejoint le document`, {
      description: 'Vous pouvez maintenant collaborer en temps réel',
    });
  },

  /**
   * Show notification when a user leaves the document
   */
  userLeft: (userName: string) => {
    toast.info(`${userName} a quitté le document`);
  },

  /**
   * Show notification when the document is saved
   */
  documentSaved: () => {
    toast.success('Document enregistré', {
      description: 'Toutes les modifications ont été sauvegardées',
    });
  },

  /**
   * Show notification when auto-save occurs
   */
  autoSaved: () => {
    toast.success('Sauvegarde automatique', {
      description: 'Document sauvegardé automatiquement',
      duration: 2000,
    });
  },

  /**
   * Show notification when there's a sync conflict
   */
  syncConflict: () => {
    toast.warning('Conflit de synchronisation', {
      description: 'Certaines modifications peuvent nécessiter une révision manuelle',
    });
  },

  /**
   * Show notification when connection is lost
   */
  connectionLost: () => {
    toast.error('Connexion perdue', {
      description: 'Les modifications seront synchronisées une fois la connexion rétablie',
    });
  },

  /**
   * Show notification when connection is restored
   */
  connectionRestored: () => {
    toast.success('Connexion rétablie', {
      description: 'Synchronisation en cours...',
    });
  },
};

// ============================================================================
// Export Notifications
// ============================================================================

export const exportNotifications = {
  /**
   * Show notification when export starts
   */
  started: (format: string) => {
    toast.info(`Export ${format.toUpperCase()} en cours...`, {
      description: 'Veuillez patienter',
    });
  },

  /**
   * Show notification when export completes
   */
  completed: (format: string, fileName: string) => {
    toast.success(`Export ${format.toUpperCase()} terminé`, {
      description: `Fichier "${fileName}" prêt au téléchargement`,
    });
  },

  /**
   * Show notification when export fails
   */
  failed: (format: string, error?: string) => {
    toast.error(`Échec de l'export ${format.toUpperCase()}`, {
      description: error || 'Une erreur est survenue lors de l\'export',
    });
  },

  /**
   * Show notification for large document warning
   */
  largeDocument: () => {
    toast.warning('Document volumineux', {
      description: 'L\'export peut prendre plus de temps que d\'habitude',
    });
  },
};

// ============================================================================
// Unified Notification Handler
// ============================================================================

export const officeNotifications = {
  comment: commentNotifications,
  trackChanges: trackChangesNotifications,
  collaboration: collaborationNotifications,
  export: exportNotifications,
};

export default officeNotifications;
