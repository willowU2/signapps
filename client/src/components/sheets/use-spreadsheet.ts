import { useEffect, useState, useRef, useCallback } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'

export interface CellStyle {
    bold?: boolean
    italic?: boolean
    strikethrough?: boolean
    align?: 'left' | 'center' | 'right'
    verticalAlign?: 'top' | 'middle' | 'bottom'
    wrap?: boolean
    textColor?: string
    fillColor?: string
    fontFamily?: string
    fontSize?: number
    numberFormat?: 'auto' | 'currency' | 'percent' | 'number'
    decimals?: number
}

export interface CellData {
    value: string
    formula?: string
    style?: CellStyle
}

export function useSpreadsheet(docId: string = 'default-sheet') {
    const [doc] = useState(() => new Y.Doc())
    const [data, setData] = useState<Record<string, CellData>>({})
    const [isConnected, setIsConnected] = useState(false)
    const undoManagerRef = useRef<Y.UndoManager | null>(null)
    const [canUndo, setCanUndo] = useState(false)
    const [canRedo, setCanRedo] = useState(false)

    useEffect(() => {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3010/api/v1/docs/sheet'
        const wsProvider = new WebsocketProvider(wsUrl, docId, doc)
        const idbProvider = new IndexeddbPersistence(docId, doc)

        wsProvider.on('status', (event: any) => {
            setIsConnected(event.status === 'connected')
        })

        const gridMap = doc.getMap<CellData>('grid')

        // Undo/Redo via Yjs
        const um = new Y.UndoManager(gridMap)
        undoManagerRef.current = um

        const updateUndoState = () => {
            setCanUndo(um.undoStack.length > 0)
            setCanRedo(um.redoStack.length > 0)
        }
        um.on('stack-item-added', updateUndoState)
        um.on('stack-item-popped', updateUndoState)

        const sync = () => setData(gridMap.toJSON())
        gridMap.observe(sync)
        sync()

        return () => {
            wsProvider.destroy()
            idbProvider.destroy()
        }
    }, [docId, doc])

    const setCell = useCallback((r: number, c: number, value: string) => {
        const gridMap = doc.getMap<CellData>('grid')
        const key = `${r},${c}`
        const existing = gridMap.get(key)
        gridMap.set(key, { value, style: existing?.style })
    }, [doc])

    const setCellStyle = useCallback((r: number, c: number, style: Partial<CellStyle>) => {
        const gridMap = doc.getMap<CellData>('grid')
        const key = `${r},${c}`
        const existing = gridMap.get(key) || { value: '' }
        gridMap.set(key, { ...existing, style: { ...(existing.style || {}), ...style } })
    }, [doc])

    const undo = useCallback(() => { undoManagerRef.current?.undo() }, [])
    const redo = useCallback(() => { undoManagerRef.current?.redo() }, [])

    return { data, setCell, setCellStyle, isConnected, undo, redo, canUndo, canRedo }
}
