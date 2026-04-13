"use client";

import dynamic from "next/dynamic";

const CollaborativeEditor = dynamic(
  () =>
    import("../ai/collaborative-editor").then((m) => ({
      default: m.CollaborativeEditor,
    })),
  {
    loading: () => <div className="h-96 animate-pulse rounded bg-muted" />,
    ssr: false,
  },
);

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
