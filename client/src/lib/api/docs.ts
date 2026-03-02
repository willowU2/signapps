import { docsApiClient, DOCS_URL } from './core';

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

export const docsApi = {
    // ========================================================================
    // Text Documents
    // ========================================================================

    createTextDocument: (data: CreateTextDocumentRequest) =>
        docsApiClient.post<TextDocument>('/docs/text', data),

    // ========================================================================
    // Spreadsheets
    // ========================================================================

    createSpreadsheet: (data: CreateSpreadsheetRequest) =>
        docsApiClient.post<SpreadsheetDocument>('/docs/sheet', data),

    getSpreadsheetRows: (docId: string) =>
        docsApiClient.get<RowsResponse>(`/docs/sheet/${docId}/rows`),

    // ========================================================================
    // Presentations
    // ========================================================================

    createPresentation: (data: CreatePresentationRequest) =>
        docsApiClient.post<PresentationDocument>('/docs/slide', data),

    getPresentationSlides: (docId: string) =>
        docsApiClient.get<SlidesResponse>(`/docs/slide/${docId}/slides`),

    // ========================================================================
    // Boards
    // ========================================================================

    createBoard: (data: CreateBoardRequest) =>
        docsApiClient.post<BoardDocument>('/docs/board', data),

    getBoardColumns: (docId: string) =>
        docsApiClient.get<ColumnsResponse>(`/docs/board/${docId}/columns`),

    // ========================================================================
    // WebSocket URL for real-time collaboration (Yjs)
    // ========================================================================

    getWebSocketUrl: (docType: DocType, docId: string): string => {
        const wsBaseUrl = DOCS_URL.replace(/^http/, 'ws');
        return `${wsBaseUrl}/docs/${docType}/${docId}/ws`;
    },
};
