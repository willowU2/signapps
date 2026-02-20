import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

export function useSlides(docId: string = 'slides-demo') {
    const [doc] = useState(() => new Y.Doc())
    const [provider, setProvider] = useState<WebsocketProvider | null>(null)
    const [objects, setObjects] = useState<Record<string, any>>({})
    const [isConnected, setIsConnected] = useState(false)

    useEffect(() => {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3010/api/v1/docs/slide'
        const webrtcProvider = new WebsocketProvider(wsUrl, docId, doc)

        setProvider(webrtcProvider)

        webrtcProvider.on('status', (event: any) => {
            setIsConnected(event.status === 'connected')
        })

        const slideObjects = doc.getMap<string>('slide-objects')

        const updateHandler = () => {
            const newObj: Record<string, any> = {}
            slideObjects.forEach((json, key) => {
                try {
                    newObj[key] = JSON.parse(json)
                } catch (e) {
                    console.error("Failed to parse object", e)
                }
            })
            setObjects(newObj)
        }

        slideObjects.observe(updateHandler)
        updateHandler()

        return () => {
            webrtcProvider.destroy()
            doc.destroy()
        }
    }, [docId, doc])

    const updateObject = (id: string, obj: any) => {
        const slideObjects = doc.getMap<string>('slide-objects')
        slideObjects.set(id, JSON.stringify(obj))
    }

    const removeObject = (id: string) => {
        const slideObjects = doc.getMap<string>('slide-objects')
        slideObjects.delete(id)
    }

    return {
        objects,
        updateObject,
        removeObject,
        isConnected
    }
}
