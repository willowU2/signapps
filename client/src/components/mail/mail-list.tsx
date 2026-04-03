import {
  ComponentProps,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { formatDistanceToNow } from "date-fns";

import { cn } from "@/lib/utils";
import {
  Archive,
  Clock,
  Trash2,
  Square,
  Star,
  Loader2,
  ShieldAlert,
  Inbox,
  Reply,
  Forward,
  CheckSquare,
  CalendarPlus,
  Bell,
  FolderPlus,
  Mail as MailIcon,
  MailOpen,
  RefreshCw,
} from "lucide-react";
import { Mail } from "@/lib/data/mail";
import { EmptyState } from "@/components/ui/empty-state";
import { SpamBadge } from "./spam-filter-settings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { EmailToTaskDialog } from "@/components/mail/email-to-task-dialog";
import { EmailToEventDialog } from "@/components/interop/EmailToEventDialog";
import { EmailFollowUpDialog } from "@/components/interop/EmailFollowUpDialog";
import { EmailThreadToProjectDialog } from "@/components/interop/EmailThreadToProject";
import { VirtualList } from "@/components/ui/virtual-list";
import { useSwipeAction } from "@/hooks/use-swipe-action";
import { SnoozeDatePicker } from "./snooze-picker";
// Avatars removed for density-aware layout

const PAGE_SIZE = 20;
// Base row heights per density (controlled via CSS variables set by parent class)
const MAIL_ROW_HEIGHT = 40;

// ─── Idea 37: Priority bar color ────────────────────────────────────────────
function getPriorityColor(mail: Mail): string | null {
  const priority = mail.priority;
  if (priority === 5) return "#ef4444"; // red — urgent
  if (priority === 4) return "#f97316"; // orange
  if (priority === 3) return "#eab308"; // yellow
  if (priority === 2) return "#22c55e"; // green
  if (priority === 1) return "transparent";
  // fallback: derive from subject keywords
  const subj = mail.subject.toLowerCase();
  if (/urgent|asap|critique|critique|bloquant/.test(subj)) return "#ef4444";
  if (/important|priorité/.test(subj)) return "#f97316";
  return null;
}

// ─── Idea 38: Follow-up detection ───────────────────────────────────────────
function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// ─── Idea 40: Sentiment analysis ────────────────────────────────────────────
function getSentiment(mail: Mail): "positive" | "negative" | "neutral" {
  const text = (mail.subject + " " + mail.text).toLowerCase();
  const positive =
    /merci|excellent|bravo|super|parfait|great|thanks|amazing|félicitation|wonderful/.test(
      text,
    );
  const negative =
    /urgent|problème|erreur|bug|plainte|déçu|complaint|issue|échec|failed|error/.test(
      text,
    );
  if (positive && !negative) return "positive";
  if (negative) return "negative";
  return "neutral";
}

interface MailListProps extends Omit<ComponentProps<"div">, "onSelect"> {
  items: Mail[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSnooze?: (id: string, time: string) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onReportSpam?: (id: string) => void;
  onStar?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  spamIds?: Set<string>;
  starredIds?: Set<string>;
  checkedIds?: Set<string>;
  onToggleChecked?: (id: string) => void;
  onToggleCheckAll?: () => void;
  isSearchActive?: boolean;
}

// ─── MailRow — swipe-aware row component ────────────────────────────────────

interface MailRowProps {
  item: Mail;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSnooze?: (id: string, time: string) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onReportSpam?: (id: string) => void;
  onStar?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  spamIds?: Set<string>;
  starredIds?: Set<string>;
  isChecked?: boolean;
  onToggleChecked?: (id: string) => void;
  allItems?: Mail[];
}

function MailRow({
  item,
  selectedId,
  onSelect,
  onSnooze,
  onArchive,
  onDelete,
  onReportSpam,
  onStar,
  onMarkUnread,
  spamIds,
  starredIds,
  isChecked,
  onToggleChecked,
  allItems,
}: MailRowProps) {
  // Idea 37: priority bar
  const priorityColor = getPriorityColor(item);

  // Idea 38: follow-up badge — sent mail older than 3 days with no reply
  const hasReply = allItems?.some(
    (m) => m.in_reply_to === (item.message_id || item.id),
  );
  const showFollowUp = item.is_sent && !hasReply && daysSince(item.date) > 3;

  // Idea 40: sentiment
  const sentiment = getSentiment(item);
  const { handlers: swipeHandlers } = useSwipeAction({
    onSwipeLeft: () => onArchive?.(item.id),
    onSwipeRight: () => onDelete?.(item.id),
  });
  const [taskOpen, setTaskOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  return (
    <>
      <EmailToTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        emailSubject={item.subject}
        emailBody={item.text}
        emailFrom={item.email}
        emailId={item.id}
      />
      <EmailToEventDialog
        open={eventOpen}
        onOpenChange={setEventOpen}
        mail={item}
      />
      <EmailFollowUpDialog
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        mail={item}
      />
      <EmailThreadToProjectDialog
        open={projectOpen}
        onOpenChange={setProjectOpen}
        mail={item}
      />
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            draggable={true}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "copy";
              e.dataTransfer.setData(
                "application/signapps-email",
                JSON.stringify({
                  id: item.id,
                  subject: item.subject,
                  sender: item.email,
                  date: item.date,
                }),
              );
            }}
            onClick={() => onSelect(item.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelect(item.id);
            }}
            className={cn(
              "group relative flex items-center gap-2 px-1 py-0 mail-row text-left text-sm transition-all duration-150 outline-none w-full border-b border-border/60 dark:border-gray-800/60 select-none cursor-pointer hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),_0_4px_8px_3px_rgba(60,64,67,0.15)] hover:z-10",
              isChecked
                ? "bg-primary/5 dark:bg-primary/10"
                : selectedId === item.id
                  ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground"
                  : "bg-background dark:bg-[#1f1f1f] hover:bg-muted/80 dark:hover:bg-[#202124]",
              !item.read && !isChecked && "bg-background dark:bg-[#1f1f1f]",
            )}
            {...swipeHandlers}
          >
            {/* Idea 37: priority bar — 3px left edge */}
            {priorityColor && (
              <span
                className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm"
                style={{ backgroundColor: priorityColor }}
                aria-hidden="true"
              />
            )}
            <div className="flex-shrink-0 flex items-center gap-2 px-3 text-gray-400 dark:text-muted-foreground">
              <button
                type="button"
                aria-label={isChecked ? "Désélectionner" : "Sélectionner"}
                className="bg-transparent border-none p-0 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleChecked?.(item.id);
                }}
              >
                {isChecked ? (
                  <CheckSquare className="h-[18px] w-[18px] text-primary transition-colors" />
                ) : (
                  <Square className="h-[18px] w-[18px] hover:text-muted-foreground dark:hover:text-gray-300 transition-colors" />
                )}
              </button>
              <button
                type="button"
                aria-label={
                  starredIds?.has(item.id)
                    ? "Retirer des favoris"
                    : "Ajouter aux favoris"
                }
                className="bg-transparent border-none p-0 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onStar?.(item.id);
                }}
              >
                <Star
                  className={cn(
                    "h-[18px] w-[18px] transition-colors",
                    starredIds?.has(item.id)
                      ? "text-amber-400 fill-amber-400"
                      : "hover:text-muted-foreground dark:hover:text-gray-300",
                  )}
                />
              </button>
            </div>
            <div className="flex items-center w-full overflow-hidden gap-2 pr-4">
              <span
                className={cn(
                  "w-48 truncate flex-shrink-0 text-[14px]",
                  !item.read
                    ? "text-foreground font-bold"
                    : "text-foreground font-medium",
                )}
              >
                {item.name}
              </span>
              <div className="flex items-center truncate flex-1 text-[14px] gap-1.5">
                {spamIds?.has(item.id) && (
                  <span className="shrink-0 mr-1.5">
                    <SpamBadge />
                  </span>
                )}
                <span
                  className={cn(
                    "truncate",
                    !item.read
                      ? "font-bold text-foreground"
                      : "font-medium text-foreground",
                  )}
                >
                  {item.subject}
                </span>
                <span className="truncate text-muted-foreground ml-2 font-normal hidden sm:inline-block">
                  - {item.text.replace(/\s+/g, " ")}
                </span>
                {/* Idea 40: sentiment icon */}
                {sentiment === "positive" && (
                  <span
                    title="Sentiment positif"
                    className="shrink-0 text-[11px] leading-none"
                  >
                    🙂
                  </span>
                )}
                {sentiment === "negative" && (
                  <span
                    title="Sentiment négatif"
                    className="shrink-0 text-[11px] leading-none"
                  >
                    😟
                  </span>
                )}
                {/* Idea 38: follow-up badge */}
                {showFollowUp && (
                  <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 px-1.5 py-0.5 rounded-full">
                    <RefreshCw className="h-2.5 w-2.5" />
                    Relance ?
                  </span>
                )}
                {/* Idea 29: label colored badges */}
                {item.labels?.slice(0, 2).map((lbl: any) => (
                  <span
                    key={typeof lbl === "string" ? lbl : lbl.id}
                    className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border"
                    style={
                      typeof lbl === "object" && lbl.color
                        ? {
                            backgroundColor: `${lbl.color}20`,
                            color: lbl.color,
                            borderColor: `${lbl.color}40`,
                          }
                        : undefined
                    }
                  >
                    {typeof lbl === "string" ? lbl : lbl.name}
                  </span>
                ))}
              </div>
              <span
                className={cn(
                  "w-24 text-right flex-shrink-0 text-[12px]",
                  !item.read
                    ? "text-foreground font-bold"
                    : "text-muted-foreground font-medium group-hover:hidden",
                )}
              >
                {formatDistanceToNow(new Date(item.date))}
              </span>
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-background dark:bg-[#202124] rounded-md shadow-sm pl-1 pr-1 py-0.5">
              <button
                type="button"
                aria-label="Archiver"
                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-gray-800 transition-colors shadow-none bg-transparent border-none"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive?.(item.id);
                }}
              >
                <Archive className="w-[18px] h-[18px]" />
              </button>
              <button
                type="button"
                aria-label="Supprimer"
                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-gray-800 transition-colors shadow-none bg-transparent border-none"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(item.id);
                }}
              >
                <Trash2 className="w-[18px] h-[18px]" />
              </button>
              <button
                type="button"
                aria-label={
                  starredIds?.has(item.id)
                    ? "Retirer des favoris"
                    : "Ajouter aux favoris"
                }
                className="p-1.5 rounded-full text-muted-foreground hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-500 transition-colors shadow-none bg-transparent border-none"
                onClick={(e) => {
                  e.stopPropagation();
                  onStar?.(item.id);
                }}
              >
                <Star
                  className={cn(
                    "w-[18px] h-[18px]",
                    starredIds?.has(item.id) && "text-amber-400 fill-amber-400",
                  )}
                />
              </button>
              <button
                type="button"
                aria-label="Marquer comme non lu"
                className="p-1.5 rounded-full text-muted-foreground hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-500 transition-colors shadow-none bg-transparent border-none"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkUnread?.(item.id);
                }}
              >
                <MailOpen className="w-[18px] h-[18px]" />
              </button>
              {onReportSpam && (
                <button
                  type="button"
                  aria-label="Signaler comme spam"
                  className="p-1.5 rounded-full text-muted-foreground hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors shadow-none bg-transparent border-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReportSpam(item.id);
                  }}
                >
                  <ShieldAlert className="w-[18px] h-[18px]" />
                </button>
              )}
              <SnoozeDatePicker
                onSnooze={(isoStr, label) => {
                  onSnooze?.(item.id, label);
                }}
              >
                <button
                  type="button"
                  aria-label="Reporter"
                  className="p-1.5 rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-gray-800 transition-colors cursor-pointer shadow-none bg-transparent border-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Clock className="w-[18px] h-[18px]" />
                </button>
              </SnoozeDatePicker>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={() => onSelect(item.id)}>
            <Reply className="h-3.5 w-3.5 mr-2" /> Repondre
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onSelect(item.id)}>
            <Forward className="h-3.5 w-3.5 mr-2" /> Transferer
          </ContextMenuItem>
          <ContextMenuSeparator />
          {/* Interop actions — Features 1, 2, 12, 19 */}
          <ContextMenuItem
            onClick={(e) => {
              e.preventDefault();
              setTaskOpen(true);
            }}
          >
            <CheckSquare className="h-3.5 w-3.5 mr-2 text-emerald-500" /> Créer
            une tâche
          </ContextMenuItem>
          <ContextMenuItem
            onClick={(e) => {
              e.preventDefault();
              setEventOpen(true);
            }}
          >
            <CalendarPlus className="h-3.5 w-3.5 mr-2 text-blue-500" /> Ajouter
            au calendrier
          </ContextMenuItem>
          <ContextMenuItem
            onClick={(e) => {
              e.preventDefault();
              setFollowUpOpen(true);
            }}
          >
            <Bell className="h-3.5 w-3.5 mr-2 text-amber-500" /> Rappel de suivi
          </ContextMenuItem>
          <ContextMenuItem
            onClick={(e) => {
              e.preventDefault();
              setProjectOpen(true);
            }}
          >
            <FolderPlus className="h-3.5 w-3.5 mr-2 text-indigo-500" /> Créer un
            projet
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onStar?.(item.id)}>
            <Star
              className={cn(
                "h-3.5 w-3.5 mr-2",
                starredIds?.has(item.id)
                  ? "text-amber-400 fill-amber-400"
                  : "text-amber-500",
              )}
            />
            {starredIds?.has(item.id)
              ? "Retirer des favoris"
              : "Ajouter aux favoris"}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onMarkUnread?.(item.id)}>
            <MailOpen className="h-3.5 w-3.5 mr-2 text-blue-500" /> Marquer
            comme non lu
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onArchive?.(item.id)}>
            <Archive className="h-3.5 w-3.5 mr-2" /> Archiver
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onSnooze?.(item.id, "Tomorrow")}>
            <Clock className="h-3.5 w-3.5 mr-2" /> Reporter a demain
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={() => onDelete?.(item.id)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  );
}

