import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, Smile, Type, Sparkles, Video, CheckCircle, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VoiceInput } from "@/components/ui/voice-input";

interface ChatInputProps {
    onSend: (content: string) => void;
    placeholder?: string;
    disabled?: boolean;
    compact?: boolean;
}

const SLASH_COMMANDS = [
    { command: "summarize", description: "Summarize recent messages", icon: Sparkles, color: "text-purple-500" },
    { command: "task", description: "Create a new task", icon: CheckCircle, color: "text-blue-500" },
    { command: "meet", description: "Start a video meeting", icon: Video, color: "text-green-500" },
    { command: "ask", description: "Ask AI a question", icon: Bot, color: "text-orange-500" },
];

export function ChatInput({ onSend, placeholder = "Message...", disabled, compact = false }: ChatInputProps) {
    const [inputValue, setInputValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [showCommands, setShowCommands] = useState(false);
    const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
    const [interimValue, setInterimValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Formatted value including speech-to-text interim
    const displayValue = inputValue + (interimValue ? (inputValue && !inputValue.endsWith(' ') ? ' ' : '') + interimValue : '');

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [displayValue]);

    // Detect slash commands
    useEffect(() => {
        if (inputValue.startsWith("/")) {
            setShowCommands(true);
        } else {
            setShowCommands(false);
        }
    }, [inputValue]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showCommands) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedCommandIndex(prev => (prev + 1) % SLASH_COMMANDS.length);
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedCommandIndex(prev => (prev - 1 + SLASH_COMMANDS.length) % SLASH_COMMANDS.length);
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
            if (inputValue.trim() && !disabled) {
                onSend(inputValue.trim());
                setInputValue("");
            }
        }
    };

    const handleCommandSelect = (cmd: string) => {
        setInputValue(`/${cmd} `);
        setShowCommands(false);
        textareaRef.current?.focus();
    };

    return (
        <div className="w-full flex flex-col gap-2 relative">
            {/* Slash Commands Palette */}
            {showCommands && (
                <div className="absolute bottom-full left-0 w-full mb-2 bg-background border rounded-lg shadow-lg overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
                    <div className="px-3 py-2 border-b bg-muted/30">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Slash Commands</span>
                    </div>
                    <div className="flex flex-col py-1">
                        {SLASH_COMMANDS.map((cmd, idx) => {
                            const Icon = cmd.icon;
                            return (
                                <button
                                    key={cmd.command}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors",
                                        idx === selectedCommandIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted/50 text-foreground"
                                    )}
                                    onClick={() => handleCommandSelect(cmd.command)}
                                    onMouseEnter={() => setSelectedCommandIndex(idx)}
                                >
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-background shadow-sm">
                                        <Icon className={cn("h-3.5 w-3.5", cmd.color)} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-sm">/{cmd.command}</span>
                                        <span className="text-xs text-muted-foreground">{cmd.description}</span>
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

            {/* Contextual Smart Tips */}
            {isFocused && !inputValue && !compact && !showCommands && (
                <div className="absolute -top-7 left-2 flex items-center gap-1.5 text-xs text-muted-foreground bg-background border px-2 py-1 rounded-md shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span>Type <strong className="text-foreground">/</strong> for commands or ask AI</span>
                </div>
            )}

            <div
                className={cn(
                    "relative flex flex-col bg-background rounded-xl border shadow-sm transition-all duration-200 z-40",
                    isFocused ? "ring-1 ring-primary border-primary" : "hover:border-border/80 border-border bg-muted/30",
                    showCommands ? "ring-1 ring-primary border-primary rounded-t-sm" : ""
                )}
            >
                {/* Formatting Toolbar - Only shows when focused or has content on non-compact */}
                {(!compact && (isFocused || inputValue) && !showCommands) && (
                    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200">
                        <Button type="button" variant="ghost" size="icon" className="text-muted-foreground w-7 h-7">
                            <Type className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="text-muted-foreground w-7 h-7">
                            <span className="font-bold font-serif text-sm">B</span>
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="text-muted-foreground w-7 h-7">
                            <span className="italic font-serif text-sm">I</span>
                        </Button>
                    </div>
                )}

                {/* Main Input Area */}
                <div className="flex items-end gap-2 p-2 relative bg-background rounded-xl">
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
                        value={displayValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            setInterimValue("");
                        }}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => {
                            // Delay blur slightly so click on menu registers
                            setTimeout(() => setIsFocused(false), 200);
                        }}
                        placeholder={placeholder}
                        disabled={disabled}
                        rows={1}
                        className="flex-1 max-h-48 min-h-[36px] bg-transparent border-0 resize-none py-2 px-1 focus:outline-none focus:ring-0 text-[15px] leading-relaxed placeholder:text-muted-foreground/70"
                    />

                    <div className="flex items-center gap-1 shrink-0 pb-0.5">
                        <VoiceInput 
                            onTranscription={(text, isFinal) => {
                                if (isFinal) {
                                    setInputValue((prev) => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text + ' ');
                                    setInterimValue('');
                                } else {
                                    setInterimValue(text);
                                }
                            }}
                            className="hidden sm:flex"
                        />
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hidden sm:flex">
                            <Smile className="h-5 w-5" />
                        </Button>
                        <Button
                            type="button"
                            size="icon"
                            onClick={() => {
                                const finalValue = displayValue.trim();
                                if (finalValue && !disabled) {
                                    onSend(finalValue);
                                    setInputValue("");
                                    setInterimValue("");
                                }
                            }}
                            className={cn(
                                "h-8 w-8 shrink-0 transition-all rounded-lg",
                                displayValue.trim() ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" : "bg-muted text-muted-foreground"
                            )}
                            disabled={!displayValue.trim() || disabled}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {!compact && !showCommands && (
                <div className="flex justify-between px-2 text-[10px] text-muted-foreground/60 font-medium tracking-wide">
                    <span>
                        <strong>Return</strong> to send · <strong>Shift + Return</strong> to add a new line
                    </span>
                </div>
            )}
        </div>
    );
}
