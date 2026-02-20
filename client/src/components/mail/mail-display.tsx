import { format } from "date-fns"
import {
    Archive,
    ArchiveX,
    Clock,
    Forward,
    MoreVertical,
    Reply,
    ReplyAll,
    Trash2,
    Sparkles,
    Bot,
} from "lucide-react"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Mail } from "@/lib/data/mail"
import { aiApi } from "@/lib/api"
import { toast } from "sonner"
import { useState } from "react"

interface MailDisplayProps {
    mail: Mail | null
}

export function MailDisplay({ mail }: MailDisplayProps) {
    const today = new Date()
    const [isAiLoading, setIsAiLoading] = useState(false)
    const [replyText, setReplyText] = useState("")
    const [smartReplies, setSmartReplies] = useState<string[]>([])

    const handleSummarize = async () => {
        if (!mail) return
        setIsAiLoading(true)
        const toastId = toast.loading("Summarizing thread...")

        try {
            const response = await aiApi.chat(`Summarize search result for the following email thread:\n\nSubject: ${mail.subject}\nFrom: ${mail.name}\nContent: ${mail.text}`, {
                systemPrompt: "You are a helpful assistant. Provide a concise summary of the email."
            })

            if (response.data.answer) {
                toast.success("Summary", {
                    description: response.data.answer,
                    duration: 10000,
                })
            }
        } catch (e) {
            toast.error("Failed to summarize")
        } finally {
            setIsAiLoading(false)
            toast.dismiss(toastId)
        }
    }

    const generateSmartReplies = async () => {
        if (!mail) return
        setIsAiLoading(true)
        try {
            const response = await aiApi.chat(`Generate 3 short, professional reply options for this email. Output ONLY the replies separated by '|'.\n\nEmail: ${mail.text}`, {
                systemPrompt: "You are a professional email assistant."
            })

            if (response.data.answer) {
                const replies = response.data.answer.split('|').map(r => r.trim()).filter(r => r.length > 0).slice(0, 3)
                setSmartReplies(replies)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setIsAiLoading(false)
        }
    }

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center p-2">
                <div className="flex items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <Archive className="h-4 w-4" />
                                <span className="sr-only">Archive</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Archive</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <ArchiveX className="h-4 w-4" />
                                <span className="sr-only">Move to junk</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Move to junk</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Move to trash</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Move to trash</TooltipContent>
                    </Tooltip>
                    <Separator orientation="vertical" className="mx-1 h-6" />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <Clock className="h-4 w-4" />
                                <span className="sr-only">Snooze</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Snooze</TooltipContent>
                    </Tooltip>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {mail && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="mr-2 text-purple-600 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                            onClick={handleSummarize}
                            disabled={isAiLoading}
                        >
                            <Sparkles className="h-3 w-3 mr-2" />
                            Summarize
                        </Button>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <Reply className="h-4 w-4" />
                                <span className="sr-only">Reply</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reply</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <ReplyAll className="h-4 w-4" />
                                <span className="sr-only">Reply all</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reply all</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <Forward className="h-4 w-4" />
                                <span className="sr-only">Forward</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Forward</TooltipContent>
                    </Tooltip>
                    <Separator orientation="vertical" className="mx-1 h-6" />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!mail}>
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">More</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>Mark as unread</DropdownMenuItem>
                            <DropdownMenuItem>Star thread</DropdownMenuItem>
                            <DropdownMenuItem>Add label</DropdownMenuItem>
                            <DropdownMenuItem>Mute thread</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <Separator />
            {mail ? (
                <div className="flex flex-1 flex-col overflow-y-auto">
                    <div className="flex items-start p-4">
                        <div className="flex items-start gap-4 text-sm">
                            <Avatar>
                                <AvatarImage alt={mail.name} />
                                <AvatarFallback>
                                    {mail.name
                                        .split(" ")
                                        .map((chunk) => chunk[0])
                                        .join("")}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid gap-1">
                                <div className="font-semibold">{mail.name}</div>
                                <div className="line-clamp-1 text-xs">{mail.subject}</div>
                                <div className="line-clamp-1 text-xs">
                                    <span className="font-medium">Reply-To:</span> {mail.email}
                                </div>
                            </div>
                        </div>
                        {mail.date && (
                            <div className="ml-auto text-xs text-muted-foreground">
                                {format(new Date(mail.date), "PPpp")}
                            </div>
                        )}
                    </div>
                    <Separator />
                    <div className="flex-1 whitespace-pre-wrap p-4 text-sm">
                        {mail.text}
                    </div>
                    <Separator className="mt-auto" />
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t">
                        <div className="mb-2 flex gap-2 overflow-x-auto pb-2">
                            {smartReplies.length === 0 ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-purple-600 hover:text-purple-700"
                                    onClick={generateSmartReplies}
                                    disabled={isAiLoading}
                                >
                                    <Bot className="h-3 w-3 mr-1" />
                                    Generate Smart Replies
                                </Button>
                            ) : (
                                smartReplies.map((reply, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setReplyText(reply)}
                                        className="whitespace-nowrap rounded-full border bg-white px-3 py-1 text-xs font-medium hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        {reply}
                                    </button>
                                ))
                            )}
                        </div>
                        <form>
                            <div className="grid gap-4">
                                <Textarea
                                    className="p-4"
                                    placeholder={`Reply to ${mail.name}...`}
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                />
                                <div className="flex items-center">
                                    <label
                                        htmlFor="mute"
                                        className="flex items-center gap-2 text-xs font-normal"
                                    >

                                    </label>
                                    <Button
                                        onClick={(e) => {
                                            e.preventDefault()
                                            toast.success("Reply sent!")
                                            setReplyText("")
                                            setSmartReplies([])
                                        }}
                                        size="sm"
                                        className="ml-auto"
                                    >
                                        Send
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="p-8 text-center text-muted-foreground">
                    No message selected
                </div>
            )}
        </div>
    )
}