// ─── MailList ────────────────────────────────────────────────────────────────

export function MailList({
  items,
  selectedId,
  onSelect,
  onSnooze,
  onArchive,
  onDelete,
  onReportSpam,
  onStar,
  onMarkUnread,
  spamIds,
  starredIds,
  checkedIds,
  onToggleChecked,
  onToggleCheckAll,
  isSearchActive,
}: MailListProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  // Reset visible count when items list changes (e.g. folder switch, search)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [items]);

  // IntersectionObserver: load next page when sentinel enters viewport
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0];
      if (entry?.isIntersecting && hasMore) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, items.length));
      }
    },
    [hasMore, items.length],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersect, {
      root: scrollContainerRef.current,
      rootMargin: "0px 0px 200px 0px",
      threshold: 0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect]);

  const allChecked =
    checkedIds != null && items.length > 0 && checkedIds.size === items.length;
  const someChecked = checkedIds != null && checkedIds.size > 0;

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Select-all header */}
      {items.length > 0 && onToggleCheckAll && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border/60 dark:border-gray-800/60 bg-background dark:bg-[#1f1f1f] flex-shrink-0">
          <button
            type="button"
            aria-label={
              allChecked ? "Tout désélectionner" : "Tout sélectionner"
            }
            className="bg-transparent border-none p-0 cursor-pointer text-gray-400 dark:text-muted-foreground"
            onClick={onToggleCheckAll}
          >
            {allChecked ? (
              <CheckSquare className="h-[18px] w-[18px] text-primary transition-colors" />
            ) : (
              <Square className="h-[18px] w-[18px] hover:text-muted-foreground dark:hover:text-gray-300 transition-colors" />
            )}
          </button>
          {someChecked && (
            <span className="text-xs text-muted-foreground">
              {checkedIds.size} sélectionné{checkedIds.size > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
      {/* Virtualised email list — only visible rows are rendered */}
      {items.length === 0 ? (
        isSearchActive ? (
          <EmptyState
            icon={MailIcon}
            context="search"
            title="Aucun résultat"
            description="Aucun email ne correspond à votre recherche."
          />
        ) : (
          /* Idea 20: Custom SVG illustration for empty inbox */
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <svg
              viewBox="0 0 120 100"
              className="w-32 h-28 text-primary/20 mb-6"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Envelope body */}
              <rect
                x="8"
                y="24"
                width="104"
                height="68"
                rx="6"
                fill="currentColor"
                opacity="0.15"
              />
              <rect
                x="8"
                y="24"
                width="104"
                height="68"
                rx="6"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              {/* Envelope flap (open V) */}
              <polyline
                points="8,24 60,64 112,24"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinejoin="round"
                fill="none"
              />
              {/* Checkmark circle */}
              <circle
                cx="90"
                cy="22"
                r="16"
                fill="white"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <polyline
                points="82,22 88,28 98,16"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Vous êtes à jour !
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Aucun message dans cette boîte. Profitez du calme.
            </p>
          </div>
        )
      ) : (
        <VirtualList
          items={items}
          itemHeight={MAIL_ROW_HEIGHT}
          overscan={8}
          className="flex-1"
          onEndReached={() => {
            if (hasMore)
              setVisibleCount((prev) =>
                Math.min(prev + PAGE_SIZE, items.length),
              );
          }}
          getItemKey={(item) => item.id}
          renderItem={(item) => (
            <MailRow
              item={item}
              selectedId={selectedId}
              onSelect={onSelect}
              onSnooze={onSnooze}
              onArchive={onArchive}
              onDelete={onDelete}
              onReportSpam={onReportSpam}
              onStar={onStar}
              onMarkUnread={onMarkUnread}
              spamIds={spamIds}
              starredIds={starredIds}
              isChecked={checkedIds?.has(item.id) ?? false}
              onToggleChecked={onToggleChecked}
              allItems={items}
            />
          )}
        />
      )}
    </div>
  );
}

function getBadgeVariantFromLabel(label: string) {
  if (["work"].includes(label.toLowerCase())) {
    return "bg-slate-100/80 text-slate-700 border-slate-200/50 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700/50";
  }

  if (["personal"].includes(label.toLowerCase())) {
    return "bg-purple-50/80 text-purple-700 border-purple-200/50 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800/50";
  }

  return "bg-muted/80 text-muted-foreground border-border/50 dark:bg-gray-800/80 dark:text-gray-400 dark:border-gray-700/50";
}
