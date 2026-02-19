import Editor from '@/components/docs/editor';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditorPage({ params }: PageProps) {
    const { id } = await params;

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col">
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4">
                <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                    Document: {id}
                </h1>
            </div>
            <div className="flex-1 overflow-hidden p-4 bg-gray-50 dark:bg-gray-950">
                <Editor documentId={id} className="h-full shadow-sm" />
            </div>
        </div>
    );
}
