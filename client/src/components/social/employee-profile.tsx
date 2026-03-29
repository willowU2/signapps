"use client";

import { useState } from "react";
import { Mail, MessageSquare, Phone, Linkedin } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface EmployeeProfileProps {
  id: string;
  name: string;
  title: string;
  bio: string;
  avatar?: string;
  skills: string[];
  posts: number;
  followers: number;
  following: number;
}

export function EmployeeProfile({
  id,
  name,
  title,
  bio,
  avatar,
  skills,
  posts,
  followers,
  following,
}: EmployeeProfileProps) {
  const [isFollowing, setIsFollowing] = useState(false);

  return (
    <Card className="w-full max-w-sm p-6 space-y-4">
      <div className="flex flex-col items-center text-center space-y-3">
        <Avatar className="w-20 h-20">
          <AvatarImage src={avatar} alt={name} />
          <AvatarFallback>{name.charAt(0)}</AvatarFallback>
        </Avatar>

        <div>
          <h2 className="text-xl font-bold">{name}</h2>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>

        <p className="text-sm text-muted-foreground">{bio}</p>
      </div>

      <div className="flex gap-2 flex-wrap justify-center">
        {skills.map((skill) => (
          <Badge key={skill} variant="secondary">
            {skill}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
        <div className="text-center">
          <p className="text-lg font-semibold">{posts}</p>
          <p className="text-xs text-muted-foreground">Posts</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">{followers}</p>
          <p className="text-xs text-muted-foreground">Followers</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">{following}</p>
          <p className="text-xs text-muted-foreground">Following</p>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          variant={isFollowing ? "outline" : "default"}
          onClick={() => setIsFollowing(!isFollowing)}
          className="flex-1"
        >
          {isFollowing ? "Following" : "Follow"}
        </Button>
        <Button variant="outline" size="icon" title="Email">
          <Mail className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" title="Message">
          <MessageSquare className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
