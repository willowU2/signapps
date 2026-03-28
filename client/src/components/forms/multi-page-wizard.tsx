"use client"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ChevronRight, ChevronLeft } from "lucide-react"

interface Props {
  totalPages: number
  currentPage: number
  onNext: () => void
  onBack: () => void
  submitting?: boolean
  children: React.ReactNode
}

export function MultiPageWizard({ totalPages, currentPage, onNext, onBack, submitting, children }: Props) {
  const progress = ((currentPage + 1) / totalPages) * 100

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
        <span>Étape {currentPage + 1} / {totalPages}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="space-y-6 mt-4">{children}</div>
      <div className="flex justify-between pt-4">
        {currentPage > 0 ? (
          <Button type="button" variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
          </Button>
        ) : <div />}
        {currentPage < totalPages - 1 ? (
          <Button type="button" onClick={onNext}>
            Suivant <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button type="submit" disabled={submitting}>
            {submitting ? "Envoi en cours..." : "Envoyer"}
            {!submitting && <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        )}
      </div>
    </div>
  )
}
