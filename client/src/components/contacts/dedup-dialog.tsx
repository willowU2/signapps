"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  Loader2,
  Sparkles,
  Merge,
  X,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { aiApi } from "@/lib/api/ai";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company?: string;
}

interface DuplicateGroup {
  contacts: Contact[];
  confidence: number;
  reason: string;
}

interface DedupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  onMerge: (keepId: string, mergeIds: string[]) => Promise<void>;
}

export function DedupDialog({
  open,
  onOpenChange,
  contacts,
  onMerge,
}: DedupDialogProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [mergedGroups, setMergedGroups] = useState<Set<number>>(new Set());
  const [mergingIndex, setMergingIndex] = useState<number | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const analyzeContacts = useCallback(async () => {
    if (contacts.length < 2) {
      toast.error("Need at least 2 contacts to detect duplicates");
      return;
    }

    setIsAnalyzing(true);
    setDuplicateGroups([]);
    setMergedGroups(new Set());
    setHasAnalyzed(false);

    try {
      // Send contact list summary to AI for analysis
      const contactSummary = contacts.map((c) => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`.trim(),
        email: c.email || "",
        phone: c.phone || "",
        company: c.company || "",
      }));

      const prompt = `Analyze this contact list and find likely duplicates. Look for:
- Similar names (typos, abbreviations, maiden names)
- Same email or phone
- Same company with similar names

Contact list:
${JSON.stringify(contactSummary, null, 2)}

Return ONLY a valid JSON array of duplicate groups:
[{"contact_ids": ["id1", "id2"], "confidence": 0.85, "reason": "Same email address"}]

If no duplicates found, return an empty array: []`;

      const res = await aiApi.chat(prompt, {
        systemPrompt:
          "You are a data deduplication expert. Return only valid JSON, no markdown, no explanation.",
      });

      const jsonMatch = res.data.answer.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const rawGroups = JSON.parse(jsonMatch[0]);
        const groups: DuplicateGroup[] = rawGroups
          .filter((g: any) => g.contact_ids?.length >= 2)
          .map((g: any) => ({
            contacts: g.contact_ids
              .map((id: string) => contacts.find((c) => c.id === id))
              .filter(Boolean),
            confidence: Math.round((g.confidence || 0.5) * 100),
            reason: g.reason || "Similar contact information",
          }))
          .filter((g: DuplicateGroup) => g.contacts.length >= 2);

        setDuplicateGroups(groups);
        setHasAnalyzed(true);

        if (groups.length === 0) {
          toast.info("No duplicates detected");
        } else {
          toast.success(
            `Found ${groups.length} potential duplicate group${groups.length > 1 ? "s" : ""}`,
          );
        }
      } else {
        setDuplicateGroups([]);
        setHasAnalyzed(true);
        toast.info("No duplicates detected");
      }
    } catch {
      toast.error("Failed to analyze contacts");
    } finally {
      setIsAnalyzing(false);
    }
  }, [contacts]);

  const handleMerge = async (groupIndex: number, keepContact: Contact) => {
    const group = duplicateGroups[groupIndex];
    if (!group) return;

    setMergingIndex(groupIndex);
    try {
      const mergeIds = group.contacts
        .filter((c) => c.id !== keepContact.id)
        .map((c) => c.id);

      await onMerge(keepContact.id, mergeIds);
      setMergedGroups((prev) => new Set([...prev, groupIndex]));
      toast.success(
        `Merged ${mergeIds.length} contact${mergeIds.length > 1 ? "s" : ""} into ${keepContact.first_name} ${keepContact.last_name}`,
      );
    } catch {
      toast.error("Impossible de fusionner les contacts");
    } finally {
      setMergingIndex(null);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-red-600 dark:text-red-400";
    if (confidence >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-blue-600 dark:text-blue-400";
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 80) return "bg-red-500";
    if (confidence >= 60) return "bg-yellow-500";
    return "bg-blue-500";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            AI Contact Deduplication
          </DialogTitle>
          <DialogDescription>
            AI analyzes your {contacts.length} contacts to find likely
            duplicates
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Analyze button */}
          {!hasAnalyzed && (
            <Button
              onClick={analyzeContacts}
              disabled={isAnalyzing || contacts.length < 2}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing {contacts.length} contacts...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Find Duplicates
                </>
              )}
            </Button>
          )}

          {/* Results */}
          {hasAnalyzed && duplicateGroups.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
              <p className="font-medium">No duplicates found</p>
              <p className="text-sm mt-1">Your contact list looks clean</p>
            </div>
          )}

          {duplicateGroups.map((group, groupIdx) => (
            <Card
              key={groupIdx}
              className={cn(
                "transition-all",
                mergedGroups.has(groupIdx) && "opacity-50 pointer-events-none",
              )}
            >
              <CardContent className="p-4 space-y-3">
                {/* Group header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={cn(
                        "h-4 w-4",
                        getConfidenceColor(group.confidence),
                      )}
                    />
                    <span className="text-sm font-medium">{group.reason}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        getConfidenceBg(group.confidence),
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        getConfidenceColor(group.confidence),
                      )}
                    >
                      {group.confidence}%
                    </span>
                  </div>
                </div>

                {/* Contacts in group */}
                <div className="space-y-2">
                  {group.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-2 rounded-md border bg-muted/30"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {contact.first_name} {contact.last_name}
                          </span>
                          {contact.company && (
                            <Badge
                              variant="outline"
                              className="text-[10px] shrink-0"
                            >
                              {contact.company}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {contact.email && (
                            <span className="text-xs text-muted-foreground truncate">
                              {contact.email}
                            </span>
                          )}
                          {contact.phone && (
                            <span className="text-xs text-muted-foreground">
                              {contact.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      {!mergedGroups.has(groupIdx) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMerge(groupIdx, contact)}
                          disabled={mergingIndex === groupIdx}
                          className="ml-2 shrink-0 gap-1"
                        >
                          {mergingIndex === groupIdx ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Merge className="h-3 w-3" />
                          )}
                          Keep
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {mergedGroups.has(groupIdx) && (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Merged successfully
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Re-analyze button */}
          {hasAnalyzed && duplicateGroups.length > 0 && (
            <Button
              variant="outline"
              onClick={analyzeContacts}
              disabled={isAnalyzing}
              className="w-full"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Re-analyze
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
