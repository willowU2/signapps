"use client";

import React, { useState } from "react";
import { Heart, Pin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AnnouncementCategory = "RH" | "Direction" | "IT" | "General";

interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  date: Date;
  category: AnnouncementCategory;
  isPinned: boolean;
  likes: number;
  liked: boolean;
}

interface AnnouncementBoardProps {
  initialAnnouncements?: Announcement[];
  onAnnounceAdd?: (announcement: Omit<Announcement, "id" | "likes" | "liked">) => void;
}

const categoryColors: Record<AnnouncementCategory, string> = {
  RH: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Direction: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  IT: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  General: "bg-muted text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export function AnnouncementBoard({
  initialAnnouncements = [],
  onAnnounceAdd,
}: AnnouncementBoardProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "General" as AnnouncementCategory,
  });

  const handleAddAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    const newAnnouncement: Announcement = {
      id: Date.now().toString(),
      title: formData.title,
      content: formData.content,
      author: "Current User",
      date: new Date(),
      category: formData.category,
      isPinned: false,
      likes: 0,
      liked: false,
    };

    setAnnouncements([newAnnouncement, ...announcements]);
    onAnnounceAdd?.({
      title: newAnnouncement.title,
      content: newAnnouncement.content,
      author: newAnnouncement.author,
      date: newAnnouncement.date,
      category: newAnnouncement.category,
      isPinned: newAnnouncement.isPinned,
    });

    setFormData({ title: "", content: "", category: "General" });
    setFormOpen(false);
    toast.success("Annonce publiée avec succès");
  };

  const togglePin = (id: string) => {
    setAnnouncements(
      announcements.map((a) => (a.id === id ? { ...a, isPinned: !a.isPinned } : a))
    );
  };

  const toggleLike = (id: string) => {
    setAnnouncements(
      announcements.map((a) => {
        if (a.id === id) {
          return {
            ...a,
            liked: !a.liked,
            likes: a.liked ? a.likes - 1 : a.likes + 1,
          };
        }
        return a;
      })
    );
  };

  const removeAnnouncement = (id: string) => {
    setAnnouncements(announcements.filter((a) => a.id !== id));
  };

  const sortedAnnouncements = [...announcements].sort((a, b) =>
    a.isPinned === b.isPinned ? b.date.getTime() - a.date.getTime() : a.isPinned ? -1 : 1
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Announcements</h2>
          <p className="text-sm text-muted-foreground">Company updates and important messages</p>
        </div>
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button>New Announcement</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Post an Announcement</DialogTitle>
              <DialogDescription>
                Share important information with your team
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddAnnouncement} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Announcement title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Content</label>
                <Textarea
                  placeholder="Write your announcement here..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="mt-1"
                  rows={5}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value as AnnouncementCategory,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                >
                  <option value="General">General</option>
                  <option value="RH">HR (RH)</option>
                  <option value="Direction">Management</option>
                  <option value="IT">IT</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Post Announcement</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {sortedAnnouncements.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No announcements yet</p>
            <p className="text-xs text-muted-foreground">Post one to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedAnnouncements.map((announcement) => (
            <Card
              key={announcement.id}
              className={cn(
                "transition-shadow hover:shadow-md",
                announcement.isPinned && "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30"
              )}
            >
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{announcement.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        By {announcement.author} •{" "}
                        {announcement.date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAnnouncement(announcement.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div>
                    <Badge className={categoryColors[announcement.category]}>
                      {announcement.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">{announcement.content}</p>
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleLike(announcement.id)}
                      className={cn(
                        "gap-1",
                        announcement.liked && "text-red-500"
                      )}
                    >
                      <Heart
                        className={cn("h-4 w-4", announcement.liked && "fill-current")}
                      />
                      <span className="text-xs">{announcement.likes}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePin(announcement.id)}
                      className={cn(
                        "gap-1",
                        announcement.isPinned && "text-yellow-500"
                      )}
                    >
                      <Pin
                        className={cn("h-4 w-4", announcement.isPinned && "fill-current")}
                      />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
