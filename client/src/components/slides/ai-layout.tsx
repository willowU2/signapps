"use client"

import { useCallback } from "react"
import { toast } from "sonner"
import { aiApi } from "@/lib/api"
import { useAiRouting } from "@/hooks/use-ai-routing"

// --- Layout Rules Engine ---

interface CanvasObjectInfo {
    id: string
    type: string         // 'i-text', 'textbox', 'text', 'rect', 'circle', 'image', 'group', etc.
    text?: string
    left: number
    top: number
    width: number
    height: number
    scaleX: number
    scaleY: number
    fontSize?: number
}

interface LayoutSuggestion {
    id: string
    left: number
    top: number
    width?: number
    height?: number
    scaleX?: number
    scaleY?: number
}

function isTextObject(type: string): boolean {
    return type === 'i-text' || type === 'textbox' || type === 'text'
}

function isImageObject(type: string): boolean {
    return type === 'image'
}

function isShapeObject(type: string): boolean {
    return type === 'rect' || type === 'circle' || type === 'triangle' || type === 'ellipse' || type === 'polygon'
}

// --- Rule-Based Layout Engine ---

export function computeAutoLayout(
    objects: CanvasObjectInfo[],
    canvasWidth: number,
    canvasHeight: number
): LayoutSuggestion[] {
    if (objects.length === 0) return []

    const padding = canvasWidth * 0.05
    const usableWidth = canvasWidth - padding * 2
    const usableHeight = canvasHeight - padding * 2

    const textObjects = objects.filter(o => isTextObject(o.type))
    const imageObjects = objects.filter(o => isImageObject(o.type))
    const shapeObjects = objects.filter(o => isShapeObject(o.type))
    const otherObjects = objects.filter(o => !isTextObject(o.type) && !isImageObject(o.type) && !isShapeObject(o.type))

    // --- Strategy 1: Single text element -> center it ---
    if (objects.length === 1 && textObjects.length === 1) {
        const obj = textObjects[0]
        const objW = obj.width * obj.scaleX
        const objH = obj.height * obj.scaleY
        return [{
            id: obj.id,
            left: (canvasWidth - objW) / 2,
            top: (canvasHeight - objH) / 2,
        }]
    }

    // --- Strategy 2: Title + Body (2 text elements) ---
    if (objects.length === 2 && textObjects.length === 2) {
        // Determine which is title (larger font or shorter text)
        const sorted = [...textObjects].sort((a, b) => {
            const aFontSize = a.fontSize || 16
            const bFontSize = b.fontSize || 16
            if (aFontSize !== bFontSize) return bFontSize - aFontSize
            return (a.text?.length || 0) - (b.text?.length || 0)
        })
        const title = sorted[0]
        const body = sorted[1]

        const titleH = title.height * title.scaleY
        const bodyH = body.height * body.scaleY

        return [
            {
                id: title.id,
                left: padding,
                top: canvasHeight * 0.08,
                width: usableWidth / title.scaleX,
            },
            {
                id: body.id,
                left: padding,
                top: canvasHeight * 0.08 + titleH + canvasHeight * 0.04,
                width: usableWidth / body.scaleX,
            }
        ]
    }

    // --- Strategy 3: Text + Image -> side by side ---
    if (textObjects.length >= 1 && imageObjects.length === 1 && objects.length <= 3) {
        const img = imageObjects[0]
        const halfWidth = usableWidth * 0.48

        const suggestions: LayoutSuggestion[] = []

        // Image on the right
        const imgScale = Math.min(halfWidth / img.width, usableHeight / img.height, 1)
        suggestions.push({
            id: img.id,
            left: padding + usableWidth * 0.52,
            top: padding + (usableHeight - img.height * imgScale) / 2,
            scaleX: imgScale,
            scaleY: imgScale,
        })

        // Stack text objects on the left
        let yOffset = padding + canvasHeight * 0.05
        textObjects.forEach((textObj, i) => {
            const textH = textObj.height * textObj.scaleY
            suggestions.push({
                id: textObj.id,
                left: padding,
                top: yOffset,
                width: halfWidth / textObj.scaleX,
            })
            yOffset += textH + canvasHeight * 0.03
        })

        return suggestions
    }

    // --- Strategy 4: Multiple items -> grid layout ---
    if (objects.length >= 3) {
        const count = objects.length
        const cols = count <= 4 ? 2 : count <= 9 ? 3 : 4
        const rows = Math.ceil(count / cols)

        const cellW = usableWidth / cols
        const cellH = usableHeight / rows
        const cellPadding = Math.min(cellW, cellH) * 0.08

        return objects.map((obj, idx) => {
            const col = idx % cols
            const row = Math.floor(idx / cols)

            const targetX = padding + col * cellW + cellPadding
            const targetY = padding + row * cellH + cellPadding
            const maxW = cellW - cellPadding * 2
            const maxH = cellH - cellPadding * 2

            const objW = obj.width * obj.scaleX
            const objH = obj.height * obj.scaleY

            // Scale down to fit cell if needed
            const scale = Math.min(maxW / objW, maxH / objH, 1)

            return {
                id: obj.id,
                left: targetX + (maxW - objW * scale) / 2,
                top: targetY + (maxH - objH * scale) / 2,
                scaleX: obj.scaleX * scale,
                scaleY: obj.scaleY * scale,
            }
        })
    }

    // --- Fallback: distribute evenly vertically ---
    const totalHeight = objects.reduce((sum, o) => sum + o.height * o.scaleY, 0)
    const spacing = Math.max(0, (usableHeight - totalHeight) / (objects.length + 1))

    let yPos = padding + spacing
    return objects.map(obj => {
        const objW = obj.width * obj.scaleX
        const suggestion: LayoutSuggestion = {
            id: obj.id,
            left: (canvasWidth - objW) / 2,
            top: yPos,
        }
        yPos += obj.height * obj.scaleY + spacing
        return suggestion
    })
}

