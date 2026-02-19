import { CollaborativeEditor } from '@/components/ai/collaborative-editor';

export const metadata = {
    title: 'Collaborative Documents - SignApps',
    description: 'Real-time collaborative document editing',
};

export const dynamic = 'force-dynamic';

export default function DocumentsPage() {
    // In a real app, this would come from URL params or state
    const docId = 'doc-demo-001';

    return (
        <div className="flex-1 overflow-auto">
            <div className="max-w-5xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Collaborative Documents
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Edit documents in real-time with team members
                    </p>
                </div>

                {/* Document Editor */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Untitled Document
                    </h2>
                    <CollaborativeEditor
                        docId={docId}
                        placeholder="Start typing your document..."
                        onSynced={() => {
                            // synced
                        }}
                    />
                </div>

                {/* Info section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900">ℹ️ How it works</h3>
                    <ul className="text-blue-800 text-sm mt-2 space-y-1 list-disc list-inside">
                        <li>Changes sync automatically with all collaborators</li>
                        <li>Your cursor and selections are visible to others</li>
                        <li>Documents are persisted to the server</li>
                        <li>Open this link in multiple tabs to test real-time sync</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
