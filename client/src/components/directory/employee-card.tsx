"use client";

import { Mail, Phone, Briefcase } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface EmployeeCardProps {
  name: string;
  title: string;
  department: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  className?: string;
}

export function EmployeeCard({
  name,
  title,
  department,
  email,
  phone,
  avatarUrl,
  className,
}: EmployeeCardProps) {
  const getInitials = (fullName: string) => {
    return fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const departmentColors: Record<string, { bg: string; text: string }> = {
    engineering: {
      bg: "bg-blue-500/15",
      text: "text-blue-700 dark:text-blue-300",
    },
    product: {
      bg: "bg-purple-500/15",
      text: "text-purple-700 dark:text-purple-300",
    },
    design: {
      bg: "bg-pink-500/15",
      text: "text-pink-700 dark:text-pink-300",
    },
    marketing: {
      bg: "bg-orange-500/15",
      text: "text-orange-700 dark:text-orange-300",
    },
    sales: {
      bg: "bg-green-500/15",
      text: "text-green-700 dark:text-green-300",
    },
    operations: {
      bg: "bg-amber-500/15",
      text: "text-amber-700 dark:text-amber-300",
    },
    hr: {
      bg: "bg-red-500/15",
      text: "text-red-700 dark:text-red-300",
    },
    finance: {
      bg: "bg-slate-500/15",
      text: "text-slate-700 dark:text-slate-300",
    },
  };

  const deptColor = departmentColors[department.toLowerCase()] || {
    bg: "bg-gray-500/15",
    text: "text-muted-foreground dark:text-gray-300",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50 bg-card/80 shadow-sm hover:shadow-md hover:border-border transition-all",
        className
      )}
    >
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50 pointer-events-none" />

      <div className="relative p-6">
        {/* Avatar Section */}
        <div className="flex justify-center mb-4">
          <Avatar className="h-20 w-20 border-4 border-primary/20 shadow-sm">
            {avatarUrl && (
              <AvatarImage src={avatarUrl} alt={name} className="object-cover" />
            )}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Name & Title */}
        <div className="text-center mb-4">
          <h3 className="font-bold text-lg text-foreground truncate">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground font-medium">
            {title}
          </p>
        </div>

        {/* Department Badge */}
        <div className="flex justify-center mb-4">
          <Badge
            variant="secondary"
            className={cn(
              "text-xs font-semibold px-3 py-1 border-0",
              deptColor.bg,
              deptColor.text
            )}
          >
            <Briefcase className="h-3 w-3 mr-1" />
            {department}
          </Badge>
        </div>

        {/* Contact Info */}
        <div className="space-y-2 border-t border-border/40 pt-4">
          {email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <a
                href={`mailto:${email}`}
                className="text-primary hover:underline truncate"
              >
                {email}
              </a>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <a
                href={`tel:${phone}`}
                className="text-primary hover:underline"
              >
                {phone}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
