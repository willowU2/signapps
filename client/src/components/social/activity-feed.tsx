"use client";

import { useState } from "react";
import { Heart, MessageCircle, Send } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface FeedPost {
  id: string;
  author: {
    name: string;
    avatar?: string;
    title: string;
  };
  content: string;
  timestamp: Date;
  likes: number;
  comments: number;
}

interface ActivityFeedProps {
  posts: FeedPost[];
  onPostSubmit?: (content: string) => void;
}

export function ActivityFeed({ posts, onPostSubmit }: ActivityFeedProps) {
  const [composeText, setComposeText] = useState("");
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const toggleLike = (postId: string) => {
    const newLiked = new Set(likedPosts);
    if (newLiked.has(postId)) {
      newLiked.delete(postId);
    } else {
      newLiked.add(postId);
    }
    setLikedPosts(newLiked);
  };

  const handlePostSubmit = () => {
    if (composeText.trim()) {
      onPostSubmit?.(composeText);
      setComposeText("");
    }
  };

  const formatTime = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="space-y-4 w-full max-w-2xl">
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex gap-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback>You</AvatarFallback>
            </Avatar>
            <Input
              placeholder="Share your thoughts..."
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) handlePostSubmit();
              }}
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handlePostSubmit}
              disabled={!composeText.trim()}
            >
              <Send className="w-4 h-4 mr-2" /> Post
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {posts.map((post) => (
          <Card key={post.id} className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={post.author.avatar} alt={post.author.name} />
                <AvatarFallback>{post.author.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="font-semibold text-sm">{post.author.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {post.author.title}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatTime(post.timestamp)}
                </p>
              </div>
            </div>

            <p className="text-sm leading-relaxed">{post.content}</p>

            <div className="flex gap-4 pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleLike(post.id)}
                className={likedPosts.has(post.id) ? "text-red-500" : ""}
              >
                <Heart
                  className={`w-4 h-4 mr-1 ${
                    likedPosts.has(post.id) ? "fill-current" : ""
                  }`}
                />
                {post.likes}
              </Button>
              <Button variant="ghost" size="sm">
                <MessageCircle className="w-4 h-4 mr-1" />
                {post.comments}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
