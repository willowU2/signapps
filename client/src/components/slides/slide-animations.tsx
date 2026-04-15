"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  Sparkles,
  X,
} from "lucide-react";

// --- Animation Types ---

export type EntranceAnimation =
  | "none"
  | "fadeIn"
  | "slideInLeft"
  | "slideInRight"
  | "slideInUp"
  | "zoomIn"
  | "bounceIn";

export type ExitAnimation =
  | "none"
  | "fadeOut"
  | "slideOutLeft"
  | "slideOutRight"
  | "zoomOut";

export type SlideTransitionType =
  | "none"
  | "fade"
  | "slideLeft"
  | "slideRight"
  | "slideUp"
  | "zoomIn";

export interface ObjectAnimationConfig {
  entranceType: EntranceAnimation;
  exitType: ExitAnimation;
  duration: number; // ms
  delay: number; // ms
}

export interface SlideTransition {
  type: SlideTransitionType;
  duration: number; // ms
}

// --- Animation Definitions (for framer-motion) ---

export const ENTRANCE_ANIMATIONS: Record<
  EntranceAnimation,
  { label: string; icon: React.ReactNode }
> = {
  none: { label: "Aucune", icon: <X className="w-3 h-3" /> },
  fadeIn: { label: "Fondu", icon: <Eye className="w-3 h-3" /> },
  slideInLeft: {
    label: "Glisser depuis la gauche",
    icon: <ArrowRight className="w-3 h-3" />,
  },
  slideInRight: {
    label: "Glisser depuis la droite",
    icon: <ArrowLeft className="w-3 h-3" />,
  },
  slideInUp: {
    label: "Glisser depuis le bas",
    icon: <ArrowUp className="w-3 h-3" />,
  },
  zoomIn: { label: "Zoom avant", icon: <ZoomIn className="w-3 h-3" /> },
  bounceIn: { label: "Rebond", icon: <Sparkles className="w-3 h-3" /> },
};

export const EXIT_ANIMATIONS: Record<
  ExitAnimation,
  { label: string; icon: React.ReactNode }
> = {
  none: { label: "Aucune", icon: <X className="w-3 h-3" /> },
  fadeOut: { label: "Fondu sortant", icon: <EyeOff className="w-3 h-3" /> },
  slideOutLeft: {
    label: "Glisser vers la gauche",
    icon: <ArrowLeft className="w-3 h-3" />,
  },
  slideOutRight: {
    label: "Glisser vers la droite",
    icon: <ArrowRight className="w-3 h-3" />,
  },
  zoomOut: { label: "Zoom arrière", icon: <ZoomOut className="w-3 h-3" /> },
};

export const SLIDE_TRANSITIONS: Record<SlideTransitionType, string> = {
  none: "Aucune",
  fade: "Fondu",
  slideLeft: "Glisser gauche",
  slideRight: "Glisser droite",
  slideUp: "Glisser haut",
  zoomIn: "Zoom avant",
};

// --- Framer Motion Variant Generators ---

export function getEntranceVariants(type: EntranceAnimation) {
  switch (type) {
    case "fadeIn":
      return { initial: { opacity: 0 }, animate: { opacity: 1 } };
    case "slideInLeft":
      return {
        initial: { opacity: 0, x: -200 },
        animate: { opacity: 1, x: 0 },
      };
    case "slideInRight":
      return { initial: { opacity: 0, x: 200 }, animate: { opacity: 1, x: 0 } };
    case "slideInUp":
      return { initial: { opacity: 0, y: 200 }, animate: { opacity: 1, y: 0 } };
    case "zoomIn":
      return {
        initial: { opacity: 0, scale: 0.3 },
        animate: { opacity: 1, scale: 1 },
      };
    case "bounceIn":
      return {
        initial: { opacity: 0, scale: 0.3 },
        animate: {
          opacity: 1,
          scale: 1,
          transition: { type: "spring", stiffness: 300, damping: 15 },
        },
      };
    default:
      return { initial: {}, animate: {} };
  }
}

