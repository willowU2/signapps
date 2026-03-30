"use client"

import { AppLayout } from "@/components/layout/app-layout"
import { SprintBoard } from "@/components/projects/sprint-board"
import { usePageTitle } from "@/hooks/use-page-title"
import { Zap } from "lucide-react"

export default function SprintsPage() {
  usePageTitle("Sprints — Projets")

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Zap className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Sprints
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Tableau de bord agile — backlog, sprint board et burndown.
            </p>
          </div>
        </div>

        <SprintBoard />
      </div>
    </AppLayout>
  )
}
