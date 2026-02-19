'use client';

import { useRouter } from 'next/navigation';

export default function DocsDashboard() {
    const router = useRouter();

    const handleNewDoc = (type: 'text' | 'sheet' | 'slide' | 'board') => {
        const id = crypto.randomUUID();
        if (type === 'text') {
            router.push(`/docs/editor/${id}`);
        } else {
            // Placeholder for other types
            alert(`New ${type} not implemented yet`);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Text Documents */}
            <div
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition cursor-pointer"
                onClick={() => handleNewDoc('text')}
            >
                <div className="text-3xl mb-3">📄</div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Text Documents</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Rich text editing with real-time collaboration (Tiptap)
                </p>
                <button
                    className="mt-4 w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleNewDoc('text');
                    }}
                >
                    New Document
                </button>
            </div>

            {/* Spreadsheets */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition cursor-pointer opacity-70">
                <div className="text-3xl mb-3">📊</div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Spreadsheets</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Excel-like spreadsheets with synchronized cells
                </p>
                <button className="mt-4 w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium cursor-not-allowed">
                    New Sheet
                </button>
            </div>

            {/* Presentations */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition cursor-pointer opacity-70">
                <div className="text-3xl mb-3">🎪</div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Presentations</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    PowerPoint-like slides with collaborative editing
                </p>
                <button className="mt-4 w-full px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm font-medium cursor-not-allowed">
                    New Presentation
                </button>
            </div>

            {/* Boards */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition cursor-pointer opacity-70">
                <div className="text-3xl mb-3">📋</div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Kanban Boards</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Trello-like boards for task management and workflows
                </p>
                <button className="mt-4 w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm font-medium cursor-not-allowed">
                    New Board
                </button>
            </div>
        </div>
    );
}
