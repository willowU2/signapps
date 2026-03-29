"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { LiveAudienceView, type ReactionType } from "@/components/slides/live-presentation"
import { type SlideTransition } from "@/components/slides/slide-animations"
import { MonitorPlay, Loader2 } from "lucide-react"
import { usePageTitle } from '@/hooks/use-page-title';

function AudienceSlideRenderer({ index }: { index: number }) {
    return (
        <div className="w-full h-full bg-background rounded-lg shadow-lg flex items-center justify-center p-8">
            <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold text-foreground">Diapositive {index + 1}</h2>
                <p className="text-muted-foreground">Contenu synchronise avec le presentateur</p>
            </div>
        </div>
    )
}

function LivePageContent() {
    const searchParams = useSearchParams()
    const presentationId = searchParams.get('id')
    const [isConnecté, setIsConnecté] = useState(false)
    const [slideCount, setSlideCount] = useState(20) // Default placeholder count

    useEffect(() => {
        // In a real implementation, we would fetch the presentation data
        // from the server using the presentationId. For BroadcastChannel
        // mode (same machine), the slides are synced automatically.
        if (presentationId) {
            setIsConnecté(true)
        }
    }, [presentationId])

    if (!presentationId) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center space-y-4 p-8">
                    <MonitorPlay className="w-12 h-12 text-white/40 mx-auto" />
                    <h1 className="text-2xl font-bold text-white">Presentation en direct</h1>
                    <p className="text-white/60 max-w-md">
                        Utilisez le lien fourni par le presentateur pour rejoindre la presentation.
                        Le lien doit contenir un identifiant de presentation (parametre &quot;id&quot;).
                    </p>
                </div>
            </div>
        )
    }

    if (!isConnecté) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="w-8 h-8 text-blue-400 mx-auto animate-spin" />
                    <p className="text-white/60">Connexion a la presentation...</p>
                </div>
            </div>
        )
    }

    // Generate placeholder slides for the audience view
    // The actual content is synced via BroadcastChannel from the presenter
    const slides = Array.from({ length: slideCount }, (_, i) => (
        <AudienceSlideRenderer key={i} index={i} />
    ))

    const transitions: SlideTransition[] = Array.from({ length: slideCount }, () => ({
        type: 'fade' as const,
        duration: 500,
    }))

    return (
        <LiveAudienceView
            slides={slides}
            transitions={transitions}
            presentationId={presentationId}
            onEnd={() => {
                if (typeof window !== 'undefined') {
                    window.close()
                }
            }}
        />
    )
}

export default function LivePresentationPage() {
  usePageTitle('Presentation en direct');
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
        }>
            <LivePageContent />
        </Suspense>
    )
}
