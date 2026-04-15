"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, MessageCircle, ArrowRight } from "lucide-react";

export function PublicChatbotStub() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card className="p-8 border-dashed">
      <div className="flex flex-col items-center justify-center gap-6">
        <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 rounded-lg">
          <MessageCircle className="w-8 h-8 text-violet-600 dark:text-violet-300" />
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-foreground dark:text-gray-100">
            Public Chatbot IA
          </h3>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            Coming Soon
          </p>
        </div>

        <div
          className="w-full max-w-xs p-6 border border-border dark:border-gray-700 rounded-lg bg-muted dark:bg-gray-900 flex items-center justify-center"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Lock
            className={`w-12 h-12 transition-all ${
              isHovered
                ? "text-violet-500 scale-110"
                : "text-gray-400 dark:text-muted-foreground"
            }`}
          />
        </div>

        <p className="text-xs text-muted-foreground dark:text-gray-400 max-w-xs">
          AI-powered chatbot for customer engagement with natural language
          processing
        </p>

        <Button disabled className="gap-2">
          Découvrir
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