// --- Apply Layout with Animation ---

export function applyLayoutToCanvas(
    canvas: any,
    suggestions: LayoutSuggestion[],
    animated: boolean = true
) {
    const objects = canvas.getObjects()

    suggestions.forEach(suggestion => {
        const obj = objects.find((o: any) => o.id === suggestion.id)
        if (!obj) return

        const targetProps: any = { left: suggestion.left, top: suggestion.top }
        if (suggestion.width !== undefined) targetProps.width = suggestion.width
        if (suggestion.height !== undefined) targetProps.height = suggestion.height
        if (suggestion.scaleX !== undefined) targetProps.scaleX = suggestion.scaleX
        if (suggestion.scaleY !== undefined) targetProps.scaleY = suggestion.scaleY

        if (animated) {
            // Use fabric.js v7 animate API: animate(properties, options)
            const duration = 400

            obj.animate(targetProps, {
                duration,
                onChange: () => canvas.requestRenderAll(),
                onComplete: () => {
                    obj.setCoords()
                    canvas.requestRenderAll()
                }
            })
        } else {
            obj.set(targetProps)
            obj.setCoords()
        }
    })

    if (!animated) {
        canvas.requestRenderAll()
    }
}

// --- Extract object info from canvas ---

export function extractCanvasObjectInfo(canvas: any): CanvasObjectInfo[] {
    return canvas.getObjects()
        .filter((obj: any) => !obj._masterElement) // Skip master slide elements
        .map((obj: any) => ({
            id: obj.id,
            type: obj.type,
            text: obj.text,
            left: obj.left || 0,
            top: obj.top || 0,
            width: obj.width || 0,
            height: obj.height || 0,
            scaleX: obj.scaleX || 1,
            scaleY: obj.scaleY || 1,
            fontSize: obj.fontSize,
        }))
}

// --- AI-Enhanced Layout (calls signapps-ai) ---

export async function computeAiLayout(
    objects: CanvasObjectInfo[],
    canvasWidth: number,
    canvasHeight: number,
    routeConfig: { providerId?: string; modelId?: string }
): Promise<LayoutSuggestion[] | null> {
    if (objects.length === 0) return null

    const objectDescriptions = objects.map(o => ({
        id: o.id,
        type: o.type,
        text: o.text?.substring(0, 100),
        currentWidth: Math.round(o.width * o.scaleX),
        currentHeight: Math.round(o.height * o.scaleY),
    }))

    const prompt = `Tu es un designer de presentations. Voici les objets sur une diapositive de ${canvasWidth}x${canvasHeight}px :
${JSON.stringify(objectDescriptions, null, 2)}

Genere un layout optimal. Retourne UNIQUEMENT un JSON array avec pour chaque objet :
{ "id": "...", "left": number, "top": number }

Regles :
- Padding minimum de 40px sur les bords
- Les titres (gros texte) vont en haut
- Les images sont mises en valeur (grande taille, centrees ou a droite)
- Les textes de contenu sont alignes proprement
- Si plusieurs elements : utilise une grille equilibree
- Retourne SEULEMENT le JSON array, rien d'autre.`

    try {
        const response = await aiApi.chat(prompt, {
            provider: routeConfig.providerId || undefined,
            model: routeConfig.modelId || undefined,
            systemPrompt: "Tu es un moteur de layout JSON strict. Retourne uniquement un JSON array valide sans markdown."
        })

        let answer = response.data.answer.trim()
        if (answer.startsWith("```json")) {
            answer = answer.replace(/^```json/, "").replace(/```$/, "").trim()
        } else if (answer.startsWith("```")) {
            answer = answer.replace(/^```/, "").replace(/```$/, "").trim()
        }

        const parsed = JSON.parse(answer) as LayoutSuggestion[]

        // Validate: ensure all IDs match existing objects
        const validIds = new Set(objects.map(o => o.id))
        const valid = parsed.every(s => validIds.has(s.id) && typeof s.left === 'number' && typeof s.top === 'number')

        if (!valid) {
            console.debug("AI layout response had invalid IDs or missing coordinates")
            return null
        }

        return parsed
    } catch (err) {
        console.debug("AI layout generation failed:", err)
        return null
    }
}

// --- Auto Layout Action (combined: AI with rule-based fallback) ---

export async function performAutoLayout(
    canvas: any,
    options?: {
        useAi?: boolean
        routeConfig?: { providerId?: string; modelId?: string }
        animated?: boolean
    }
): Promise<void> {
    const canvasWidth = canvas.width || 816
    const canvasHeight = canvas.height || 1056
    const objects = extractCanvasObjectInfo(canvas)

    if (objects.length === 0) {
        toast.info("Aucun objet a disposer sur cette diapositive.")
        return
    }

    let suggestions: LayoutSuggestion[] | null = null

    // Try AI first if enabled
    if (options?.useAi && options.routeConfig) {
        const toastId = toast.loading("Disposition IA en cours...")
        suggestions = await computeAiLayout(objects, canvasWidth, canvasHeight, options.routeConfig)
        if (suggestions) {
            toast.success("Disposition IA appliquee !", { id: toastId })
        } else {
            toast.info("IA indisponible, utilisation de la disposition automatique.", { id: toastId })
        }
    }

    // Fallback to rule-based
    if (!suggestions) {
        suggestions = computeAutoLayout(objects, canvasWidth, canvasHeight)
        if (!options?.useAi) {
            toast.success("Disposition automatique appliquee.")
        }
    }

    applyLayoutToCanvas(canvas, suggestions, options?.animated !== false)
}
