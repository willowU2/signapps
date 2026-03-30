"use client"

import { useState, useEffect, useRef } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save, Upload, MousePointer2, Square, Trash2 } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { useFloorPlan, useFloorPlans, useCreateFloorPlan, useUpdateFloorPlan } from "@/lib/scheduling/api/resources"
import { FloorPlanData, FloorPlanResource } from "@/lib/scheduling/types/scheduling"
import { useResources } from "@/lib/scheduling/api/resources"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

// We need a local helper since useUpdateFloorPlan mutation wasn't built for MVP yet
// Instead of rewriting the api, let's use a quick local storage mutation pattern inline for the builder.
import { useQueryClient } from "@tanstack/react-query"

export default function FloorPlanEditor() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string
    const isNew = id === 'new'
    
    const queryClient = useQueryClient()
    const { data: floorPlans = [] } = useFloorPlans()
    const { data: existingPlan, isLoading } = useFloorPlan(isNew ? '' : id)
    const createPlan = useCreateFloorPlan()
    const updatePlan = useUpdateFloorPlan()

    const [planData, setPlanData] = useState<Partial<FloorPlanData>>({
        id: `fp-${Date.now()}`,
        name: '',
        floor: '1',
        width: 800,
        height: 600,
        resources: [],
        svgContent: ''
    })

    const [activeTool, setActiveTool] = useState<'select' | 'draw'>('select')
    const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)

    const { data: globalResources = [] } = useResources()

    // Drag to Draw state
    const svgRef = useRef<SVGSVGElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [drawStart, setDrawStart] = useState({ x: 0, y: 0 })
    const [currentRect, setCurrentRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
    
    // Binding Dialog State
    const [isBindingModalOpen, setIsBindingModalOpen] = useState(false)
    const [selectedGlobalResource, setSelectedGlobalResource] = useState<string>('')

    // Sync loaded data
    useEffect(() => {
        if (!isNew && existingPlan) {
            setPlanData(existingPlan)
        }
    }, [isNew, existingPlan])

    const handleSave = async () => {
        if (!planData.name || !planData.svgContent) {
            toast.error("Veuillez fournir un nom et uploader une image SVG.")
            return;
        }

        try {
            if (isNew) {
                // Remove the hypothetical id that was set initially, backend creates the UUID
                const { id: _, ...createPayload } = planData as FloorPlanData;
                await createPlan.mutateAsync(createPayload);
            } else {
                await updatePlan.mutateAsync({ id, updates: planData });
            }
            
            toast.success("Plan sauvegardé avec succès")
            router.push('/admin/floorplans')
        } catch (e) {
            toast.error("Erreur de sauvegarde")
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const text = event.target?.result as string
            setPlanData((prev: Partial<FloorPlanData>) => ({ ...prev, svgContent: text }))
        }
        reader.readAsText(file)
    }

    const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        if (activeTool !== 'draw' || !svgRef.current) return;
        
        // Disable page scroll and touch actions
        e.currentTarget.setPointerCapture(e.pointerId);

        const rect = svgRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        
        setIsDrawing(true)
        setDrawStart({ x, y })
        setCurrentRect({ x, y, width: 0, height: 0 })
    }

    const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        if (!isDrawing || !svgRef.current || !currentRect) return;

        const rect = svgRef.current.getBoundingClientRect()
        const currentX = e.clientX - rect.left
        const currentY = e.clientY - rect.top

        const x = Math.min(drawStart.x, currentX)
        const y = Math.min(drawStart.y, currentY)
        const width = Math.abs(currentX - drawStart.x)
        const height = Math.abs(currentY - drawStart.y)

        setCurrentRect({ x, y, width, height })
    }

    const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
        if (!isDrawing || !svgRef.current) return;
        
        e.currentTarget.releasePointerCapture(e.pointerId);
        setIsDrawing(false)

        if (currentRect && currentRect.width > 20 && currentRect.height > 20) {
            // Valid rect, open dialog
            setIsBindingModalOpen(true)
        } else {
            setCurrentRect(null)
        }
    }

    const submitRectangleBinding = () => {
        if (!currentRect || !selectedGlobalResource) return;
        
        const resourceMeta = globalResources.find(r => r.id === selectedGlobalResource)
        if (!resourceMeta) return;

        const newResource: FloorPlanResource = {
            id: `hbox-${Date.now()}`,
            resourceId: selectedGlobalResource,
            name: resourceMeta.name,
            type: resourceMeta.type as FloorPlanResource['type'],
            path: '', // empty since it's a bound
            bounds: currentRect
        }

        setPlanData((prev: Partial<FloorPlanData>) => ({
            ...prev,
            resources: [...(prev.resources || []), newResource]
        }))

        setIsBindingModalOpen(false)
        setCurrentRect(null)
        setSelectedGlobalResource('')
        setActiveTool('select')
    }

    if (!isNew && isLoading) {
        return <AppLayout><div className="p-12 text-center text-muted-foreground animate-pulse">Chargement de l'éditeur...</div></AppLayout>
    }

    return (
        <AppLayout>
            <div className="flex flex-col min-h-0 flex-1 bg-background">
                {/* Header Navbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-background z-10">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/admin/floorplans')} className="rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <h1 className="text-xl font-bold tracking-tight">
                            {isNew ? "Nouveau Plan" : `Édition : ${planData.name}`}
                        </h1>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Button 
                            variant={activeTool === 'select' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="gap-2"
                            onClick={() => setActiveTool('select')}
                        >
                            <MousePointer2 className="w-4 h-4" /> Sélection
                        </Button>
                        <Button 
                            variant={activeTool === 'draw' ? 'secondary' : 'ghost'} 
                            size="sm"
                            className="gap-2"
                            onClick={() => setActiveTool('draw')}
                        >
                            <Square className="w-4 h-4" /> Dessiner Hitbox
                        </Button>
                        <div className="w-px h-6 bg-border mx-2" />
                        <Button onClick={handleSave} className="gap-2">
                            <Save className="w-4 h-4" /> Sauvegarder
                        </Button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar (Settings) */}
                    <div className="w-80 border-r bg-black/[0.01] p-6 overflow-y-auto shrink-0 flex flex-col gap-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Paramètres Généraux</h3>
                            <div className="space-y-2">
                                <Label>Nom du Plan</Label>
                                <Input 
                                    value={planData.name || ''} 
                                    onChange={e => setPlanData((prev: Partial<FloorPlanData>) => ({ ...prev, name: e.target.value }))}
                                    placeholder="ex: Bureau Principal"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Étage (Floor)</Label>
                                <Input 
                                    value={planData.floor || ''} 
                                    onChange={e => setPlanData((prev: Partial<FloorPlanData>) => ({ ...prev, floor: e.target.value }))}
                                    placeholder="ex: 1, RDC, Basement"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Arrière-plan (SVG)</h3>
                            {!planData.svgContent ? (
                                <div className="border-2 border-dashed rounded-xl p-6 text-center">
                                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                                    <p className="text-sm text-muted-foreground mb-4">Uploadez un fichier .svg pour servir de base à votre carte.</p>
                                    <Input type="file" accept=".svg" className="text-xs" onChange={handleFileUpload} />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="h-32 bg-background border rounded-lg overflow-hidden flex items-center justify-center p-2 relative group">
                                         {/* eslint-disable-next-line @next/next/no-img-element */}
                                         <img src={`data:image/svg+xml;utf8,${encodeURIComponent(planData.svgContent)}`} className="max-w-full max-h-full opacity-70" alt="Preview" />
                                         <div className="absolute inset-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                             <Button variant="destructive" size="sm" onClick={() => setPlanData((prev: Partial<FloorPlanData>) => ({ ...prev, svgContent: '' }))}>
                                                 Supprimer l'image
                                             </Button>
                                         </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground break-all line-clamp-2">
                                        Source chargée.
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4 flex-1">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                Hitboxes ({planData.resources?.length || 0})
                            </h3>
                            {(!planData.resources || planData.resources.length === 0) ? (
                                <p className="text-sm text-muted-foreground text-center py-4 italic">Aucune hitbox temporelle configurée.</p>
                            ) : (
                                <div className="space-y-2">
                                    {planData.resources.map((res: FloorPlanResource) => (
                                        <div 
                                            key={res.id} 
                                            className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${selectedResourceId === res.id ? 'border-blue-500 bg-blue-50/50' : 'bg-background hover:bg-black/5'}`}
                                            onClick={() => setSelectedResourceId(res.id)}
                                        >
                                            <div>
                                                <div className="font-medium text-sm">{res.name}</div>
                                                <div className="text-xs text-muted-foreground opacity-70">Bound: {Math.round(res.bounds.width)}x{Math.round(res.bounds.height)}</div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-50 hover:opacity-100" onClick={(e) => {
                                                e.stopPropagation();
                                                setPlanData((prev: Partial<FloorPlanData>) => ({
                                                    ...prev,
                                                    resources: prev.resources?.filter((r: FloorPlanResource) => r.id !== res.id)
                                                }))
                                            }}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Canvas Editor Zone */}
                    <div className="flex-1 bg-black/[0.03] overflow-hidden relative touch-none select-none flex items-center justify-center p-8 cursor-crosshair">
                        {planData.svgContent ? (
                            <div className="relative shadow-2xl bg-card border border-border/50 rounded-lg overflow-hidden" style={{ width: planData.width, height: planData.height }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`data:image/svg+xml;utf8,${encodeURIComponent(planData.svgContent)}`} className="w-full h-full object-cover pointer-events-none" />
                                
                                {/* Overlay hitboxes */}
                                <svg 
                                    ref={svgRef}
                                    className="absolute inset-0 w-full h-full touch-none"
                                    onPointerDown={handlePointerDown}
                                    onPointerMove={handlePointerMove}
                                    onPointerUp={handlePointerUp}
                                >
                                    {planData.resources?.map((res: FloorPlanResource) => (
                                        <rect 
                                            key={res.id}
                                            x={res.bounds.x}
                                            y={res.bounds.y}
                                            width={res.bounds.width}
                                            height={res.bounds.height}
                                            fill={selectedResourceId === res.id ? "rgba(59, 130, 246, 0.4)" : "rgba(34, 197, 94, 0.4)"}
                                            stroke={selectedResourceId === res.id ? "rgb(37, 99, 235)" : "rgb(22, 163, 74)"}
                                            strokeWidth={2}
                                            className="pointer-events-auto cursor-pointer transition-all"
                                            onClick={() => {
                                                if (activeTool === 'select') setSelectedResourceId(res.id)
                                            }}
                                        />
                                    ))}

                                    {/* Unsaved currently drawn rect */}
                                    {currentRect && activeTool === 'draw' && (
                                        <rect 
                                            x={currentRect.x}
                                            y={currentRect.y}
                                            width={currentRect.width}
                                            height={currentRect.height}
                                            fill="rgba(249, 115, 22, 0.4)"
                                            stroke="rgb(234, 88, 12)"
                                            strokeWidth={2}
                                            strokeDasharray="4 4"
                                            className="pointer-events-none"
                                        />
                                    )}
                                </svg>
                            </div>
                        ) : (
                            <div className="text-muted-foreground flex items-center gap-2">
                                <ArrowLeft className="w-4 h-4" /> Veuillez d'abord uploader un fond de plan.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Binding de Hitbox */}
            <Dialog open={isBindingModalOpen} onOpenChange={(open) => {
                if (!open) {
                    setIsBindingModalOpen(false)
                    setCurrentRect(null)
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Associer la Hitbox</DialogTitle>
                        <DialogDescription>
                            Vous venez de dessiner une zone interactive. À quelle ressource SignApps cette zone correspond-elle ?
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Ressource (Salle, Équipement)</Label>
                            <Select value={selectedGlobalResource} onValueChange={setSelectedGlobalResource}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sélectionnez une ressource..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {globalResources.map(res => (
                                        <SelectItem key={res.id} value={res.id}>
                                            {res.name} <span className="text-muted-foreground ml-2 text-xs">({res.capacity || 0} places)</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setIsBindingModalOpen(false)
                            setCurrentRect(null)
                        }}>
                            Annuler
                        </Button>
                        <Button onClick={submitRectangleBinding} disabled={!selectedGlobalResource}>
                            Lier la Ressource
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    )
}
