"use client";

import { useState } from "react";
import NextImage from "next/image";
import { User } from "lucide-react";

type StatusType = "online" | "away" | "busy" | "offline";

interface PresenceStatusProps {
  userName?: string;
  status?: StatusType;
  avatarUrl?: string;
  avatarInitials?: string;
}

export function PresenceStatus({
  userName = "User",
  status = "online",
  avatarUrl,
  avatarInitials,
}: PresenceStatusProps) {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const getStatusColor = (status: StatusType) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "away":
        return "bg-yellow-500";
      case "busy":
        return "bg-red-500";
      case "offline":
        return "bg-gray-400";
    }
  };

  const getStatusLabel = (status: StatusType) => {
    switch (status) {
      case "online":
        return "Online";
      case "away":
        return "Away";
      case "busy":
        return "Busy";
      case "offline":
        return "Offline";
    }
  };

  const initials =
    avatarInitials ||
    userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
    >
      <div className="relative h-10 w-10 flex-shrink-0">
        {avatarUrl ? (
          <NextImage
            src={avatarUrl}
            alt={userName}
            width={40}
            height={40}
            className="rounded-full object-cover border border-slate-200"
          />
        ) : (
          <div className="h-full w-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border border-slate-200">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
        )}

        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${getStatusColor(status)}`}
        />
      </div>

      {isTooltipVisible && (
        <div className="absolute left-12 bottom-0 z-50 whitespace-nowrap">
          <div className="bg-slate-900 text-white text-xs rounded-md px-3 py-2 shadow-lg">
            <p className="font-medium">{userName}</p>
            <p className="text-slate-300">{getStatusLabel(status)}</p>
            <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
          </div>
        </div>
      )}
    </div>
  );
}
