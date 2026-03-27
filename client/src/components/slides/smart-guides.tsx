"use client"

import { useEffect, useRef, useCallback } from "react"
import type * as fabric from "fabric"

interface SmartGuidesProps {
    canvasRef: React.RefObject<fabric.Canvas | null>
    enabled: boolean
}

const SNAP_THRESHOLD = 8 // pixels
const GUIDE_COLOR = '#1a73e8'

interface GuideLines {
    h: number[]  // horizontal guide positions (y)
    v: number[]  // vertical guide positions (x)
}

export function useSmartGuides(canvasRef: React.RefObject<fabric.Canvas | null>, enabled: boolean) {
    const guidesRef = useRef<GuideLines>({ h: [], v: [] })
    const overlayRef = useRef<HTMLCanvasElement | null>(null)

    const drawGuides = useCallback(() => {
        const overlay = overlayRef.current
        const canvas = canvasRef.current
        if (!overlay || !canvas) return

        const ctx = overlay.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, overlay.width, overlay.height)
        if (!enabled) return

        ctx.strokeStyle = GUIDE_COLOR
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])

        for (const y of guidesRef.current.h) {
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(overlay.width, y)
            ctx.stroke()
        }
        for (const x of guidesRef.current.v) {
            ctx.beginPath()
            ctx.moveTo(x, 0)
            ctx.lineTo(x, overlay.height)
            ctx.stroke()
        }
    }, [canvasRef, enabled])

    const clearGuides = useCallback(() => {
        guidesRef.current = { h: [], v: [] }
        drawGuides()
    }, [drawGuides])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !enabled) return

        // Create or find overlay canvas
        const canvasEl = canvas.getElement()
        const container = canvasEl.parentElement
        if (!container) return

        let overlay = container.querySelector<HTMLCanvasElement>('.smart-guides-overlay')
        if (!overlay) {
            overlay = document.createElement('canvas')
            overlay.className = 'smart-guides-overlay'
            overlay.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:100'
            overlay.width = canvasEl.width
            overlay.height = canvasEl.height
            container.appendChild(overlay)
        }
        overlayRef.current = overlay

        const handleMoving = (e: { target?: fabric.Object }) => {
            if (!e.target) return
            const obj = e.target
            const canvasObjs = canvas.getObjects().filter(o => o !== obj)

            const guides: GuideLines = { h: [], v: [] }
            const oLeft = obj.left ?? 0
            const oTop = obj.top ?? 0
            const oW = (obj.width ?? 0) * (obj.scaleX ?? 1)
            const oH = (obj.height ?? 0) * (obj.scaleY ?? 1)
            const oCenterX = oLeft + oW / 2
            const oCenterY = oTop + oH / 2
            const oRight = oLeft + oW
            const oBottom = oTop + oH

            // Canvas center guides
            const cw = canvas.width ?? 800
            const ch = canvas.height ?? 600

            const snapCenterX = Math.abs(oCenterX - cw / 2) < SNAP_THRESHOLD
            const snapCenterY = Math.abs(oCenterY - ch / 2) < SNAP_THRESHOLD

            if (snapCenterX) { guides.v.push(cw / 2); obj.set('left', cw / 2 - oW / 2) }
            if (snapCenterY) { guides.h.push(ch / 2); obj.set('top', ch / 2 - oH / 2) }

            // Snap to other objects
            for (const other of canvasObjs) {
                const otL = other.left ?? 0
                const otT = other.top ?? 0
                const otW = (other.width ?? 0) * (other.scaleX ?? 1)
                const otH = (other.height ?? 0) * (other.scaleY ?? 1)
                const otCx = otL + otW / 2
                const otCy = otT + otH / 2

                // Left edges
                if (Math.abs(oLeft - otL) < SNAP_THRESHOLD) { guides.v.push(otL); obj.set('left', otL) }
                // Right edges
                if (Math.abs(oRight - (otL + otW)) < SNAP_THRESHOLD) { guides.v.push(otL + otW); obj.set('left', otL + otW - oW) }
                // Centers horizontal
                if (Math.abs(oCenterX - otCx) < SNAP_THRESHOLD) { guides.v.push(otCx); obj.set('left', otCx - oW / 2) }
                // Top edges
                if (Math.abs(oTop - otT) < SNAP_THRESHOLD) { guides.h.push(otT); obj.set('top', otT) }
                // Bottom edges
                if (Math.abs(oBottom - (otT + otH)) < SNAP_THRESHOLD) { guides.h.push(otT + otH); obj.set('top', otT + otH - oH) }
                // Centers vertical
                if (Math.abs(oCenterY - otCy) < SNAP_THRESHOLD) { guides.h.push(otCy); obj.set('top', otCy - oH / 2) }
            }

            guidesRef.current = guides
            drawGuides()
        }

        const handleMouseUp = () => clearGuides()

        canvas.on('object:moving', handleMoving as any)
        canvas.on('mouse:up', handleMouseUp)

        return () => {
            canvas.off('object:moving', handleMoving as any)
            canvas.off('mouse:up', handleMouseUp)
            overlay?.remove()
            overlayRef.current = null
        }
    }, [canvasRef, enabled, drawGuides, clearGuides])
}

// Inline indicator component used in toolbar
interface SmartGuidesToggleProps {
    enabled: boolean
    onToggle: () => void
}

export function SmartGuidesToggle({ enabled, onToggle }: SmartGuidesToggleProps) {
    return (
        <button
            onClick={onToggle}
            title={enabled ? "Désactiver les guides intelligents" : "Activer les guides intelligents"}
            className={`flex items-center gap-1 px-2 h-7 rounded text-[12px] font-medium transition-colors ${
                enabled
                    ? 'bg-[#1a73e8] text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
        >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="7" y1="0" x2="7" y2="14" strokeDasharray="2 1.5" />
                <line x1="0" y1="7" x2="14" y2="7" strokeDasharray="2 1.5" />
            </svg>
            Guides
        </button>
    )
}
