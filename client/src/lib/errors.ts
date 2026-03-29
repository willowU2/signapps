/**
 * RFC 7807 Problem Details error response parser
 * https://datatracker.ietf.org/doc/html/rfc7807
 */

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

/**
 * Parse an API error response into a user-friendly message
 */
export function parseApiError(error: unknown): string {
  // Handle Axios error response
  if (isAxiosError(error)) {
    const response = error.response;

    if (!response) {
      // Erreur réseau
      if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        return 'Impossible de se connecter au serveur. Vérifiez votre connexion.';
      }
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        return 'La requête a expiré. Veuillez réessayer.';
      }
      return 'Erreur réseau. Vérifiez votre connexion et réessayez.';
    }

    const data = response.data;

    // RFC 7807 Problem Details format
    if (isProblemDetails(data)) {
      return data.detail || data.title || getDefaultMessageForStatus(response.status);
    }

    // Legacy error format
    if (typeof data === 'object' && data !== null) {
      if ('detail' in data && typeof data.detail === 'string') {
        return data.detail;
      }
      if ('message' in data && typeof data.message === 'string') {
        return data.message;
      }
      if ('error' in data && typeof data.error === 'string') {
        return data.error;
      }
    }

    // Fallback to status-based message
    return getDefaultMessageForStatus(response.status);
  }

  // Handle standard Error
  if (error instanceof Error) {
    return error.message;
  }

  // Handle string error
  if (typeof error === 'string') {
    return error;
  }

  // Fallback
  return 'Une erreur inattendue s\'est produite. Veuillez réessayer.';
}

/**
 * Check if error is an Axios error
 */
function isAxiosError(error: unknown): error is {
  response?: { data: unknown; status: number };
  code?: string;
  message: string;
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    ('response' in error || 'code' in error)
  );
}

/**
 * Check if data matches RFC 7807 Problem Details format
 */
function isProblemDetails(data: unknown): data is ProblemDetails {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  // RFC 7807 typically has 'type' or 'title' field
  return 'type' in data || 'title' in data || 'detail' in data;
}

/**
 * Get user-friendly message for HTTP status code
 */
function getDefaultMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Requête invalide. Vérifiez les informations saisies.';
    case 401:
      return 'Identifiants invalides. Veuillez vous reconnecter.';
    case 403:
      return 'Accès refusé. Vous n\'avez pas les permissions nécessaires.';
    case 404:
      return 'Ressource introuvable.';
    case 409:
      return 'Cette ressource existe déjà.';
    case 422:
      return 'Données invalides. Vérifiez les informations saisies.';
    case 429:
      return 'Trop de requêtes. Veuillez patienter un moment.';
    case 500:
      return 'Erreur serveur. Veuillez réessayer ultérieurement.';
    case 502:
    case 503:
    case 504:
      return 'Service temporairement indisponible. Veuillez réessayer.';
    default:
      return 'Une erreur est survenue. Veuillez réessayer.';
  }
}

/**
 * Centralized error extraction for React Query / mutation error handlers.
 * Single entry-point: extractApiError(error) → localized string.
 *
 * Usage:
 *   const msg = extractApiError(error);
 *   toast.error(msg);
 */
export function extractApiError(error: unknown): string {
  return parseApiError(error);
}

/**
 * Extract field-specific validation errors from API response
 */
export function extractValidationErrors(
  error: unknown
): Record<string, string> | null {
  if (!isAxiosError(error) || !error.response) {
    return null;
  }

  const data = error.response.data;
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  // Handle validation errors in 'errors' field
  if ('errors' in data && typeof data.errors === 'object') {
    const errors = data.errors as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const [field, messages] of Object.entries(errors)) {
      if (Array.isArray(messages)) {
        result[field] = messages[0]?.toString() || 'Invalid value';
      } else if (typeof messages === 'string') {
        result[field] = messages;
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  return null;
}
