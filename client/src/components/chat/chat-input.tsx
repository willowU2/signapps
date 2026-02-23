import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, Smile, Type, Sparkles, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ChatInputProps {
    onSend: (content: string) => void;
    placeholder?: string;
    disabled?: boolean;
    compact?: boolean;
}

export function ChatInput({ onSend, placeholder = "Message...", disabled, compact = false }: ChatInputProps) {
    const [inputValue, setInputValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [inputValue]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (inputValue.trim() && !disabled) {
                onSend(inputValue.trim());
                setInputValue("");
            }
        }
    };

    return (
        <div className="w-full flex flex-col gap-2 relative">
            {/* Contextual Smart Tips (like AI or "/" commands hint) */}
            {isFocused && !inputValue && !compact && (
                <div className="absolute -top-7 left-2 flex items-center gap-1.5 text-xs text-muted-foreground bg-background border px-2 py-1 rounded-md shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span>Type <strong className="text-foreground">/</strong> for commands or ask AI</span>
                </div>
            )}

            <div
                className={cn(
                    "relative flex flex-col bg-background rounded-xl border shadow-sm transition-all duration-200",
                    isFocused ? "ring-1 ring-primary border-primary" : "hover:border-border/80 border-border bg-muted/30"
                )}
            >
                {/* Formatting Toolbar - Only shows when focused or has content on non-compact */}
                {(!compact && (isFocused || inputValue)) && (
                    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground w-7 h-7">
                            <Type className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground w-7 h-7">
                            <span className="font-bold font-serif text-sm">B</span>
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground w-7 h-7">
                            <span className="italic font-serif text-sm">I</span>
                        </Button>
                    </div>
                )}

                {/* Main Input Area */}
                <div className="flex items-end gap-2 p-2 relative">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground">
                                    <Paperclip className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Attach file</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder={placeholder}
                        disabled={disabled}
                        rows={1}
                        className="flex-1 max-h-48 min-h-[36px] bg-transparent border-0 resize-none py-2 px-1 focus:outline-none focus:ring-0 text-[15px] leading-relaxed placeholder:text-muted-foreground/70"
                    />

                    <div className="flex items-center gap-1 shrink-0 pb-0.5">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hidden sm:flex">
                            <Smile className="h-5 w-5" />
                        </Button>
                        <Button
                            type="button"
                            size="icon"
                            onClick={() => {
                                if (inputValue.trim() && !disabled) {
                                    onSend(inputValue.trim());
                                    setInputValue("");
                                }
                            }}
                            className={cn(
                                "h-8 w-8 shrink-0 transition-all rounded-lg",
                                inputValue.trim() ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "bg-muted text-muted-foreground"
                            )}
                            disabled={!inputValue.trim() || disabled}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {!compact && (
                <div className="flex justify-between px-2 text-[10px] text-muted-foreground/60 font-medium tracking-wide">
                    <span>
                        <strong>Return</strong> to send · <strong>Shift + Return</strong> to add a new line
                    </span>
                </div>
            )}
        </div>
    );
}
