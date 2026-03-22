import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import { storageApi } from './api';

/**
 * Downloads a document from the storage API and parses it based on extension.
 * Supported: .xlsx, .xls, .csv, .md, .txt, .docx
 */
export async function fetchAndParseDocument(bucket: string, fileKey: string, fileName: string) {
    let ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === fileName.toLowerCase() && !fileName.includes('.')) {
        // Files created natively without extensions are considered 'docx' blobs by signapps editor
        ext = 'docx';
    }
    // 1. Download file stream/blob
    let arrayBuffer: ArrayBuffer | null = null;
    try {
        const blob = await storageApi.downloadFile(bucket, fileKey);
        arrayBuffer = await blob.arrayBuffer();
    } catch (e: any) {
        if (e.response?.status === 404 || e.response?.status === 502) {
            console.warn(`File ${fileKey} not found (status ${e.response.status}). Treating as a new/empty file.`);
            // It will be handled below by passing null or creating empty defaults.
        } else {
            throw new Error(`Failed to download file: ${e.message}`);
        }
    }

    if (!arrayBuffer) {
        // Return default empty state based on file type
        if (['xlsx', 'xls', 'xlsb', 'csv', 'ods'].includes(ext)) {
            return { type: 'spreadsheet', data: {}, sheets: ['Feuille 1'] };
        }
        if (['docx'].includes(ext)) {
            return { type: 'document', html: '', warnings: [] };
        }
        if (['md', 'txt', 'html'].includes(ext)) {
            return { type: 'document', text: '' };
        }
        if (['signslides', 'json'].includes(ext)) {
            return { type: 'slides', format: { version: 1, slides: [] } };
        }
        throw new Error(`Unsupported file type for empty file: ${ext}`);
    }

    // 2. Parse content based on file type
    if (['xlsx', 'xls', 'xlsb', 'csv', 'ods'].includes(ext)) {
        return parseSpreadsheet(arrayBuffer, ext);
    } 
    
    if (['docx'].includes(ext)) {
        return parseDocx(arrayBuffer);
    }
    
    if (['md', 'txt', 'html'].includes(ext)) {
        return parseText(arrayBuffer);
    }

    if (['signslides', 'json'].includes(ext)) {
        return parseSlides(arrayBuffer, fileName);
    }

    throw new Error(`Unsupported file type: ${ext}`);
}

async function parseSpreadsheet(buffer: ArrayBuffer, ext: string) {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetsMap: Record<string, Record<string, { value: string; format?: any }>> = {};

    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];
        
        const cells: Record<string, { value: string }> = {};
        data.forEach((row, r) => {
            row.forEach((cellVal, c) => {
                 if (cellVal !== "") {
                     cells[`${r},${c}`] = { value: String(cellVal) };
                 }
            });
        });
        sheetsMap[sheetName] = cells;
    });

    return { type: 'spreadsheet', data: sheetsMap, sheets: workbook.SheetNames };
}

async function parseDocx(buffer: ArrayBuffer) {
    try {
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        return { type: 'document', html: result.value, warnings: result.messages };
    } catch (e) {
        throw new Error("Failed to parse .docx file");
    }
}

async function parseText(buffer: ArrayBuffer) {
    const text = new TextDecoder().decode(buffer);
    return { type: 'document', text: text };
}

interface SlideObject {
    id: string;
    [key: string]: any;
}

interface SlideFileData {
    id: string;
    title: string;
    objects: SlideObject[];
    notes?: string; // Speaker notes for presentations
}

export interface SlidesFileFormat {
    version: number;
    slides: SlideFileData[];
    metadata?: {
        createdAt?: string;
        updatedAt?: string;
        author?: string;
    };
}

async function parseSlides(buffer: ArrayBuffer, fileName: string): Promise<{ type: 'slides'; data: SlidesFileFormat }> {
    try {
        const text = new TextDecoder().decode(buffer);
        const data = JSON.parse(text) as SlidesFileFormat;

        // Validate structure
        if (!data.slides || !Array.isArray(data.slides)) {
            throw new Error("Invalid slides file format: missing slides array");
        }

        return { type: 'slides', data };
    } catch (e: any) {
        throw new Error(`Failed to parse slides file: ${e.message}`);
    }
}
