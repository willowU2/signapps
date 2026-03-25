"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDesignStore } from "@/stores/design-store";
import { useRouter } from "next/navigation";
import type { DesignFormat, DesignPage, DesignTemplate } from "./types";
import { DESIGN_FORMATS } from "./types";
import {
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Youtube,
  FileText,
  Briefcase,
  Megaphone,
  Printer,
  LayoutTemplate,
} from "lucide-react";

// Built-in template data
const TEMPLATES: DesignTemplate[] = [
  {
    id: "social-gradient-1",
    name: "Gradient Social Post",
    category: "Social Media",
    subcategory: "Instagram Post",
    format: DESIGN_FORMATS.find((f) => f.id === "instagram-post")!,
    thumbnail: "",
    pages: [{
      id: "p1",
      background: "#667eea",
      objects: [
        {
          id: "t1",
          type: "text",
          name: "Heading",
          locked: false,
          visible: true,
          fabricData: {
            type: "textbox",
            left: 140,
            top: 380,
            width: 800,
            text: "Your Message Here",
            fontSize: 72,
            fontWeight: "bold",
            fontFamily: "Inter",
            fill: "#ffffff",
            textAlign: "center",
          },
        },
        {
          id: "t2",
          type: "text",
          name: "Subtitle",
          locked: false,
          visible: true,
          fabricData: {
            type: "textbox",
            left: 240,
            top: 500,
            width: 600,
            text: "Add a subtitle or description",
            fontSize: 28,
            fontWeight: "normal",
            fontFamily: "Inter",
            fill: "#ffffff",
            opacity: 0.8,
            textAlign: "center",
          },
        },
      ],
    }],
  },
  {
    id: "social-dark-1",
    name: "Dark Bold Post",
    category: "Social Media",
    subcategory: "Instagram Post",
    format: DESIGN_FORMATS.find((f) => f.id === "instagram-post")!,
    thumbnail: "",
    pages: [{
      id: "p1",
      background: "#1a1a2e",
      objects: [
        {
          id: "s1",
          type: "shape",
          name: "Accent Shape",
          locked: false,
          visible: true,
          fabricData: {
            type: "rect",
            left: 80,
            top: 80,
            width: 920,
            height: 4,
            fill: "#e94560",
          },
        },
        {
          id: "t1",
          type: "text",
          name: "Title",
          locked: false,
          visible: true,
          fabricData: {
            type: "textbox",
            left: 80,
            top: 300,
            width: 920,
            text: "BOLD STATEMENT",
            fontSize: 80,
            fontWeight: "bold",
            fontFamily: "Inter",
            fill: "#ffffff",
            textAlign: "left",
          },
        },
        {
          id: "t2",
          type: "text",
          name: "Body",
          locked: false,
          visible: true,
          fabricData: {
            type: "textbox",
            left: 80,
            top: 480,
            width: 700,
            text: "Supporting text goes here. Make it count.",
            fontSize: 24,
            fontWeight: "normal",
            fontFamily: "Inter",
            fill: "#aaaaaa",
            textAlign: "left",
          },
        },
      ],
    }],
  },
  {
    id: "business-card-1",
    name: "Minimal Business Card",
    category: "Business",
    subcategory: "Business Card",
    format: DESIGN_FORMATS.find((f) => f.id === "business-card")!,
    thumbnail: "",
    pages: [{
      id: "p1",
      background: "#ffffff",
      objects: [
        {
          id: "s1",
          type: "shape",
          name: "Accent Bar",
          locked: false,
          visible: true,
          fabricData: {
            type: "rect",
            left: 0,
            top: 0,
            width: 6,
            height: 600,
            fill: "#4f46e5",
          },
        },
        {
          id: "t1",
          type: "text",
          name: "Name",
          locked: false,
          visible: true,
          fabricData: {
            type: "textbox",
            left: 40,
            top: 180,
            width: 500,
            text: "John Doe",
            fontSize: 36,
            fontWeight: "bold",
            fontFamily: "Inter",
            fill: "#1a1a1a",
          },
        },
        {
          id: "t2",
          type: "text",
          name: "Title",
          locked: false,
          visible: true,
          fabricData: {
            type: "textbox",
            left: 40,
            top: 230,
            width: 500,
            text: "Software Engineer",
            fontSize: 18,
            fontWeight: "normal",
            fontFamily: "Inter",
            fill: "#666666",
          },
        },
        {
          id: "t3",
          type: "text",
          name: "Contact",
          locked: false,
          visible: true,
          fabricData: {
            type: "textbox",
            left: 40,
            top: 340,
            width: 500,
            text: "john@example.com\n+33 6 00 00 00 00",
            fontSize: 14,
            fontWeight: "normal",
            fontFamily: "Inter",
            fill: "#888888",
            lineHeight: 1.8,
          },
        },
      ],
    }],
  },
  {
    id: "story-gradient-1",
    name: "Gradient Story",
    category: "Social Media",
    subcategory: "Instagram Story",
    format: DESIGN_FORMATS.find((f) => f.id === "instagram-story")!,
    thumbnail: "",
    pages: [{
      id: "p1",
      background: "#764ba2",
      objects: [
        {
          id: "t1",
          type: "text",
          name: "Heading",
          locked: false,
          visible: true,
          fabricData: {
            type: "textbox",
            left: 80,
            top: 700,
            width: 920,
            text: "Swipe Up",
            fontSize: 64,
            fontWeight: "bold",
            fontFamily: "Inter",
            fill: "#ffffff",
            textAlign: "center",
          },
        },
      ],
    }],
  },
  {
    id: "flyer-event-1",
    name: "Event Flyer",
    category: "Marketing",
    subcategory: "Flyer",
    format: DESIGN_FORMATS.find((f) => f.id === "flyer")!,
    thumbnail: "",
    pages: [{
      id: "p1",
      background: "#0f3460",
      objects: [
        {
          id: "t1",
          type: "text",
          name: "Event Name",
          locked: false,
          visible: true,
          fabricData: {
            type: "textbox",
            left: 80,
            top: 200,
            width: 1080,
            text: "EVENT NAME",
            fontSize: 72,
            fontWeight: "bold",
            fontFamily: "Inter",
            fill: "#ffffff",
            textAlign: "center",
          },
        },
        {
          id: "t2",
          type: "text",
          name: "Date",
          locked: false,
          visible: true,
          fabricData: {
            type: "textbox",
            left: 80,
            top: 350,
            width: 1080,
            text: "March 25, 2026",
            fontSize: 32,
            fontWeight: "normal",
            fontFamily: "Inter",
            fill: "#e94560",
            textAlign: "center",
          },
        },
        {
          id: "s1",
          type: "shape",
          name: "Divider",
          locked: false,
          visible: true,
          fabricData: {
            type: "rect",
            left: 420,
            top: 420,
            width: 400,
            height: 3,
            fill: "#e94560",
          },
        },
        {
          id: "t3",
          type: "text",
          name: "Description",
          locked: false,
          visible: true,
          fabricData: {
            type: "textbox",
            left: 120,
            top: 480,
            width: 1000,
            text: "Join us for an unforgettable experience.\nDetails and registration at example.com",
            fontSize: 22,
            fontWeight: "normal",
            fontFamily: "Inter",
            fill: "#cccccc",
            textAlign: "center",
            lineHeight: 1.6,
          },
        },
      ],
    }],
  },
  {
    id: "youtube-thumb-1",
    name: "YouTube Thumbnail",
    category: "Social Media",
    subcategory: "YouTube Thumbnail",
    format: DESIGN_FORMATS.find((f) => f.id === "youtube-thumbnail")!,
    thumbnail: "",
    pages: [{
      id: "p1",
      background: "#1a1a1a",
      objects: [
        {
          id: "t1",
          type: "text",
          name: "Title",
          locked: false,
          visible: true,
          fabricData: {
            type: "textbox",
            left: 60,
            top: 240,
            width: 800,
            text: "VIDEO TITLE",
            fontSize: 80,
            fontWeight: "bold",
            fontFamily: "Inter",
            fill: "#ffffff",
            textAlign: "left",
          },
        },
        {
          id: "t2",
          type: "text",
          name: "Subtitle",
          locked: false,
          visible: true,
          fabricData: {
            type: "textbox",
            left: 60,
            top: 380,
            width: 600,
            text: "CLICK TO WATCH",
            fontSize: 28,
            fontWeight: "bold",
            fontFamily: "Inter",
            fill: "#e94560",
          },
        },
      ],
    }],
  },
];

