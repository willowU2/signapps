'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FileText, Trash } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface DocMeta {
    id: string;
    title: string;
    type: 'text' | 'sheet' | 'slide' | 'board';
    lastOpened: number;
}

export default function DocsDashboard() {
    const router = useRouter();
    const [recentDocs, setRecentDocs] = useState<DocMeta[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('signapps_recent_docs');
        if (saved) {
            try {
                setRecentDocs(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse recent docs", e);
            }
        }
    }, []);

    const saveDoc = (doc: DocMeta) => {
        const updated = [doc, ...recentDocs.filter(d => d.id !== doc.id)].slice(0, 50);
        setRecentDocs(updated);
        localStorage.setItem('signapps_recent_docs', JSON.stringify(updated));
    };

    const handleNewDoc = (type: 'text' | 'sheet' | 'slide' | 'board') => {
        if (type === 'text') {
            const id = crypto.randomUUID();
            const newDoc: DocMeta = {
                id,
                title: 'Untitled Document',
                type,
                lastOpened: Date.now()
            };
            saveDoc(newDoc);
            router.push(`/docs/editor/${id}`);
        } else {
            alert(`New ${type} not implemented yet`);
        }
    };

    const deleteDoc = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Remove from recent list?')) {
            const updated = recentDocs.filter(d => d.id !== id);
            setRecentDocs(updated);
            localStorage.setItem('signapps_recent_docs', JSON.stringify(updated));
        }
    }

    if (!mounted) return null;

    return (
        <div className="space-y-8">
            {/* Create New Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Text Documents */}
                <div
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition cursor-pointer group"
                    onClick={() => handleNewDoc('text')}
                >
                    <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">📄</div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Blank Document</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        Start a new text document
                    </p>
                </div>

                {/* Spreadsheets (Placeholder) */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition cursor-pointer opacity-70">
                    <div className="text-3xl mb-3">📊</div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Blank Spreadsheet</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        Coming soon
                    </p>
                </div>

                {/* Presentations (Placeholder) */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition cursor-pointer opacity-70">
                    <div className="text-3xl mb-3">🎪</div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Blank Presentation</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        Coming soon
                    </p>
                </div>
            </div>

            {/* Recent Documents List */}
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Recent Documents</h2>
                {recentDocs.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                        <p className="text-gray-500">No recent documents found</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                                <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase font-medium">
                                    <tr>
                                        <th className="px-6 py-3">Name</th>
                                        <th className="px-6 py-3">Owner</th>
                                        <th className="px-6 py-3">Last Opened</th>
                                        <th className="px-6 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                    {recentDocs.map((doc) => (
                                        <tr
                                            key={doc.id}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                                            onClick={() => router.push(`/docs/editor/${doc.id}`)}
                                        >
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100 flex items-center gap-3">
                                                <FileText className="h-5 w-5 text-blue-500" />
                                                {doc.title || `Untitled Document (${doc.id.slice(0, 6)})`}
                                            </td>
                                            <td className="px-6 py-4">me</td>
                                            <td className="px-6 py-4">
                                                {formatDistanceToNow(doc.lastOpened, { addSuffix: true })}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={(e) => deleteDoc(e, doc.id)}
                                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-red-500 transition-colors"
                                                    title="Remove from recent"
                                                >
                                                    <Trash className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