export function getExitVariants(type: ExitAnimation) {
  switch (type) {
    case "fadeOut":
      return { exit: { opacity: 0 } };
    case "slideOutLeft":
      return { exit: { opacity: 0, x: -200 } };
    case "slideOutRight":
      return { exit: { opacity: 0, x: 200 } };
    case "zoomOut":
      return { exit: { opacity: 0, scale: 0.3 } };
    default:
      return { exit: {} };
  }
}

export function getSlideTransitionVariants(type: SlideTransitionType) {
  switch (type) {
    case "fade":
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      };
    case "slideLeft":
      return {
        initial: { x: "100%", opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: "-100%", opacity: 0 },
      };
    case "slideRight":
      return {
        initial: { x: "-100%", opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: "100%", opacity: 0 },
      };
    case "slideUp":
      return {
        initial: { y: "100%", opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: "-100%", opacity: 0 },
      };
    case "zoomIn":
      return {
        initial: { scale: 0.5, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 1.5, opacity: 0 },
      };
    default:
      return {
        initial: {},
        animate: {},
        exit: {},
      };
  }
}

// --- Animation Panel Component ---

interface AnimationPanelProps {
  selectedObjectId: string | null;
  animationConfig: ObjectAnimationConfig;
  onAnimationChange: (config: ObjectAnimationConfig) => void;
  onPreview: () => void;
  onClose: () => void;
}

export function AnimationPanel({
  selectedObjectId,
  animationConfig,
  onAnimationChange,
  onPreview,
  onClose,
}: AnimationPanelProps) {
  return (
    <div className="w-72 border-l bg-background flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Animations</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {!selectedObjectId ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sélectionnez un objet sur le canevas pour configurer ses
              animations.
            </p>
          ) : (
            <>
              {/* Entrance Animation */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Animation d'entrée
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    Object.keys(ENTRANCE_ANIMATIONS) as EntranceAnimation[]
                  ).map((key) => {
                    const anim = ENTRANCE_ANIMATIONS[key];
                    return (
                      <button
                        key={key}
                        onClick={() =>
                          onAnimationChange({
                            ...animationConfig,
                            entranceType: key,
                          })
                        }
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors",
                          "border",
                          animationConfig.entranceType === key
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-transparent hover:bg-muted text-muted-foreground",
                        )}
                      >
                        {anim.icon}
                        {anim.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Exit Animation */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Animation de sortie
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(EXIT_ANIMATIONS) as ExitAnimation[]).map(
                    (key) => {
                      const anim = EXIT_ANIMATIONS[key];
                      return (
                        <button
                          key={key}
                          onClick={() =>
                            onAnimationChange({
                              ...animationConfig,
                              exitType: key,
                            })
                          }
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors",
                            "border",
                            animationConfig.exitType === key
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-transparent hover:bg-muted text-muted-foreground",
                          )}
                        >
                          {anim.icon}
                          {anim.label}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Durée: {animationConfig.duration}ms
                </Label>
                <Slider
                  value={[animationConfig.duration]}
                  onValueChange={([val]) =>
                    onAnimationChange({ ...animationConfig, duration: val })
                  }
                  min={100}
                  max={2000}
                  step={100}
                  className="w-full"
                />
              </div>

              {/* Delay */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Délai: {animationConfig.delay}ms
                </Label>
                <Slider
                  value={[animationConfig.delay]}
                  onValueChange={([val]) =>
                    onAnimationChange({ ...animationConfig, delay: val })
                  }
                  min={0}
                  max={3000}
                  step={100}
                  className="w-full"
                />
              </div>

              {/* Preview Button */}
              <Button onClick={onPreview} className="w-full gap-2" size="sm">
                <Play className="w-4 h-4" />
                Aperçu de l'animation
              </Button>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