const CATEGORIES = [
  { id: "all", name: "All", icon: LayoutTemplate },
  { id: "Social Media", name: "Social Media", icon: Instagram },
  { id: "Business", name: "Business", icon: Briefcase },
  { id: "Marketing", name: "Marketing", icon: Megaphone },
  { id: "Print", name: "Print", icon: Printer },
];

interface DesignTemplateGalleryProps {
  onUseTemplate: (template: DesignTemplate) => void;
}

export default function DesignTemplateGallery({ onUseTemplate }: DesignTemplateGalleryProps) {
  const [activeCategory, setActiveCategory] = useState("all");

  const filtered = activeCategory === "all"
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === activeCategory);

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Templates grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((template) => (
          <button
            key={template.id}
            onClick={() => onUseTemplate(template)}
            className="group flex flex-col rounded-lg border border-border overflow-hidden hover:border-primary/50 hover:shadow-md transition-all"
          >
            {/* Preview */}
            <div
              className="aspect-square w-full flex items-center justify-center p-4 transition-transform group-hover:scale-[1.02]"
              style={{ backgroundColor: template.pages[0]?.background || "#fff" }}
            >
              <div className="text-center space-y-1">
                {template.pages[0]?.objects
                  .filter((o) => o.type === "text")
                  .slice(0, 2)
                  .map((obj) => (
                    <p
                      key={obj.id}
                      className="truncate max-w-full"
                      style={{
                        color: obj.fabricData.fill || "#000",
                        fontSize: Math.min((obj.fabricData.fontSize || 16) / 6, 16),
                        fontWeight: obj.fabricData.fontWeight || "normal",
                        fontFamily: obj.fabricData.fontFamily || "Inter",
                      }}
                    >
                      {obj.fabricData.text}
                    </p>
                  ))}
              </div>
            </div>
            {/* Info */}
            <div className="p-2 bg-background border-t">
              <p className="text-xs font-medium truncate">{template.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {template.format.width} x {template.format.height}
              </p>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-xs text-muted-foreground">
          No templates in this category yet
        </div>
      )}
    </div>
  );
}

export { TEMPLATES };
