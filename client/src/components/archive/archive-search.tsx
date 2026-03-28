"use client";

import { useEffect, useState } from "react";
import { Search, Calendar, HardDrive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ArchivedItem {
  id: string;
  name: string;
  archivedDate: Date;
  size: number;
}

export function ArchiveSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<ArchivedItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (hasSearched && searchQuery) {
      setResults([
        { id: "a1", name: "Q1_Report_2023.pdf", archivedDate: new Date(Date.now() - 90 * 24 * 3600000), size: 2.5 },
        { id: "a2", name: "ProjectArchive_Jan.zip", archivedDate: new Date(Date.now() - 120 * 24 * 3600000), size: 15.8 },
        { id: "a3", name: "OldBackup_2023.tar.gz", archivedDate: new Date(Date.now() - 180 * 24 * 3600000), size: 45.2 },
      ]);
    }
  }, [searchQuery, hasSearched]);

  const handleSearch = () => {
    setHasSearched(true);
  };

  const formatSize = (mb: number) => {
    if (mb > 1024) return (mb / 1024).toFixed(1) + " GB";
    return mb.toFixed(1) + " MB";
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-4 bg-blue-50">
        <label className="block font-semibold mb-3">Search Archived Items</label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, type, or date range..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-10 pr-3 py-2 border rounded"
            />
          </div>
          <Button onClick={handleSearch}>Rechercher</Button>
        </div>
      </div>

      {hasSearched && results.length === 0 && searchQuery && (
        <div className="border rounded-lg p-8 text-center bg-gray-50">
          <p className="text-gray-600">Aucun résultat trouvé for "{searchQuery}"</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">Found {results.length} item(s)</h3>
          {results.map((item) => (
            <div key={item.id} className="border rounded-lg p-4 flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-medium mb-2">{item.name}</h4>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>Archived: {item.archivedDate.toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <HardDrive className="w-4 h-4" />
                    <span>{formatSize(item.size)}</span>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}

      {!hasSearched && (
        <div className="border rounded-lg p-8 text-center bg-gray-50">
          <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Enter a search query to find archived items</p>
        </div>
      )}
    </div>
  );
}
