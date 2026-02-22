import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

export function useSlideObjects(docId: string, slideId: string) {
    const [objects, setObjects] = useState<Record<string, any>>({})

    useEffect(() => {
        // Minimal connection logic, reusing the same Y.Doc instance natively 
        // wouldn't easily be done here without Context, so we re-connect or 
        // expect the browser to multiplex WebSocket connections to the same room.
        // For performance in a real app, a Y.Doc Provider Context should wrap the whole app.

        const doc = new Y.Doc()
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3010/api/v1/docs/slide'
        const provider = new WebsocketProvider(wsUrl, docId, doc, { connect: false })

        // Check health endpoint before connecting (WS paths don't support HTTP methods)
        fetch('http://localhost:3010/health', { method: 'GET', mode: 'no-cors' })
            .then(() => provider.connect())
            .catch(() => {})

        const slideObjectsMap = doc.getMap<string>(`objects-${slideId}`)

        const updateObjectsHandler = () => {
            const newObj: Record<string, any> = {}
            slideObjectsMap.forEach((json, key) => {
                try {
                    newObj[key] = JSON.parse(json)
                } catch (e) {
                    // silently ignore parse errors
                }
            })
            setObjects(newObj)
        }

        slideObjectsMap.observe(updateObjectsHandler)

        // Wait for sync to complete before first paint if possible
        provider.on('sync', (isSynced: boolean) => {
            if (isSynced) updateObjectsHandler()
        })

        return () => {
            slideObjectsMap.unobserve(updateObjectsHandler)
            provider.destroy()
            doc.destroy()
        }
    }, [docId, slideId])

    return objects
}
