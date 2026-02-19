'use client';

import { CollaborativeEditor } from '../ai/collaborative-editor';

interface TextEditorProps {
    docId: string;
}

export function TextEditor({ docId }: TextEditorProps) {
    return (
        <div className="p-6">
            <CollaborativeEditor
                docId={docId}
                placeholder="Start typing your document..."
                onSynced={() => {
                    // synced
                }}
            />
        </div>
    );
}
