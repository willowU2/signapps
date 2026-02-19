import { Metadata } from 'next';
import DocsDashboard from '@/components/docs/dashboard';

export const metadata: Metadata = {
    title: 'Documents - SignApps',
    description: 'Collaborative documents, sheets, slides, and boards',
};

export default function DocsPage() {
    return (
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
            <div className="max-w-7xl mx-auto p-6 space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Collaborative Documents</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg">
                        Create and collaborate on documents, sheets, slides, and boards in real-time.
                    </p>
                </div>

                {/* Document types (client component) */}
                <DocsDashboard />

                {/* Features */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-8">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">✨ Features & Capabilities</h2>
                    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm text-gray-700 dark:text-gray-300">
                        <li className="flex items-start gap-2">
                            <span className="text-green-500 text-lg">✅</span>
                            <span>Real-time collaboration with multiple users</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-500 text-lg">✅</span>
                            <span>Automatic synchronization using Y.js</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-500 text-lg">✅</span>
                            <span>Cursor and selection awareness</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-500 text-lg">✅</span>
                            <span>Document persistence to PostgreSQL</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-500 text-lg">✅</span>
                            <span>Share with team members</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-500 text-lg">✅</span>
                            <span>Edit history and version tracking</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-500 text-lg">✅</span>
                            <span>Works offline (sync when back online)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-500 text-lg">✅</span>
                            <span>Mobile friendly interface</span>
                        </li>
                    </ul>
                </div>

                {/* Architecture info */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">🏗️ System Architecture</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="font-semibold text-sm text-gray-500 dark:text-gray-400 mb-1">Backend</div>
                            <div className="text-gray-900 dark:text-gray-200 font-medium">Rust (Axum) + Yrs CRDT</div>
                            <div className="text-xs text-gray-500 mt-1">High performance sync</div>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="font-semibold text-sm text-gray-500 dark:text-gray-400 mb-1">Frontend</div>
                            <div className="text-gray-900 dark:text-gray-200 font-medium">Next.js + Tiptap</div>
                            <div className="text-xs text-gray-500 mt-1">Rich interactions</div>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="font-semibold text-sm text-gray-500 dark:text-gray-400 mb-1">Transport</div>
                            <div className="text-gray-900 dark:text-gray-200 font-medium">WebSocket</div>
                            <div className="text-xs text-gray-500 mt-1">Real-time updates</div>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="font-semibold text-sm text-gray-500 dark:text-gray-400 mb-1">Storage</div>
                            <div className="text-gray-900 dark:text-gray-200 font-medium">PostgreSQL (Binares)</div>
                            <div className="text-xs text-gray-500 mt-1">Persistent state</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
