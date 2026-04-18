import { FileGridItem } from "@/components/storage/file-grid-item";
import { FileListItem } from "@/components/storage/file-list-item";
import { FileItem, DriveView } from "@/components/storage/types";
import { VirtualList } from "@/components/common/virtual-list";

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

// Row height for list-mode file entries (see file-list-item.tsx).
const FILE_ROW_HEIGHT = 48;
// Threshold above which virtualisation kicks in — below that, avoid the
// extra layout cost of absolute-positioned rows.
const VIRTUALISE_MIN = 40;

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

  const useVirtual = files.length >= VIRTUALISE_MIN;

  return (
    <div className="space-y-1 bg-background dark:bg-[#202124] rounded-2xl border border-[#dadce0] dark:border-[#5f6368] overflow-hidden flex flex-col">
      <div className="grid grid-cols-12 px-4 py-3 text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] border-b border-[#dadce0] dark:border-[#5f6368] shrink-0">
        <div className="col-span-6 ml-9">Nom</div>
        <div className="col-span-3 hidden sm:block">Date de modification</div>
        <div className="col-span-2 hidden sm:block text-right">Taille</div>
        <div className="col-span-1"></div>
      </div>
      {useVirtual ? (
        <VirtualList
          items={files}
          estimateSize={() => FILE_ROW_HEIGHT}
          overscan={15}
          className="flex-1 min-h-[400px] p-1"
          renderItem={(file) => (
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
          )}
        />
      ) : (
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
      )}
    </div>
  );
}
