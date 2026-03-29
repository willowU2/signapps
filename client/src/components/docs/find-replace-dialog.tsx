'use client'

import { useState, useCallback, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ChevronDown, ChevronUp, Replace, ReplaceAll, Search } from 'lucide-react'

interface FindReplaceDialogProps {
    editor: Editor | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function FindReplaceDialog({ editor, open, onOpenChange }: FindReplaceDialogProps) {
    const [findText, setFindText] = useState('')
    const [replaceText, setReplaceText] = useState('')
    const [caseSensitive, setCaseSensitive] = useState(false)
    const [matchCount, setMatchCount] = useState(0)
    const [currentMatch, setCurrentMatch] = useState(0)

    const findMatches = useCallback(() => {
        if (!findText || !editor) {
            setMatchCount(0)
            return []
        }

        const text = editor.state.doc.textContent
        const regex = new RegExp(
            findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            caseSensitive ? 'g' : 'gi'
        )
        const matches = [...text.matchAll(regex)]
        setMatchCount(matches.length)
        return matches
    }, [editor, findText, caseSensitive])

    const findNext = useCallback(() => {
        const matches = findMatches()
        if (matches.length === 0 || !editor) return

        const nextIndex = (currentMatch + 1) % matches.length
        setCurrentMatch(nextIndex)

        // Find the position in the document
        const match = matches[nextIndex]
        if (match.index !== undefined) {
            const from = match.index
            const to = from + findText.length

            // Select the match - approximate position based on text content
            editor.chain().focus().setTextSelection({ from: from + 1, to: to + 1 }).run()
        }
    }, [findMatches, currentMatch, editor, findText])

    const findPrevious = useCallback(() => {
        const matches = findMatches()
        if (matches.length === 0 || !editor) return

        const prevIndex = currentMatch === 0 ? matches.length - 1 : currentMatch - 1
        setCurrentMatch(prevIndex)

        const match = matches[prevIndex]
        if (match.index !== undefined) {
            const from = match.index
            const to = from + findText.length
            editor.chain().focus().setTextSelection({ from: from + 1, to: to + 1 }).run()
        }
    }, [findMatches, currentMatch, editor, findText])

    const replaceOne = useCallback(() => {
        if (!findText || !editor) return

        const { from, to } = editor.state.selection
        const selectedText = editor.state.doc.textBetween(from, to)

        // Check if current selection matches
        const matches = caseSensitive
            ? selectedText === findText
            : selectedText.toLowerCase() === findText.toLowerCase()

        if (matches) {
            editor.chain()
                .focus()
                .deleteSelection()
                .insertContent(replaceText)
                .run()
        }

        findNext()
    }, [editor, findText, replaceText, caseSensitive, findNext])

    const replaceAll = useCallback(() => {
        if (!findText || !editor) return

        const regex = new RegExp(
            findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            caseSensitive ? 'g' : 'gi'
        )

        // Get full document HTML, replace, and set
        const content = editor.getHTML()
        const newContent = content.replace(regex, replaceText)
        editor.commands.setContent(newContent)

        setMatchCount(0)
        setCurrentMatch(0)
    }, [editor, findText, replaceText, caseSensitive])

    useEffect(() => {
        findMatches()
    }, [findMatches])

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setFindText('')
            setReplaceText('')
            setMatchCount(0)
            setCurrentMatch(0)
        }
    }, [open])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5" />
                        Find and Replace
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="find-input">Find</Label>
                        <div className="flex gap-2">
                            <Input
                                id="find-input"
                                placeholder="Rechercher..."
                                value={findText}
                                onChange={(e) => setFindText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.shiftKey ? findPrevious() : findNext()
                                    }
                                }}
                                autoFocus
                            />
                            <Button variant="outline" size="icon" onClick={findPrevious} disabled={matchCount === 0}>
                                <ChevronUp className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={findNext} disabled={matchCount === 0}>
                                <ChevronDown className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {matchCount > 0
                                ? `${currentMatch + 1} of ${matchCount} matches`
                                : findText ? 'No matches found' : 'Enter text to search'
                            }
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="replace-input">Replace with</Label>
                        <Input
                            id="replace-input"
                            placeholder="Replacement text..."
                            value={replaceText}
                            onChange={(e) => setReplaceText(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="case-sensitive"
                            checked={caseSensitive}
                            onCheckedChange={(checked) => setCaseSensitive(!!checked)}
                        />
                        <Label htmlFor="case-sensitive" className="text-sm cursor-pointer">
                            Case sensitive
                        </Label>
                    </div>

                    <div className="flex justify-end space-x-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={replaceOne}
                            disabled={matchCount === 0}
                            className="gap-2"
                        >
                            <Replace className="w-4 h-4" />
                            Replace
                        </Button>
                        <Button
                            onClick={replaceAll}
                            disabled={matchCount === 0}
                            className="gap-2"
                        >
                            <ReplaceAll className="w-4 h-4" />
                            Replace All
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
