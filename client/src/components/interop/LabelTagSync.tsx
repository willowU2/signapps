"use client";

/**
 * Feature 25: Email label → map to task tag
 */

import { useEffect, useState, useCallback } from "react";
import { Tag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { labelApi } from "@/lib/api-mail";
import { interopStore } from "@/lib/interop/store";

interface LabelTagMapping {
  labelId: string;
  labelName: string;
  labelColor?: string;
  taskTag: string;
}

const MAPPING_KEY = "interop:label_tag_mappings";

export function useLabelTagSync() {
  const getMappings = (): LabelTagMapping[] => {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem(MAPPING_KEY) || "[]");
  };

  const syncLabelToTag = useCallback((labelId: string, labelName: string, taskId: string) => {
    const mappings = getMappings();
    const mapping = mappings.find(m => m.labelId === labelId);
    const tag = mapping?.taskTag ?? labelName;

    interopStore.addLink({ sourceType: "mail", sourceId: labelId, sourceTitle: labelName, targetType: "task", targetId: taskId, targetTitle: `tag:${tag}`, relation: "label_tag" });
    return tag;
  }, []);

  const addMapping = useCallback((mapping: LabelTagMapping) => {
    const mappings = getMappings();
    const existing = mappings.findIndex(m => m.labelId === mapping.labelId);
    if (existing >= 0) mappings[existing] = mapping;
    else mappings.push(mapping);
    localStorage.setItem(MAPPING_KEY, JSON.stringify(mappings));
  }, []);

  return { getMappings, syncLabelToTag, addMapping };
}

interface Props {
  emailId: string;
  labels: string[];
  className?: string;
}

/** Shows label→tag sync suggestion for a given email */
export function LabelTagSyncBadges({ emailId, labels, className }: Props) {
  const { getMappings, syncLabelToTag } = useLabelTagSync();
  const [mappings, setMappings] = useState<LabelTagMapping[]>([]);

  useEffect(() => {
    setMappings(getMappings().filter(m => labels.includes(m.labelName)));
  }, [labels]);

  if (labels.length === 0) return null;

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      {labels.map(label => {
        const mapped = mappings.find(m => m.labelName === label);
        return (
          <div key={label} className="flex items-center gap-1">
            <Badge variant="secondary" className="text-[11px] gap-1">
              <Tag className="h-2.5 w-2.5" />
              {label}
            </Badge>
            {mapped && (
              <>
                <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                <Badge variant="outline" className="text-[11px] gap-1">
                  <Tag className="h-2.5 w-2.5" />
                  {mapped.taskTag}
                </Badge>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
