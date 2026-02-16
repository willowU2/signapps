import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Documents - SignApps',
    description: 'Collaborative documents, sheets, slides, and boards',
};

export default function DocsPage() {
    return (
        <div className="flex-1 overflow-auto">
            <div className="max-w-5xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Collaborative Documents</h1>
                    <p className="text-gray-600 mt-1">
                        Create and collaborate on documents, sheets, slides, and boards in real-time
                    </p>
                </div>

                {/* Document types */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Text Documents */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition cursor-pointer">
                        <div className="text-3xl mb-3">📄</div>
                        <h3 className="font-semibold text-gray-900">Text Documents</h3>
                        <p className="text-sm text-gray-600 mt-2">
                            Rich text editing with real-time collaboration (Tiptap)
                        </p>
                        <button className="mt-4 w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium">
                            New Document
                        </button>
                    </div>

                    {/* Spreadsheets */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition cursor-pointer">
                        <div className="text-3xl mb-3">📊</div>
                        <h3 className="font-semibold text-gray-900">Spreadsheets</h3>
                        <p className="text-sm text-gray-600 mt-2">
                            Excel-like spreadsheets with synchronized cells
                        </p>
                        <button className="mt-4 w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium">
                            New Sheet
                        </button>
                    </div>

                    {/* Presentations */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition cursor-pointer">
                        <div className="text-3xl mb-3">🎪</div>
                        <h3 className="font-semibold text-gray-900">Presentations</h3>
                        <p className="text-sm text-gray-600 mt-2">
                            PowerPoint-like slides with collaborative editing
                        </p>
                        <button className="mt-4 w-full px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm font-medium">
                            New Presentation
                        </button>
                    </div>

                    {/* Boards */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition cursor-pointer">
                        <div className="text-3xl mb-3">📋</div>
                        <h3 className="font-semibold text-gray-900">Kanban Boards</h3>
                        <p className="text-sm text-gray-600 mt-2">
                            Trello-like boards for task management and workflows
                        </p>
                        <button className="mt-4 w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm font-medium">
                            New Board
                        </button>
                    </div>
                </div>

                {/* Features */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mt-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">✨ Features</h2>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                        <li>✅ Real-time collaboration with multiple users</li>
                        <li>✅ Automatic synchronization using Y.js</li>
                        <li>✅ Cursor and selection awareness</li>
                        <li>✅ Document persistence to PostgreSQL</li>
                        <li>✅ Share with team members</li>
                        <li>✅ Edit history and version tracking</li>
                        <li>✅ Works offline (sync when back online)</li>
                        <li>✅ Mobile friendly</li>
                    </ul>
                </div>

                {/* Architecture info */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3">🏗️ Architecture</h2>
                    <ul className="text-sm text-gray-700 space-y-2">
                        <li>
                            <strong>Backend:</strong> Rust (Axum) + Yrs CRDT on port 3010
                        </li>
                        <li>
                            <strong>Frontend:</strong> Next.js + React with Y.js bindings
                        </li>
                        <li>
                            <strong>Transport:</strong> WebSocket for real-time sync
                        </li>
                        <li>
                            <strong>Storage:</strong> PostgreSQL with Y.js binary format
                        </li>
                        <li>
                            <strong>Editors:</strong> Tiptap (text), FortuneSheet (sheet), Reveal.js (slides)
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
