/**
 * Docs API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, getServiceBaseUrl, ServiceName } from './factory';

// Get the docs service client (cached)
const docsClient = getClient(ServiceName.DOCS);
const DOCS_URL = getServiceBaseUrl(ServiceName.DOCS);

// ============================================================================
// Types - Base
// ============================================================================

export type DocType = 'text' | 'sheet' | 'slide' | 'board' | 'chat';

export interface BaseDocument {
    id: string;
    name: string;
    doc_type: DocType;
    created_at: string;
}

// ============================================================================
// Types - Text Document
// ============================================================================

export interface TextDocument extends BaseDocument {
    doc_type: 'text';
}

export interface CreateTextDocumentRequest {
    name: string;
}

// ============================================================================
// Types - Spreadsheet
// ============================================================================

export interface SpreadsheetDocument extends BaseDocument {
    doc_type: 'sheet';
    rows: number;
    cols: number;
}

export interface CreateSpreadsheetRequest {
    name: string;
    rows?: number;
    cols?: number;
}

export interface RowsResponse {
    rows: string[][];
}

// ============================================================================
// Types - Presentation
// ============================================================================

export interface PresentationDocument extends BaseDocument {
    doc_type: 'slide';
    theme: string;
    slide_count: number;
}

export interface CreatePresentationRequest {
    name: string;
    theme?: string;
}

export interface Slide {
    id: string;
    index: number;
    title: string;
    content: string;
}

export interface SlidesResponse {
    slides: Slide[];
}

// ============================================================================
// Types - Board (Kanban)
// ============================================================================

export interface BoardDocument extends BaseDocument {
    doc_type: 'board';
    board_type: string;
}

export interface CreateBoardRequest {
    name: string;
    board_type?: string;
}

export interface Card {
    id: string;
    title: string;
    description: string;
}

export interface Column {
    id: string;
    title: string;
    cards: Card[];
}

export interface ColumnsResponse {
    columns: Column[];
}

// ============================================================================
// Docs API
// ============================================================================

// ============================================================================
// Types - Design (aligned with Rust Design struct in handlers/designs.rs)
// ============================================================================

export interface Design {
    id: string;
    user_id: string;
    name: string;
    format_width: number;
    format_height: number;
    pages: number;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface CreateDesignRequest {
    name: string;
    format_width?: number;
    format_height?: number;
    pages?: number;
    metadata?: Record<string, unknown>;
}

// ============================================================================
// Types - Doc Template
// ============================================================================

export interface DocTemplate {
    id: string;
    name: string;
    doc_type: DocType;
    content: Record<string, unknown>;
    created_at: string;
}

export interface CreateDocTemplateRequest {
    name: string;
    doc_type: DocType;
    content: Record<string, unknown>;
}

// ============================================================================
// Types - Macro
// ============================================================================

export interface DocMacro {
    id: string;
    document_id: string; // matches Rust backend field name
    name: string;
    code: string;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface CreateMacroRequest {
    name: string;
    code: string;
}

// ============================================================================
// Types - Keep Note
// ============================================================================

export interface KeepNote {
    id: string;
    title?: string;
    content: string;
    color?: string;
    pinned?: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateKeepNoteRequest {
    title?: string;
    content: string;
    color?: string;
    pinned?: boolean;
}

// ============================================================================
// Docs API
// ============================================================================

export const docsApi = {
    // ========================================================================
    // Text Documents
    // ========================================================================

    createTextDocument: (data: CreateTextDocumentRequest) =>
        docsClient.post<TextDocument>('/docs/text', data),

    // ========================================================================
    // Spreadsheets
    // ========================================================================

    createSpreadsheet: (data: CreateSpreadsheetRequest) =>
        docsClient.post<SpreadsheetDocument>('/docs/sheet', data),

    getSpreadsheetRows: (docId: string) =>
        docsClient.get<RowsResponse>(`/docs/sheet/${docId}/rows`),

    // ========================================================================
    // Presentations
    // ========================================================================

    createPresentation: (data: CreatePresentationRequest) =>
        docsClient.post<PresentationDocument>('/docs/slide', data),

    getPresentationSlides: (docId: string) =>
        docsClient.get<SlidesResponse>(`/docs/slide/${docId}/slides`),

    // ========================================================================
    // Boards
    // ========================================================================

    createBoard: (data: CreateBoardRequest) =>
        docsClient.post<BoardDocument>('/docs/board', data),

    getBoardColumns: (docId: string) =>
        docsClient.get<ColumnsResponse>(`/docs/board/${docId}/columns`),

    // ========================================================================
    // Designs — GET/POST /api/v1/designs
    // list returns { data: Design[] }, single ops return Design directly
    // ========================================================================

    listDesigns: () =>
        docsClient.get<{ data: Design[] }>('/designs'),

    createDesign: (data: CreateDesignRequest) =>
        docsClient.post<Design>('/designs', data),

    getDesign: (id: string) =>
        docsClient.get<Design>(`/designs/${id}`),

    updateDesign: (id: string, data: Partial<CreateDesignRequest>) =>
        docsClient.put<Design>(`/designs/${id}`, data),

    deleteDesign: (id: string) =>
        docsClient.delete(`/designs/${id}`),

    // ========================================================================
    // Doc Templates — GET/POST /api/v1/docs/templates
    // ========================================================================

    listTemplates: () =>
        docsClient.get<DocTemplate[]>('/docs/templates'),

    createTemplate: (data: CreateDocTemplateRequest) =>
        docsClient.post<DocTemplate>('/docs/templates', data),

    getTemplate: (id: string) =>
        docsClient.get<DocTemplate>(`/docs/templates/${id}`),

    deleteTemplate: (id: string) =>
        docsClient.delete(`/docs/templates/${id}`),

    // ========================================================================
    // Macros — GET/POST /api/v1/docs/:doc_id/macros
    // ========================================================================

    listMacros: (docId: string) =>
        docsClient.get<DocMacro[]>(`/docs/${docId}/macros`),

    createMacro: (docId: string, data: CreateMacroRequest) =>
        docsClient.post<DocMacro>(`/docs/${docId}/macros`, data),

    updateMacro: (docId: string, macroId: string, data: Partial<CreateMacroRequest>) =>
        docsClient.put<DocMacro>(`/docs/${docId}/macros/${macroId}`, data),

    deleteMacro: (docId: string, macroId: string) =>
        docsClient.delete(`/docs/${docId}/macros/${macroId}`),

    // ========================================================================
    // Document Classification — POST /api/v1/docs/classify
    // Backend expects: { title, document_id?, content_preview? }
    // ========================================================================

    classifyDocument: (data: { title: string; document_id?: string; content_preview?: string }) =>
        docsClient.post<{
            document_id?: string;
            category: string;
            confidence: number;
            method: string;
        }>('/docs/classify', data),

    // ========================================================================
    // Keep Notes — GET/POST /api/v1/keep/notes
    // ========================================================================

    listKeepNotes: () =>
        docsClient.get<KeepNote[]>('/keep/notes'),

    createKeepNote: (data: CreateKeepNoteRequest) =>
        docsClient.post<KeepNote>('/keep/notes', data),

    updateKeepNote: (id: string, data: Partial<CreateKeepNoteRequest>) =>
        docsClient.put<KeepNote>(`/keep/notes/${id}`, data),

    deleteKeepNote: (id: string) =>
        docsClient.delete(`/keep/notes/${id}`),

    // ========================================================================
    // WebSocket URL for real-time collaboration (Yjs)
    // ========================================================================

    getWebSocketUrl: (docType: DocType, docId: string): string => {
        const wsBaseUrl = DOCS_URL.replace(/^http/, 'ws');
        return `${wsBaseUrl}/docs/${docType}/${docId}/ws`;
    },
};
