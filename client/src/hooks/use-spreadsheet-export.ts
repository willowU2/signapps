'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  SpreadsheetExportFormat,
  SpreadsheetSheet,
  downloadSpreadsheet,
  importSpreadsheet,
  convertToApiFormat,
  convertFromApiFormat,
  checkSpreadsheetHealth,
  SpreadsheetExportOptions,
} from '@/lib/api/spreadsheet';

export interface UseSpreadsheetExportOptions {
  rows: number;
  cols: number;
}

export interface UseSpreadsheetExportReturn {
  // Export state
  isExporting: boolean;
  exportFormat: SpreadsheetExportFormat | null;

  // Import state
  isImporting: boolean;

  // Export functions
  exportXlsx: (
    data: Record<string, { value: string; formula?: string; style?: any }>,
    filename: string,
    sheetName?: string
  ) => Promise<void>;
  exportCsv: (
    data: Record<string, { value: string; formula?: string; style?: any }>,
    filename: string,
    options?: { delimiter?: ',' | ';' | '\t' }
  ) => Promise<void>;
  exportOds: (
    data: Record<string, { value: string; formula?: string; style?: any }>,
    filename: string,
    sheetName?: string
  ) => Promise<void>;

  // Import functions
  importFile: (file: File) => Promise<Record<string, { value: string; formula?: string }> | null>;

  // Status
  serviceAvailable: boolean;
  checkService: () => Promise<boolean>;
}

/**
 * Hook for managing spreadsheet import/export operations
 */
export function useSpreadsheetExport({
  rows,
  cols,
}: UseSpreadsheetExportOptions): UseSpreadsheetExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<SpreadsheetExportFormat | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [serviceAvailable, setServiceAvailable] = useState(true);

  // Check service health
  const checkService = useCallback(async (): Promise<boolean> => {
    const healthy = await checkSpreadsheetHealth();
    setServiceAvailable(healthy);
    return healthy;
  }, []);

  // Convert data and export to XLSX
  const exportXlsx = useCallback(
    async (
      data: Record<string, { value: string; formula?: string; style?: any }>,
      filename: string,
      sheetName: string = 'Sheet1'
    ) => {
      const healthy = await checkService();
      if (!healthy) {
        toast.error("Le service d'export n'est pas disponible");
        return;
      }

      setIsExporting(true);
      setExportFormat('xlsx');

      try {
        const apiData = convertToApiFormat(data, rows, cols);
        const sheet: SpreadsheetSheet = {
          name: sheetName,
          data: apiData,
        };

        await downloadSpreadsheet(sheet, 'xlsx', filename);
        toast.success(`Fichier "${filename}.xlsx" exporté avec succès`);
      } catch (error) {
        console.error('XLSX export error:', error);
        toast.error("Erreur lors de l'export XLSX");
      } finally {
        setIsExporting(false);
        setExportFormat(null);
      }
    },
    [rows, cols, checkService]
  );

  // Convert data and export to CSV
  const exportCsv = useCallback(
    async (
      data: Record<string, { value: string; formula?: string; style?: any }>,
      filename: string,
      options?: { delimiter?: ',' | ';' | '\t' }
    ) => {
      const healthy = await checkService();
      if (!healthy) {
        toast.error("Le service d'export n'est pas disponible");
        return;
      }

      setIsExporting(true);
      setExportFormat('csv');

      try {
        const apiData = convertToApiFormat(data, rows, cols);
        const sheet: SpreadsheetSheet = {
          name: 'Sheet1',
          data: apiData,
        };

        await downloadSpreadsheet(sheet, 'csv', filename, {
          delimiter: options?.delimiter,
        });
        toast.success(`Fichier "${filename}.csv" exporté avec succès`);
      } catch (error) {
        console.error('CSV export error:', error);
        toast.error("Erreur lors de l'export CSV");
      } finally {
        setIsExporting(false);
        setExportFormat(null);
      }
    },
    [rows, cols, checkService]
  );

  // Convert data and export to ODS
  const exportOds = useCallback(
    async (
      data: Record<string, { value: string; formula?: string; style?: any }>,
      filename: string,
      sheetName: string = 'Sheet1'
    ) => {
      const healthy = await checkService();
      if (!healthy) {
        toast.error("Le service d'export n'est pas disponible");
        return;
      }

      setIsExporting(true);
      setExportFormat('ods');

      try {
        const apiData = convertToApiFormat(data, rows, cols);
        const sheet: SpreadsheetSheet = {
          name: sheetName,
          data: apiData,
        };

        await downloadSpreadsheet(sheet, 'ods', filename);
        toast.success(`Fichier "${filename}.ods" exporté avec succès`);
      } catch (error) {
        console.error('ODS export error:', error);
        toast.error("Erreur lors de l'export ODS");
      } finally {
        setIsExporting(false);
        setExportFormat(null);
      }
    },
    [rows, cols, checkService]
  );

  // Import file and convert to frontend format
  const importFile = useCallback(
    async (
      file: File
    ): Promise<Record<string, { value: string; formula?: string }> | null> => {
      const healthy = await checkService();
      if (!healthy) {
        toast.error("Le service d'import n'est pas disponible");
        return null;
      }

      setIsImporting(true);

      try {
        const result = await importSpreadsheet(file);

        if (!result.success) {
          toast.error("Erreur lors de l'import du fichier");
          return null;
        }

        // Get data from result
        let apiData: (string | number | boolean | null)[][] | undefined;

        if (result.spreadsheet.sheets && result.spreadsheet.sheets.length > 0) {
          // Multi-sheet: use first sheet
          apiData = result.spreadsheet.sheets[0].data;
        } else if (result.spreadsheet.data) {
          // Single sheet
          apiData = result.spreadsheet.data;
        }

        if (!apiData) {
          toast.error('Aucune donnée trouvée dans le fichier');
          return null;
        }

        const frontendData = convertFromApiFormat(apiData);
        toast.success(`Fichier "${result.filename}" importé avec succès`);
        return frontendData;
      } catch (error) {
        console.error('Import error:', error);
        toast.error("Erreur lors de l'import du fichier");
        return null;
      } finally {
        setIsImporting(false);
      }
    },
    [checkService]
  );

  return {
    isExporting,
    exportFormat,
    isImporting,
    exportXlsx,
    exportCsv,
    exportOds,
    importFile,
    serviceAvailable,
    checkService,
  };
}
