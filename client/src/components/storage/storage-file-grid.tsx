import { FileGridItem } from "@/components/storage/file-grid-item";
import { FileListItem } from "@/components/storage/file-list-item";
import { FileItem, DriveView } from "@/components/storage/types";

interface StorageFileGridProps {
  files: FileItem[];
  viewMode: "grid" | "list" | "tree";
  driveView: DriveView;
  onNavigate: (file: FileItem) => void;
  onPreview: (file: FileItem) => void;
  onAction: (action: string, item: FileItem) => void;
  selectedKeys?: Set<string>;
  onToggleSelect?: (key: string) => void;
}

export function StorageFileGrid({
  files,
  viewMode,
  driveView,
  onNavigate,
  onPreview,
  onAction,
  selectedKeys,
  onToggleSelect,
}: StorageFileGridProps) {
  if (viewMode === "grid" || viewMode === "tree") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {files.map((file) => (
          <FileGridItem
            key={file.key}
            item={file}
            onNavigate={() => onNavigate(file)}
            onPreview={() => onPreview(file)}
            onAction={onAction}
            viewMode={driveView}
            selected={selectedKeys?.has(file.key)}
            onSelect={
              onToggleSelect ? () => onToggleSelect(file.key) : undefined
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1 bg-background dark:bg-[#202124] rounded-2xl border border-[#dadce0] dark:border-[#5f6368] overflow-hidden">
      <div className="grid grid-cols-12 px-4 py-3 text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] border-b border-[#dadce0] dark:border-[#5f6368]">
        <div className="col-span-6 ml-9">Nom</div>
        <div className="col-span-3 hidden sm:block">Date de modification</div>
        <div className="col-span-2 hidden sm:block text-right">Taille</div>
        <div className="col-span-1"></div>
      </div>
      <div className="p-1">
        {files.map((file) => (
          <FileListItem
            key={file.key}
            item={file}
            onNavigate={() => onNavigate(file)}
            onPreview={() => onPreview(file)}
            onAction={onAction}
            viewMode={driveView}
            selected={selectedKeys?.has(file.key)}
            onSelect={
              onToggleSelect ? () => onToggleSelect(file.key) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
