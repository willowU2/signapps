"use client";

import { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  User,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  TrackChange,
  ChangeType,
} from "@/components/docs/extensions/track-changes";

interface TrackChangesSidebarProps {
  changes: TrackChange[];
  activeChangeId: string | null;
  onChangeClick: (changeId: string) => void;
  onAcceptChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onClose?: () => void;
  className?: string;
}

type FilterType = "all" | "insertion" | "deletion";
type SortType = "newest" | "oldest" | "author";

export function TrackChangesSidebar({
  changes,
  activeChangeId,
  onChangeClick,
  onAcceptChange,
  onRejectChange,
  onAcceptAll,
  onRejectAll,
  onClose,
  className,
}: TrackChangesSidebarProps) {
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortType, setSortType] = useState<SortType>("newest");
  const [filterAuthor, setFilterAuthor] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

  // Get unique authors
  const authors = useMemo(() => {
    const authorSet = new Set(changes.map((c) => c.author));
    return Array.from(authorSet);
  }, [changes]);

  // Filter and sort changes
  const filteredChanges = useMemo(() => {
    let result = changes.filter((c) => !c.accepted && !c.rejected);

    // Filter by type
    if (filterType !== "all") {
      result = result.filter((c) => c.type === filterType);
    }

    // Filter by author
    if (filterAuthor) {
      result = result.filter((c) => c.author === filterAuthor);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortType) {
        case "newest":
          return (
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        case "oldest":
          return (
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        case "author":
          return a.author.localeCompare(b.author);
        default:
          return 0;
      }
    });

    return result;
  }, [changes, filterType, filterAuthor, sortType]);

  // Group changes by date
  const groupedChanges = useMemo(() => {
    const groups: Record<string, TrackChange[]> = {};

    filteredChanges.forEach((change) => {
      const date = new Date(change.timestamp).toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      if (!groups[date]) {
        groups[date] = [];
        // Initialize as expanded
        if (expandedGroups[date] === undefined) {
          setExpandedGroups((prev) => ({ ...prev, [date]: true }));
        }
      }
      groups[date].push(change);
    });

    return groups;
  }, [filteredChanges, expandedGroups]);

  const toggleGroup = (date: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  // Stats
  const insertionCount = filteredChanges.filter(
    (c) => c.type === "insertion",
  ).length;
  const deletionCount = filteredChanges.filter(
    (c) => c.type === "deletion",
  ).length;

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-background border-l border-border",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold text-sm">Suivi des modifications</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filteredChanges.length} modification
            {filteredChanges.length > 1 ? "s" : ""} en attente
          </p>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Stats & Filters */}
      <div className="p-3 border-b space-y-2">
        {/* Stats badges */}
        <div className="flex items-center gap-2">
          <Badge
            variant={filterType === "insertion" ? "default" : "outline"}
            className={cn(
              "cursor-pointer",
              filterType === "insertion"
                ? "bg-green-500 hover:bg-green-600"
                : "text-green-600 border-green-300 hover:bg-green-50",
            )}
            onClick={() =>
              setFilterType(filterType === "insertion" ? "all" : "insertion")
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            {insertionCount} insertion{insertionCount > 1 ? "s" : ""}
          </Badge>
          <Badge
            variant={filterType === "deletion" ? "default" : "outline"}
            className={cn(
              "cursor-pointer",
              filterType === "deletion"
                ? "bg-red-500 hover:bg-red-600"
                : "text-red-600 border-red-300 hover:bg-red-50",
            )}
            onClick={() =>
              setFilterType(filterType === "deletion" ? "all" : "deletion")
            }
          >
            <Minus className="h-3 w-3 mr-1" />
            {deletionCount} suppression{deletionCount > 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2">
          {/* Author filter */}
          {authors.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <User className="h-3 w-3 mr-1" />
                  {filterAuthor || "Tous les auteurs"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setFilterAuthor(null)}>
                  Tous les auteurs
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {authors.map((author) => (
                  <DropdownMenuCheckboxItem
                    key={author}
                    checked={filterAuthor === author}
                    onCheckedChange={() =>
                      setFilterAuthor(filterAuthor === author ? null : author)
                    }
                  >
                    {author}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                Trier
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuCheckboxItem
                checked={sortType === "newest"}
                onCheckedChange={() => setSortType("newest")}
              >
                Plus récent
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortType === "oldest"}
                onCheckedChange={() => setSortType("oldest")}
              >
                Plus ancien
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortType === "author"}
                onCheckedChange={() => setSortType("author")}
              >
                Par auteur
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Changes list */}
      <ScrollArea className="flex-1">
        {Object.keys(groupedChanges).length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-sm">Aucune modification en attente</p>
          </div>
        ) : (
          <div className="p-2">
            {Object.entries(groupedChanges).map(([date, dateChanges]) => (
              <div key={date} className="mb-2">
                {/* Date group header */}
                <button
                  className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent rounded-sm"
                  onClick={() => toggleGroup(date)}
                >
                  <span className="capitalize">{date}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px]">{dateChanges.length}</span>
                    {expandedGroups[date] ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </button>

                {/* Changes in this group */}
                {expandedGroups[date] && (
                  <div className="space-y-1 mt-1">
                    {dateChanges.map((change) => (
                      <div
                        key={change.id}
                        className={cn(
                          "p-2 rounded-md border cursor-pointer transition-colors",
                          activeChangeId === change.id
                            ? "border-primary bg-primary/5"
                            : "border-transparent hover:bg-accent",
                        )}
                        onClick={() => onChangeClick(change.id)}
                      >
                        {/* Change header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full",
                                change.type === "insertion"
                                  ? "bg-green-500"
                                  : "bg-red-500",
                              )}
                            />
                            <User className="h-3 w-3" />
                            <span className="font-medium">{change.author}</span>
                            <Clock className="h-3 w-3 ml-1" />
                            <span>
                              {new Date(change.timestamp).toLocaleTimeString(
                                "fr-FR",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAcceptChange(change.id);
                              }}
                              title="Accepter"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRejectChange(change.id);
                              }}
                              title="Rejeter"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Change content */}
                        <p
                          className={cn(
                            "text-sm mt-1.5 break-words",
                            change.type === "insertion" &&
                              "text-green-700 dark:text-green-400",
                            change.type === "deletion" &&
                              "text-red-700 dark:text-red-400 line-through",
                          )}
                        >
                          {change.type === "insertion"
                            ? change.newContent
                            : change.originalContent}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer actions */}
      {filteredChanges.length > 0 && (
        <div className="p-3 border-t flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-green-600 border-green-300 hover:bg-green-50"
            onClick={onAcceptAll}
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Tout accepter
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
            onClick={onRejectAll}
          >
            <XCircle className="h-4 w-4 mr-1.5" />
            Tout rejeter
          </Button>
        </div>
      )}
    </div>
  );
}
