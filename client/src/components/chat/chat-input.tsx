import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Send,
  Smile,
  Sparkles,
  Video,
  CheckCircle,
  Bot,
  Bold,
  Italic,
  Code,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VoiceInput } from "@/components/ui/voice-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import EmojiPicker from "emoji-picker-react";
import { FileAttachButton, PendingAttachment } from "./file-attachment";
import { VoiceMessageRecorder } from "./voice-message";
import { ChatAttachment as Attachment } from "@/lib/api/chat";

interface ChatInputProps {
  onSend: (content: string, attachment?: Attachment) => void;
  onSendVoice?: (blob: Blob, durationSec: number) => void;
  channelId?: string;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
}

const SLASH_COMMANDS = [
  {
    command: "summarize",
    description: "Summarize recent messages",
    icon: Sparkles,
    color: "text-purple-500",
  },
  {
    command: "task",
    description: "Create a new task",
    icon: CheckCircle,
    color: "text-blue-500",
  },
  {
    command: "meet",
    description: "Start a video meeting",
    icon: Video,
    color: "text-green-500",
  },
  {
    command: "ask",
    description: "Ask AI a question",
    icon: Bot,
    color: "text-orange-500",
  },
];

export function ChatInput({
  onSend,
  onSendVoice,
  channelId,
  placeholder = "Message...",
  disabled,
  compact = false,
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [interimValue, setInterimValue] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(
    null,
  );
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const displayValue =
    inputValue +
    (interimValue
      ? (inputValue && !inputValue.endsWith(" ") ? " " : "") + interimValue
      : "");

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [displayValue]);

  useEffect(() => {
    setShowCommands(inputValue.startsWith("/"));
  }, [inputValue]);

  const insertFormatting = (prefix: string, suffix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = inputValue.slice(start, end) || "text";
    const before = inputValue.slice(0, start);
    const after = inputValue.slice(end);
    const newVal = `${before}${prefix}${selected}${suffix}${after}`;
    setInputValue(newVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length,
      );
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommands) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCommandIndex((p) => (p + 1) % SLASH_COMMANDS.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCommandIndex(
          (p) => (p - 1 + SLASH_COMMANDS.length) % SLASH_COMMANDS.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleCommandSelect(SLASH_COMMANDS[selectedCommandIndex].command);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowCommands(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCommandSelect = (cmd: string) => {
    setInputValue(`/${cmd} `);
    setShowCommands(false);
    textareaRef.current?.focus();
  };

  const handleSend = () => {
    const final = displayValue.trim();
    if ((!final && !pendingAttachment) || disabled) return;
    onSend(final, pendingAttachment || undefined);
    setInputValue("");
    setInterimValue("");
    setPendingAttachment(null);
  };

  const handleVoiceSend = (blob: Blob, durationSec: number) => {
    onSendVoice?.(blob, durationSec);
    setShowVoiceRecorder(false);
  };

  const canSend = (displayValue.trim() || pendingAttachment) && !disabled;

  return (
    <div className="w-full flex flex-col gap-2 relative">
      {/* Slash Commands Palette */}
      {showCommands && (
        <div className="absolute bottom-full left-0 w-full mb-2 bg-background border rounded-lg shadow-lg overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
          <div className="px-3 py-2 border-b bg-muted/30">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Slash Commands
            </span>
          </div>
          <div className="flex flex-col py-1">
            {SLASH_COMMANDS.map((cmd, idx) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.command}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors",
                    idx === selectedCommandIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/50 text-foreground",
                  )}
                  onClick={() => handleCommandSelect(cmd.command)}
                  onMouseEnter={() => setSelectedCommandIndex(idx)}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-background shadow-sm">
                    <Icon className={cn("h-3.5 w-3.5", cmd.color)} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">
                      /{cmd.command}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {cmd.description}
                    </span>
                  </div>
                  {idx === selectedCommandIndex && (
                    <span className="ml-auto text-[10px] text-muted-foreground font-medium bg-background px-1.5 py-0.5 rounded border">
                      Enter
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Smart tip */}
      {isFocused && !inputValue && !compact && !showCommands && (
        <div className="absolute -top-7 left-2 flex items-center gap-1.5 text-xs text-muted-foreground bg-background border px-2 py-1 rounded-md shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>
            Type <strong className="text-foreground">/</strong> for commands
          </span>
        </div>
      )}

      {/* Pending attachment chip */}
      {pendingAttachment && (
        <div className="flex items-center gap-2 px-2">
          <PendingAttachment
            attachment={pendingAttachment}
            onRemove={() => setPendingAttachment(null)}
          />
        </div>
      )}

      <div
        className={cn(
          "relative flex flex-col bg-background rounded-xl border shadow-sm transition-all duration-200 z-40",
          isFocused
            ? "ring-1 ring-primary border-primary"
            : "hover:border-border/80 border-border bg-muted/30",
          showCommands ? "ring-1 ring-primary border-primary rounded-t-sm" : "",
        )}
      >
        {/* Formatting Toolbar — IDEA-143 */}
        {!compact && (isFocused || inputValue) && !showCommands && (
          <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground w-7 h-7"
                    onClick={() => insertFormatting("**", "**")}
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Bold (**text**)
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground w-7 h-7"
                    onClick={() => insertFormatting("*", "*")}
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Italic (*text*)
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground w-7 h-7"
                    onClick={() => insertFormatting("`", "`")}
                  >
                    <Code className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Inline code
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Main Input Area */}
        <div className="flex items-end gap-2 p-2 relative bg-background rounded-xl">
          {/* File attach — IDEA-134 */}
          {channelId && (
            <FileAttachButton
              channelId={channelId}
              onAttach={(att) => setPendingAttachment(att)}
              disabled={disabled}
            />
          )}

          <textarea
            ref={textareaRef}
            value={displayValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setInterimValue("");
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 max-h-48 min-h-[36px] bg-transparent border-0 resize-none py-2 px-1 focus:outline-none focus:ring-0 text-[15px] leading-relaxed placeholder:text-muted-foreground/70"
          />

          <div className="flex items-center gap-1 shrink-0 pb-0.5">
            {/* Voice message — IDEA-135 */}
            {!showVoiceRecorder && onSendVoice && (
              <VoiceMessageRecorder
                onSend={handleVoiceSend}
                onCancel={() => setShowVoiceRecorder(false)}
              />
            )}

            <VoiceInput
              onTranscription={(text, isFinal) => {
                if (isFinal) {
                  setInputValue(
                    (prev) =>
                      prev +
                      (prev && !prev.endsWith(" ") ? " " : "") +
                      text +
                      " ",
                  );
                  setInterimValue("");
                } else {
                  setInterimValue(text);
                }
              }}
              className="hidden sm:flex"
            />

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground hidden sm:flex"
                >
                  <Smile className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                className="w-auto p-0 border-none shadow-none mb-2"
                sideOffset={10}
              >
                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    setInputValue(
                      (prev) =>
                        prev +
                        (prev && !prev.endsWith(" ") ? " " : "") +
                        emojiData.emoji,
                    );
                  }}
                />
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              className={cn(
                "h-8 w-8 shrink-0 transition-all rounded-lg",
                canSend
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "bg-muted text-muted-foreground",
              )}
              disabled={!canSend}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {!compact && !showCommands && (
        <div className="flex justify-between px-2 text-[10px] text-muted-foreground/60 font-medium tracking-wide">
          <span>
            <strong>Return</strong> to send · <strong>Shift + Return</strong>{" "}
            for new line · **bold** *italic* `code`
          </span>
        </div>
      )}
    </div>
  );
}
