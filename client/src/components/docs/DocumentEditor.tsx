'use client';
import { SpinnerInfinity } from 'spinners-react';


import { Suspense } from 'react';
import { TextEditor } from './TextEditor';
import { SheetEditor } from './SheetEditor';
import { SlideEditor } from './SlideEditor';
import { BoardEditor } from './BoardEditor';

interface DocumentEditorProps {
    docId: string;
    docType: 'text' | 'sheet' | 'slide' | 'board';
    docName?: string;
}

export function DocumentEditor({ docId, docType, docName }: DocumentEditorProps) {
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b border-border p-4 bg-background">
                <h2 className="text-lg font-semibold text-foreground">{docName || 'Untitled'}</h2>
                <p className="text-sm text-muted-foreground">Type: {docType}</p>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-auto">
                <Suspense fallback={<LoadingFallback />}>
                    {docType === 'text' && <TextEditor docId={docId} />}
                    {docType === 'sheet' && <SheetEditor docId={docId} />}
                    {docType === 'slide' && <SlideEditor docId={docId} />}
                    {docType === 'board' && <BoardEditor docId={docId} />}
                </Suspense>
            </div>
        </div>
    );
}

function LoadingFallback() {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} />
                <p className="text-muted-foreground mt-2">Chargement...</p>
            </div>
        </div>
    );
}
