import { useEffect, useState, useRef, useCallback } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

export interface SlideData {
    id: string
    title: string
}

export function useSlides(docId: string = 'slides-demo') {
    const [doc] = useState(() => new Y.Doc())
    const [provider, setProvider] = useState<WebsocketProvider | null>(null)

    // Core state
    const [slides, setSlides] = useState<SlideData[]>([])
    const [activeSlideId, setActiveSlideId] = useState<string | null>(null)
    const [activeObjects, setActiveObjects] = useState<Record<string, any>>({})
    const [isConnected, setIsConnected] = useState(false)

    // History State
    const [canUndo, setCanUndo] = useState(false)
    const [canRedo, setCanRedo] = useState(false)
    const [undoManager, setUndoManager] = useState<Y.UndoManager | null>(null)

    // Multiplayer Awareness Map (clientId -> state)
    const [collaborators, setCollaborators] = useState<Record<number, any>>({})

    // Use a ref to track activeSlideId inside closures without adding it to deps
    const activeSlideIdRef = useRef(activeSlideId)
    activeSlideIdRef.current = activeSlideId

    // Track whether default slide initialization has already happened
    const initializedRef = useRef(false)

    useEffect(() => {
        const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3010/api/v1/docs/slide'
        const wsUrl = `${baseUrl}/${docId}`
        const webrtcProvider = new WebsocketProvider(wsUrl, docId, doc, { connect: false })

        // Check health endpoint before connecting (WS paths don't support HTTP methods)
        fetch('http://localhost:3010/health', { method: 'GET', mode: 'no-cors' })
            .then(() => webrtcProvider.connect())
            .catch(() => console.warn(`[useSlides] Collaboration server at ${wsUrl} is offline. Running in local-only mode.`))

        setProvider(webrtcProvider)

        webrtcProvider.on('status', (event: any) => {
            setIsConnected(event.status === 'connected')
        })

        // -- 0. Setup Awareness (User identity & tracking) --
        const awareness = webrtcProvider.awareness
        const colors = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#38bdf8']
        const myColor = colors[Math.floor(Math.random() * colors.length)]

        awareness.setLocalStateField('user', {
            name: `Guest ${Math.floor(Math.random() * 1000)}`,
            color: myColor
        })

        const handleAwarenessUpdate = () => {
            const states = Array.from(awareness.getStates().entries())
            const remoteCollaborators: Record<number, any> = {}

            states.forEach(([clientId, state]) => {
                if (clientId !== awareness.clientID) {
                    remoteCollaborators[clientId] = state
                }
            })
            setCollaborators(remoteCollaborators)
        }

        awareness.on('change', handleAwarenessUpdate)

        // -- 1. Slide List Management --
        const ySlideList = doc.getArray<SlideData>('slide-list')

        const updateSlidesHandler = () => {
            const currentSlides = ySlideList.toArray()
            // Deduplicate by slide id to prevent "same key" React errors
            const seen = new Set<string>()
            const uniqueSlides = currentSlides.filter(s => {
                if (seen.has(s.id)) return false
                seen.add(s.id)
                return true
            })
            setSlides(uniqueSlides)

            // Auto-select first slide if none selected and slides exist
            if (uniqueSlides.length > 0 && !activeSlideIdRef.current) {
                setActiveSlideId(uniqueSlides[0].id)
            }
        }

        ySlideList.observe(updateSlidesHandler)

        // Wait for sync before initializing default slides to avoid duplicates
        // with state that already exists on the server
        const initDefaultSlide = () => {
            if (initializedRef.current) return
            initializedRef.current = true
            if (ySlideList.length === 0) {
                ySlideList.push([{ id: 'slide-01', title: 'Slide 1' }])
            }
            updateSlidesHandler()
        }

        webrtcProvider.on('sync', (isSynced: boolean) => {
            if (isSynced) initDefaultSlide()
        })

        // Also initialize after a short timeout for offline/local-only mode
        const fallbackTimer = setTimeout(() => {
            initDefaultSlide()
        }, 1000)

        return () => {
            clearTimeout(fallbackTimer)
            webrtcProvider.destroy()
        }
    }, [docId, doc])

    // -- 2. Active Slide Objects Management --
    useEffect(() => {
        if (!activeSlideId) return

        // We use a Map named after the slide's ID to store its specific objects
        const slideObjectsMap = doc.getMap<string>(`objects-${activeSlideId}`)

        // Initialize intelligent UndoManager for this specific slide map
        const um = new Y.UndoManager(slideObjectsMap)

        // Listeners for UI state (disabling arrows if stack is empty)
        um.on('stack-item-added', () => {
            setCanUndo(um.undoStack.length > 0)
            setCanRedo(um.redoStack.length > 0)
        })
        um.on('stack-item-popped', () => {
            setCanUndo(um.undoStack.length > 0)
            setCanRedo(um.redoStack.length > 0)
        })

        setUndoManager(um)

        // Initial state
        setCanUndo(um.undoStack.length > 0)
        setCanRedo(um.redoStack.length > 0)

        const updateObjectsHandler = () => {
            const newObj: Record<string, any> = {}
            slideObjectsMap.forEach((json, key) => {
                try {
                    newObj[key] = JSON.parse(json)
                } catch (e) {
                    console.error("Failed to parse object", e)
                }
            })
            setActiveObjects(newObj)
        }

        slideObjectsMap.observe(updateObjectsHandler)
        updateObjectsHandler() // Initial load

        return () => {
            slideObjectsMap.unobserve(updateObjectsHandler)
            um.destroy()
            setUndoManager(null)
            setCanUndo(false)
            setCanRedo(false)
        }
    }, [activeSlideId, doc])

    // --- Actions ---

    const addSlide = () => {
        const ySlideList = doc.getArray<SlideData>('slide-list')
        const newSlideId = `slide-${Math.random().toString(36).substr(2, 9)}`
        ySlideList.push([{ id: newSlideId, title: `Slide ${ySlideList.length + 1}` }])
        setActiveSlideId(newSlideId) // Optional: auto switch to new slide
    }

    const removeSlide = (id: string) => {
        const ySlideList = doc.getArray<SlideData>('slide-list')
        const index = ySlideList.toArray().findIndex(s => s.id === id)
        if (index > -1) {
            ySlideList.delete(index, 1)
            // If we deleted the active slide, select another one or null
            if (activeSlideId === id) {
                const nextSlides = ySlideList.toArray()
                setActiveSlideId(nextSlides.length > 0 ? nextSlides[Math.max(0, index - 1)].id : null)
            }
        }
    }

    const duplicateSlide = (id: string) => {
        const ySlideList = doc.getArray<SlideData>('slide-list')
        const slidesArr = ySlideList.toArray()
        const sourceIndex = slidesArr.findIndex(s => s.id === id)
        
        if (sourceIndex > -1) {
            const sourceSlide = slidesArr[sourceIndex]
            const newSlideId = `slide-${Math.random().toString(36).substr(2, 9)}`
            
            // 1. Insert the new slide directly after the source
            ySlideList.insert(sourceIndex + 1, [{ id: newSlideId, title: `${sourceSlide.title} (Copie)` }])
            
            // 2. Copy all objects from the source slide
            const sourceObjectsMap = doc.getMap<string>(`objects-${id}`)
            const targetObjectsMap = doc.getMap<string>(`objects-${newSlideId}`)
            
            doc.transact(() => {
                sourceObjectsMap.forEach((json, key) => {
                    targetObjectsMap.set(key, json)
                })
            }, 'duplicate-slide')
            
            setActiveSlideId(newSlideId)
        }
    }

    const updateObject = (id: string, obj: any) => {
        if (!activeSlideId) return
        const slideObjectsMap = doc.getMap<string>(`objects-${activeSlideId}`)
        slideObjectsMap.set(id, JSON.stringify(obj))
    }

    const removeObject = (id: string) => {
        if (!activeSlideId) return
        const slideObjectsMap = doc.getMap<string>(`objects-${activeSlideId}`)
        slideObjectsMap.delete(id)
    }

    const clearSlide = () => {
        if (!activeSlideId) return
        const slideObjectsMap = doc.getMap<string>(`objects-${activeSlideId}`)
        // Wipe all keys
        doc.transact(() => {
            Array.from(slideObjectsMap.keys()).forEach(key => {
                slideObjectsMap.delete(key)
            })
        }, 'clear-slide')
    }

    const updateCursor = (x: number, y: number) => {
        if (!provider || !activeSlideId) return
        provider.awareness.setLocalStateField('cursor', {
            x,
            y,
            slideId: activeSlideId
        })
    }

    const undo = () => undoManager?.undo()
    const redo = () => undoManager?.redo()

    return {
        // App Level
        isConnected,
        collaborators,
        slides,
        activeSlideId,
        setActiveSlideId,
        addSlide,
        removeSlide,
        duplicateSlide,

        // Active Slide Level
        objects: activeObjects,
        updateObject,
        removeObject,
        clearSlide,
        updateCursor,

        // History
        canUndo,
        canRedo,
        undo,
        redo
    }
}
