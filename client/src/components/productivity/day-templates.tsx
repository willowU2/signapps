"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Copy } from "lucide-react";

interface DayTemplate {
  id: string;
  name: string;
  description: string;
  color: string;
  blocks: string[];
}

export default function DayTemplates() {
  const [templates] = useState<DayTemplate[]>([
    {
      id: "1",
      name: "Focused Work Day",
      description: "Dedicated blocks for deep work",
      color: "bg-blue-100 text-blue-700",
      blocks: [
        "Morning Focus (9-12)",
        "Lunch Break",
        "Afternoon Focus (1-5)",
        "Admin Tasks",
      ],
    },
    {
      id: "2",
      name: "Meeting Heavy",
      description: "Multiple client interactions",
      color: "bg-purple-100 text-purple-700",
      blocks: [
        "Client Call A",
        "Prep Time",
        "Client Call B",
        "Followup",
        "Planning",
      ],
    },
    {
      id: "3",
      name: "Creative Session",
      description: "Brainstorming and ideation",
      color: "bg-pink-100 text-pink-700",
      blocks: ["Brainstorm", "Sketch Ideas", "Feedback Session", "Refinement"],
    },
    {
      id: "4",
      name: "Review & Plan",
      description: "Weekly reflection and planning",
      color: "bg-green-100 text-green-700",
      blocks: [
        "Weekly Review",
        "Data Analysis",
        "Next Week Plan",
        "Goal Setting",
      ],
    },
  ]);

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Day Templates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="p-4 border border-border rounded-lg hover:shadow-md transition cursor-pointer"
              onClick={() => setSelectedTemplate(template.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    {template.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {template.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {template.blocks.map((block, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full"
                      >
                        {block}
                      </span>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={
                    selectedTemplate === template.id ? "default" : "outline"
                  }
                  className="ml-3 gap-2 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTemplate(template.id);
                  }}
                >
                  <Copy className="w-4 h-4" />
                  Apply
                </Button>
              </div>
            </div>
          ))}
        </div>

        {selectedTemplate && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              Template{" "}
              <strong>
                {templates.find((t) => t.id === selectedTemplate)?.name}
              </strong>{" "}
              will be applied to today's calendar.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
