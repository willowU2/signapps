"use client";

import { useState } from "react";
import { Trash2, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Bookmark {
  id: string;
  title: string;
  url: string;
  tags: string[];
}

export function BookmarkManager() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    url: "",
    tags: "",
  });

  const addBookmark = () => {
    if (!formData.title.trim() || !formData.url.trim()) {
      toast.error("Title and URL are required");
      return;
    }

    const newBookmark: Bookmark = {
      id: Date.now().toString(),
      title: formData.title.trim(),
      url: formData.url.trim(),
      tags: formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    };

    setBookmarks([...bookmarks, newBookmark]);
    setFormData({ title: "", url: "", tags: "" });
    toast.success("Bookmark added");
  };

  const deleteBookmark = (id: string) => {
    setBookmarks(bookmarks.filter((b) => b.id !== id));
    toast.success("Bookmark deleted");
  };

  const filteredBookmarks = bookmarks.filter((b) => {
    const query = searchFilter.toLowerCase();
    return (
      b.title.toLowerCase().includes(query) ||
      b.url.toLowerCase().includes(query) ||
      b.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Bookmarks</h2>

        <div className="space-y-3">
          <Input
            placeholder="Title"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
          />
          <Input
            placeholder="URL"
            type="url"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          />
          <Input
            placeholder="Tags (comma-separated)"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          />
          <Button onClick={addBookmark} className="w-full gap-2">
            <Plus size={18} />
            Add Bookmark
          </Button>
        </div>

        <Input
          placeholder="Rechercher..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="mt-4"
        />
      </div>

      <div className="space-y-2">
        {filteredBookmarks.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {bookmarks.length === 0
              ? "No bookmarks yet"
              : "No matching bookmarks"}
          </p>
        ) : (
          filteredBookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="border rounded-lg p-4 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:underline font-medium"
                >
                  {bookmark.title}
                  <ExternalLink size={16} />
                </a>
                <p className="text-sm text-muted-foreground break-all">
                  {bookmark.url}
                </p>
                {bookmark.tags.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {bookmark.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteBookmark(bookmark.id)}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
