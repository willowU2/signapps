"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { BookOpen, Check, Star } from "lucide-react";

interface Recipe {
  id: string;
  title: string;
  description: string;
  trigger: string;
  action: string;
  category: string;
  popular: boolean;
  active: boolean;
}

const RECIPES: Recipe[] = [
  {
    id: "1",
    title: "New file → Slack notification",
    description: "Notify a Slack channel whenever a file is uploaded to Drive",
    trigger: "file.uploaded",
    action: "send_slack",
    category: "Notifications",
    popular: true,
    active: false,
  },
  {
    id: "2",
    title: "New user → Welcome email",
    description: "Automatically send a welcome email when a new user joins",
    trigger: "user.created",
    action: "send_email",
    category: "Onboarding",
    popular: true,
    active: true,
  },
  {
    id: "3",
    title: "Task completed → Teams post",
    description: "Post a message to MS Teams when a task is marked complete",
    trigger: "task.completed",
    action: "send_teams",
    category: "Productivity",
    popular: false,
    active: false,
  },
  {
    id: "4",
    title: "Form submitted → Create task",
    description: "Create a follow-up task when a form is submitted",
    trigger: "form.submitted",
    action: "create_task",
    category: "Forms",
    popular: true,
    active: false,
  },
  {
    id: "5",
    title: "Login from new country → Security alert",
    description: "Trigger security review on new country login",
    trigger: "user.login_anomaly",
    action: "send_email",
    category: "Security",
    popular: false,
    active: true,
  },
  {
    id: "6",
    title: "Event created → Discord notify",
    description: "Post calendar events to a Discord channel",
    trigger: "event.created",
    action: "send_discord",
    category: "Calendar",
    popular: false,
    active: false,
  },
];

const CATEGORIES = ["All", ...new Set(RECIPES.map((r) => r.category))];

export function IFTTTRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>(RECIPES);
  const [filter, setFilter] = useState("All");

  const toggle = (id: string) => {
    setRecipes((rs) =>
      rs.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    );
    const r = recipes.find((r) => r.id === id)!;
    toast.success(`Recipe ${r.active ? "disabled" : "enabled"}: ${r.title}`);
  };

  const filtered =
    filter === "All" ? recipes : recipes.filter((r) => r.category === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Pre-built Automation Recipes</h2>
        <Badge variant="secondary">
          {recipes.filter((r) => r.active).length} active
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${filter === cat ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((recipe) => (
          <Card
            key={recipe.id}
            className={recipe.active ? "border-primary/30 bg-primary/5" : ""}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  {recipe.popular && (
                    <Star className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5 fill-yellow-500" />
                  )}
                  <div>
                    <CardTitle className="text-sm">{recipe.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {recipe.description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={recipe.active}
                  onCheckedChange={() => toggle(recipe.id)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  IF: {recipe.trigger}
                </Badge>
                <span className="text-xs text-muted-foreground">→</span>
                <Badge variant="secondary" className="text-xs">
                  THEN: {recipe.action}
                </Badge>
                <Badge className="text-xs ml-auto">{recipe.category}</Badge>
                {recipe.active && <Check className="h-3 w-3 text-green-500" />}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
