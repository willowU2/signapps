import { useCallback } from "react";
import { extractApiError } from "@/lib/errors";

/**
 * COH-063 — useApiError: extracts a localized message from axios/fetch errors
 *
 * Usage:
 *   const { getErrorMessage } = useApiError();
 *   catch (err) { toast.error(getErrorMessage(err)); }
 */
export function useApiError() {
  const getErrorMessage = useCallback((error: unknown): string => {
    return extractApiError(error);
  }, []);

  const isUnauthorized = useCallback((error: unknown): boolean => {
    if (typeof error === "object" && error !== null && "response" in error) {
      const e = error as { response?: { status?: number } };
      return e.response?.status === 401;
    }
    return false;
  }, []);

  const isForbidden = useCallback((error: unknown): boolean => {
    if (typeof error === "object" && error !== null && "response" in error) {
      const e = error as { response?: { status?: number } };
      return e.response?.status === 403;
    }
    return false;
  }, []);

  const isNotFound = useCallback((error: unknown): boolean => {
    if (typeof error === "object" && error !== null && "response" in error) {
      const e = error as { response?: { status?: number } };
      return e.response?.status === 404;
    }
    return false;
  }, []);

  const isServerError = useCallback((error: unknown): boolean => {
    if (typeof error === "object" && error !== null && "response" in error) {
      const e = error as { response?: { status?: number } };
      const status = e.response?.status ?? 0;
      return status >= 500;
    }
    return false;
  }, []);

  return {
    getErrorMessage,
    isUnauthorized,
    isForbidden,
    isNotFound,
    isServerError,
  };
}
