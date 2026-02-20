'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FileText, MoreVertical, Search, Grid, List as ListIcon, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('signapps_recent_docs');
        if (saved) {
            try {
                // Sort by last opened
                const docs: DocMeta[] = JSON.parse(saved);
                setRecentDocs(docs.sort((a, b) => b.lastOpened - a.lastOpened));
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
                title: 'Untitled document',
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
    };

    if (!mounted) return null;

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col w-full h-full">
            {/* Start a new document section (Gray background) */}
            <div className="bg-[#f1f3f4] dark:bg-[#1f1f1f] py-4 md:py-8 shrink-0">
                <div className="max-w-[1000px] mx-auto px-4 sm:px-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-medium text-gray-700 dark:text-gray-300">Start a new document</h2>
                    </div>
                    <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 custom-scrollbar hide-scrollbar-on-mobile">
                        {/* Blank Document Template */}
                        <div className="flex flex-col gap-2 shrink-0 group cursor-pointer" onClick={() => handleNewDoc('text')}>
                            <div className="w-[140px] h-[180px] sm:w-[160px] sm:h-[200px] bg-white dark:bg-[#2d2e30] border border-gray-200 dark:border-gray-700 rounded shadow-sm group-hover:border-blue-500 transition-colors flex items-center justify-center relative overflow-hidden">
                                <div className="absolute inset-x-0 bottom-0 top-[20%] opacity-0 group-hover:opacity-10 transition-opacity bg-blue-500" />
                                <div className="w-[80px] h-[80px] text-5xl flex items-center justify-center text-blue-500">
                                    +
                                </div>
                            </div>
                            <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">Blank</span>
                        </div>

                        {/* Dummy Templates */}
                        {['Resume', 'Letter', 'Project Proposal', 'Brochure'].map((template) => (
                            <div key={template} className="flex flex-col gap-2 shrink-0 group cursor-not-allowed opacity-70">
                                <div className="w-[140px] h-[180px] sm:w-[160px] sm:h-[200px] bg-white dark:bg-[#2d2e30] border border-gray-200 dark:border-gray-700 rounded shadow-sm flex flex-col relative overflow-hidden">
                                    {/* Mock template lines */}
                                    <div className="p-4 flex flex-col gap-2 w-full h-full">
                                        <div className="w-2/3 h-2 bg-gray-200 dark:bg-gray-700 rounded" />
                                        <div className="w-1/2 h-2 bg-gray-200 dark:bg-gray-700 rounded" />
                                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded mt-4" />
                                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded" />
                                        <div className="w-5/6 h-2 bg-gray-200 dark:bg-gray-700 rounded" />
                                    </div>
                                </div>
                                <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">{template}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Documents section (White background) */}
            <div className="bg-white dark:bg-gray-950 flex-1 pb-20">
                <div className="max-w-[1000px] mx-auto px-4 sm:px-6 pt-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-base font-medium text-gray-800 dark:text-gray-200">Recent documents</h2>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setViewMode('list')}
                                className={cn("p-2 rounded-full transition-colors", viewMode === 'list' ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800")}
                            >
                                <ListIcon className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={cn("p-2 rounded-full transition-colors", viewMode === 'grid' ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800")}
                            >
                                <Grid className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {recentDocs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-32 h-32 mb-6 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center text-5xl">
                                📝
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 text-lg">No text documents yet</p>
                            <span className="text-gray-400 dark:text-gray-500 text-sm mt-1">Click + to create a new document.</span>
                        </div>
                    ) : (
                        viewMode === 'list' ? (
                            <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                                <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                                    <thead className="bg-gray-50/50 dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold w-full">Name</th>
                                            <th className="px-4 py-3 font-semibold whitespace-nowrap hidden sm:table-cell">Owned by any</th>
                                            <th className="px-4 py-3 font-semibold whitespace-nowrap hidden md:table-cell">Last opened</th>
                                            <th className="px-2 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                        {recentDocs.map((doc) => (
                                            <tr
                                                key={doc.id}
                                                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors group"
                                                onClick={() => router.push(`/docs/editor/${doc.id}`)}
                                            >
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 flex items-center gap-3">
                                                    <FileText className="h-5 w-5 text-blue-500 shrink-0" fill="currentColor" fillOpacity={0.1} />
                                                    <span className="truncate">{doc.title || 'Untitled document'}</span>
                                                </td>
                                                <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">me</td>
                                                <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap">
                                                    {formatDistanceToNow(doc.lastOpened, { addSuffix: true })}
                                                </td>
                                                <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button className="p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                                                                <MoreVertical className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={(e) => deleteDoc(e as unknown as React.MouseEvent, doc.id)} className="text-red-500 cursor-pointer">
                                                                <Trash2 className="w-4 h-4 mr-2" />
                                                                Remove
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {recentDocs.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="group cursor-pointer flex flex-col rounded-md border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all bg-white dark:bg-[#2d2e30]"
                                        onClick={() => router.push(`/docs/editor/${doc.id}`)}
                                    >
                                        <div className="h-[140px] sm:h-[180px] border-b border-gray-200 dark:border-gray-800 relative bg-gray-50/50 dark:bg-[#1a1a1a] overflow-hidden flex flex-col p-4">
                                            {/* mock text content */}
                                            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700/50 rounded mb-2" />
                                            <div className="w-5/6 h-1.5 bg-gray-200 dark:bg-gray-700/50 rounded mb-2" />
                                            <div className="w-4/6 h-1.5 bg-gray-200 dark:bg-gray-700/50 rounded" />

                                            <div className="absolute inset-0 bg-gradient-to-t from-white/90 dark:from-[#2d2e30]/90 to-transparent pointer-events-none" />
                                        </div>
                                        <div className="p-3 flex items-start gap-3">
                                            <FileText className="h-4 w-4 text-blue-500 mt-1 shrink-0" fill="currentColor" fillOpacity={0.1} />
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-[13px] font-medium text-gray-900 dark:text-white truncate">
                                                    {doc.title || 'Untitled document'}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                        Opened {formatDistanceToNow(doc.lastOpened, { addSuffix: true })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition">
                                                            <MoreVertical className="h-4 w-4 text-gray-500" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={(e) => deleteDoc(e as unknown as React.MouseEvent, doc.id)} className="text-red-500 cursor-pointer">
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Remove
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
