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
        return 'Unable to connect to the server. Please check your connection.';
      }
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        return 'Request timed out. Please try again.';
      }
      return 'Erreur réseau. Please check your connection and try again.';
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
  return 'An unexpected error occurred. Please try again.';
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
      return 'Invalid request. Please check your input.';
    case 401:
      return 'Identifiants invalides. Please try again.';
    case 403:
      return 'Accès refusé. You do not have permission to perform this action.';
    case 404:
      return 'Resource not found.';
    case 409:
      return 'This resource already exists.';
    case 422:
      return 'Invalid data provided. Please check your input.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'Server error. Please try again later.';
    case 502:
    case 503:
    case 504:
      return 'Service temporarily unavailable. Please try again later.';
    default:
      return 'Une erreur est survenue. Please try again.';
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
