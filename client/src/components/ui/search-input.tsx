"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps extends React.ComponentProps<"input"> {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  clearable?: boolean;
}

/**
 * Standard search input: search icon left, optional clear button right.
 * Use everywhere a search/filter input is needed.
 */
export function SearchInput({
  value,
  onValueChange,
  placeholder = "Rechercher...",
  className,
  containerClassName,
  clearable = true,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn("relative", containerClassName)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className={cn("pl-9", clearable && value && "pr-8", className)}
        {...props}
      />
      {clearable && value && (
        <button
          type="button"
          onClick={() => onValueChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Effacer la recherche"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
