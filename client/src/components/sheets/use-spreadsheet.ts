import { useEffect, useState, useRef } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'

export interface CellData {
    value: string
    formula?: string
    style?: any
}

export function useSpreadsheet(docId: string = 'default-sheet') {
    const [doc] = useState(() => new Y.Doc())
    const [provider, setProvider] = useState<WebsocketProvider | null>(null)
    const [data, setData] = useState<Record<string, CellData>>({})
    const [isConnected, setIsConnected] = useState(false)

    useEffect(() => {
        // Connect to websocket
        // Use the same ws url as chat/collab service
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3010/api/v1/docs/sheet'
        const webrtcProvider = new WebsocketProvider(wsUrl, docId, doc)

        // Persistence
        const indexeddbProvider = new IndexeddbPersistence(docId, doc)

        setProvider(webrtcProvider)

        webrtcProvider.on('status', (event: any) => {
            setIsConnected(event.status === 'connected')
        })

        // Y.Map for grid data: key "row,col" -> value { value: string, ... }
        const gridMap = doc.getMap<CellData>('grid')

        const updateHandler = () => {
            setData(gridMap.toJSON())
        }

        gridMap.observe(updateHandler)
        updateHandler() // Initial sync

        return () => {
            webrtcProvider.destroy()
            indexeddbProvider.destroy()
            doc.destroy()
        }
    }, [docId, doc])

    const setCell = (r: number, c: number, value: string) => {
        const gridMap = doc.getMap<CellData>('grid')
        // Simple value set for now
        // In real app, we'd parse formula here or storing metadata
        gridMap.set(`${r},${c}`, { value })
    }

    return {
        data,
        setCell,
        isConnected
    }
}
