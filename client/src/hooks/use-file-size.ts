import { useCallback } from 'react';

const UNITS = ['o', 'Ko', 'Mo', 'Go', 'To'] as const;

/**
 * COH-041 — useFileSize: formats byte counts in French SI units
 * Returns "1,2 Mo", "3,5 Go", "512 Ko", etc.
 */
export function useFileSize() {
  const formatFileSize = useCallback((bytes: number | null | undefined): string => {
    if (bytes == null || isNaN(bytes)) return '—';
    if (bytes === 0) return '0 o';

    const abs = Math.abs(bytes);
    const unitIndex = Math.min(
      Math.floor(Math.log10(abs) / 3),
      UNITS.length - 1,
    );
    const value = bytes / Math.pow(1000, unitIndex);

    // French locale: comma decimal separator
    const formatted = new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: unitIndex === 0 ? 0 : 1,
      minimumFractionDigits: 0,
    }).format(value);

    return `${formatted} ${UNITS[unitIndex]}`;
  }, []);

  return { formatFileSize };
}
