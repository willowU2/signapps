"use client";

import { useState } from "react";
import {
  Search,
  Image,
  Video,
  FileText,
  Download,
  Trash2,
  Tag,
} from "lucide-react";

interface Asset {
  id: string;
  name: string;
  type: "image" | "video" | "doc";
  thumbnail: string;
  size: string;
  uploadedDate: string;
  tags: string[];
  downloads: number;
}

const DEFAULT_ASSETS: Asset[] = [
  {
    id: "1",
    name: "SignApps Logo - Full Color",
    type: "image",
    thumbnail: "bg-blue-100",
    size: "2.4 MB",
    uploadedDate: "2026-03-15",
    tags: ["logo", "brand", "primary"],
    downloads: 45,
  },
  {
    id: "2",
    name: "SignApps Logo - Monochrome",
    type: "image",
    thumbnail: "bg-muted",
    size: "1.8 MB",
    uploadedDate: "2026-03-15",
    tags: ["logo", "brand", "monochrome"],
    downloads: 32,
  },
  {
    id: "3",
    name: "Product Demo Video Q1 2026",
    type: "video",
    thumbnail: "bg-purple-100",
    size: "145 MB",
    uploadedDate: "2026-03-10",
    tags: ["video", "demo", "product"],
    downloads: 28,
  },
  {
    id: "4",
    name: "Brand Guidelines PDF",
    type: "doc",
    thumbnail: "bg-red-100",
    size: "5.2 MB",
    uploadedDate: "2026-03-01",
    tags: ["guidelines", "brand", "document"],
    downloads: 156,
  },
  {
    id: "5",
    name: "Social Media Kit 2026",
    type: "image",
    thumbnail: "bg-pink-100",
    size: "12.3 MB",
    uploadedDate: "2026-02-28",
    tags: ["social", "marketing", "templates"],
    downloads: 78,
  },
  {
    id: "6",
    name: "Case Study - Enterprise Deployment",
    type: "doc",
    thumbnail: "bg-yellow-100",
    size: "3.1 MB",
    uploadedDate: "2026-02-20",
    tags: ["case-study", "enterprise", "success"],
    downloads: 42,
  },
];

function getAssetIcon(type: string) {
  switch (type) {
    case "image":
      return <Image className="w-6 h-6" />;
    case "video":
      return <Video className="w-6 h-6" />;
    case "doc":
      return <FileText className="w-6 h-6" />;
    default:
      return null;
  }
}

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case "image":
      return "bg-blue-100 text-blue-800";
    case "video":
      return "bg-purple-100 text-purple-800";
    case "doc":
      return "bg-red-100 text-red-800";
    default:
      return "bg-muted text-gray-800";
  }
}

export function DAMLibrary() {
  const [assets, setAssets] = useState<Asset[]>(DEFAULT_ASSETS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const allTags = Array.from(
    new Set(assets.flatMap((asset) => asset.tags)),
  ).sort();

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    const matchesTags =
      selectedTags.size === 0 ||
      asset.tags.some((tag) => selectedTags.has(tag));

    return matchesSearch && matchesTags;
  });

  const handleToggleTag = (tag: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(tag)) {
      newSelected.delete(tag);
    } else {
      newSelected.add(tag);
    }
    setSelectedTags(newSelected);
  };

  const handleDeleteAsset = (id: string) => {
    setAssets(assets.filter((a) => a.id !== id));
  };

  const assetStats = {
    total: assets.length,
    images: assets.filter((a) => a.type === "image").length,
    videos: assets.filter((a) => a.type === "video").length,
    docs: assets.filter((a) => a.type === "doc").length,
    totalDownloads: assets.reduce((sum, a) => sum + a.downloads, 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Digital Asset Library
        </h2>
        <p className="text-muted-foreground">
          Manage and organize marketing assets
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <p className="text-sm text-muted-foreground font-medium">
            Total Assets
          </p>
          <p className="text-3xl font-bold text-blue-900">{assetStats.total}</p>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-sm text-muted-foreground font-medium">Images</p>
          <p className="text-3xl font-bold text-green-900">
            {assetStats.images}
          </p>
        </div>
        <div className="rounded-lg border bg-purple-50 p-4">
          <p className="text-sm text-muted-foreground font-medium">Videos</p>
          <p className="text-3xl font-bold text-purple-900">
            {assetStats.videos}
          </p>
        </div>
        <div className="rounded-lg border bg-orange-50 p-4">
          <p className="text-sm text-muted-foreground font-medium">
            Total Downloads
          </p>
          <p className="text-3xl font-bold text-orange-900">
            {assetStats.totalDownloads}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-card text-foreground placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Tag Filters */}
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleToggleTag(tag)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedTags.has(tag)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              <Tag className="w-3 h-3 inline mr-1" />
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Assets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAssets.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed p-12 text-center bg-muted">
            <p className="text-muted-foreground">
              No assets found matching your criteria
            </p>
          </div>
        ) : (
          filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className="rounded-lg border bg-card overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div
                className={`${asset.thumbnail} w-full h-40 flex items-center justify-center border-b`}
              >
                <div className="text-gray-400 opacity-50">
                  {getAssetIcon(asset.type)}
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-foreground text-sm flex-1 leading-tight">
                      {asset.name}
                    </h3>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded flex-shrink-0 ${getTypeBadgeColor(asset.type)}`}
                    >
                      {asset.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{asset.size}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {asset.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">
                      {asset.downloads}
                    </strong>{" "}
                    downloads
                  </p>
                  <div className="flex gap-2">
                    <button className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded">
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAsset(asset.id)}
                      className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-400">
                  Uploaded {new Date(asset.uploadedDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
