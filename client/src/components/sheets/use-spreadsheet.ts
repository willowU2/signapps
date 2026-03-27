import { useEffect, useState, useRef, useCallback } from 'react'

import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { v4 as uuidv4 } from 'uuid'
import { CellData, CellStyle, CellValidation, SheetInfo, ROWS, COLS } from './types'

export type { CellStyle, CellData, CellValidation, SheetInfo }

export function useSpreadsheet(docId: string = 'default-sheet', initialData?: Record<string, CellData>) {
    const [doc] = useState(() => new Y.Doc())
    const [data, setData] = useState<Record<string, CellData>>({})
    const [isConnected, setIsConnected] = useState(false)
    const undoManagerRef = useRef<Y.UndoManager | null>(null)
    const [canUndo, setCanUndo] = useState(false)
    const [canRedo, setCanRedo] = useState(false)
    const [sheets, setSheets] = useState<SheetInfo[]>([{ id: 'default', name: 'Sheet1' }])
    const [activeSheetIndex, setActiveSheetIndex] = useState(0)
    const [globalGridVersion, setGlobalGridVersion] = useState(0)

    const activeSheetId = sheets[activeSheetIndex]?.id || 'default'
    const activeMapKey = `grid-${activeSheetId}`

    // WebSocket + IndexedDB providers (once)
    useEffect(() => {
        // Collaboration WebSocket server URL - disabled by default until y-websocket server is deployed
        const collabServerEnabled = process.env.NEXT_PUBLIC_COLLAB_ENABLED === 'true'
        const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3010'
        const wsUrl = `${baseUrl}/${docId}`
        const wsProvider = new WebsocketProvider(wsUrl, docId, doc, { connect: false })
        const idbProvider = new IndexeddbPersistence(docId, doc)

        // Only attempt to connect if collaboration server is explicitly enabled
        if (collabServerEnabled) {
            fetch(baseUrl.replace('ws://', 'http://').replace('wss://', 'https://'), { method: 'HEAD', mode: 'no-cors' })
                .then(() => wsProvider.connect())
                .catch(() => { })
        }

        wsProvider.on('status', (event: any) => {
            setIsConnected(event.status === 'connected')
        })

        // Track global updates across all sheets to force cross-sheet recalculations
        const bumpVersion = () => setGlobalGridVersion(v => v + 1)
        doc.on('update', bumpVersion)

        return () => {
            doc.off('update', bumpVersion)
            wsProvider.destroy()
            idbProvider.destroy()
        }
    }, [docId, doc])

    // Sheets metadata
    useEffect(() => {
        const sheetsMetaV2 = doc.getArray<any>('sheets-meta-v2')
        const sheetsColors = doc.getMap<string>('sheets-colors')
        const oldSheetsMeta = doc.getArray<string>('sheets-meta')

        // Forward Migration from V1 to V2
        if (sheetsMetaV2.length === 0) {
            if (oldSheetsMeta.length > 0) {
                // Migrate existing
                doc.transact(() => {
                    const migrated = oldSheetsMeta.toArray().map((name, i) => ({ id: String(i), name }))
                    sheetsMetaV2.push(migrated)
                })
            } else {
                // Initialize new document
                sheetsMetaV2.push([{ id: 'default', name: 'Sheet1' }])
            }
        }

        const syncSheets = () => {
            const arr = sheetsMetaV2.toArray()
            setSheets(arr.map((s, i) => ({ 
                id: s.id, 
                name: s.name, 
                color: sheetsColors.get(s.id) 
            })))
            
            // Validate boundaries for activeSheetIndex
            setActiveSheetIndex(prev => Math.min(prev, Math.max(0, arr.length - 1)))
        }

        sheetsMetaV2.observe(syncSheets)
        sheetsColors.observe(syncSheets)
        syncSheets()

        return () => { 
            sheetsMetaV2.unobserve(syncSheets)
            sheetsColors.unobserve(syncSheets)
        }
    }, [doc])

    // Watch active sheet's grid map
    useEffect(() => {
        const gridMap = doc.getMap<CellData>(activeMapKey)

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

        // Apply initial data if grid is empty
        if (initialData && gridMap.keys().next().done) {
            doc.transact(() => {
                for (const [key, value] of Object.entries(initialData)) {
                    gridMap.set(key, value)
                }
            })
        }

        return () => {
            gridMap.unobserve(sync)
            um.destroy()
        }
    }, [doc, activeMapKey])

    const getGridMap = useCallback(() => doc.getMap<CellData>(activeMapKey), [doc, activeMapKey])

    const setCell = useCallback((r: number, c: number, value: string) => {
        const gridMap = getGridMap()
        const key = `${r},${c}`
        const existing = gridMap.get(key)
        gridMap.set(key, { value, style: existing?.style })
    }, [getGridMap])

    const setCellStyle = useCallback((r: number, c: number, style: Partial<CellStyle>) => {
        const gridMap = getGridMap()
        const key = `${r},${c}`
        const existing = gridMap.get(key) || { value: '' }
        gridMap.set(key, { ...existing, style: { ...(existing.style || {}), ...style } })
    }, [getGridMap])

    const setCellFull = useCallback((r: number, c: number, cellData: CellData) => {
        getGridMap().set(`${r},${c}`, cellData)
    }, [getGridMap])

    const setCellComment = useCallback((r: number, c: number, comment: string | undefined) => {
        const gridMap = getGridMap()
        const key = `${r},${c}`
        const existing = gridMap.get(key) || { value: '' }
        gridMap.set(key, { ...existing, comment })
    }, [getGridMap])

    const setCellValidation = useCallback((r: number, c: number, validation: CellValidation | undefined) => {
        const gridMap = getGridMap()
        const key = `${r},${c}`
        const existing = gridMap.get(key) || { value: '' }
        gridMap.set(key, { ...existing, validation })
    }, [getGridMap])

    const deleteCell = useCallback((r: number, c: number) => {
        getGridMap().delete(`${r},${c}`)
    }, [getGridMap])

    const deleteCellRange = useCallback((minR: number, maxR: number, minC: number, maxC: number) => {
        const gridMap = getGridMap()
        doc.transact(() => {
            for (let r = minR; r <= maxR; r++) {
                for (let c = minC; c <= maxC; c++) {
                    gridMap.delete(`${r},${c}`)
                }
            }
        })
    }, [doc, getGridMap])

    const getCellRange = useCallback((minR: number, maxR: number, minC: number, maxC: number): (CellData | undefined)[][] => {
        const result: (CellData | undefined)[][] = []
        for (let r = minR; r <= maxR; r++) {
            const row: (CellData | undefined)[] = []
            for (let c = minC; c <= maxC; c++) {
                row.push(data[`${r},${c}`])
            }
            result.push(row)
        }
        return result
    }, [data])

    const setCellRange = useCallback((startR: number, startC: number, range: (CellData | undefined)[][]) => {
        const gridMap = getGridMap()
        doc.transact(() => {
            for (let r = 0; r < range.length; r++) {
                for (let c = 0; c < range[r].length; c++) {
                    const cellData = range[r][c]
                    if (cellData) {
                        gridMap.set(`${startR + r},${startC + c}`, cellData)
                    }
                }
            }
        })
    }, [doc, getGridMap])

    const insertRow = useCallback((atRow: number) => {
        const gridMap = getGridMap()
        doc.transact(() => {
            for (let r = ROWS - 1; r >= atRow; r--) {
                for (let c = 0; c < COLS; c++) {
                    const cell = gridMap.get(`${r},${c}`)
                    if (cell) {
                        gridMap.set(`${r + 1},${c}`, cell)
                        gridMap.delete(`${r},${c}`)
                    }
                }
            }
        })
    }, [doc, getGridMap])

    const deleteRow = useCallback((atRow: number) => {
        const gridMap = getGridMap()
        doc.transact(() => {
            for (let c = 0; c < COLS; c++) {
                gridMap.delete(`${atRow},${c}`)
            }
            for (let r = atRow + 1; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const cell = gridMap.get(`${r},${c}`)
                    if (cell) {
                        gridMap.set(`${r - 1},${c}`, cell)
                        gridMap.delete(`${r},${c}`)
                    }
                }
            }
        })
    }, [doc, getGridMap])

    const insertColumn = useCallback((atCol: number) => {
        const gridMap = getGridMap()
        doc.transact(() => {
            for (let r = 0; r < ROWS; r++) {
                for (let c = COLS - 1; c >= atCol; c--) {
                    const cell = gridMap.get(`${r},${c}`)
                    if (cell) {
                        gridMap.set(`${r},${c + 1}`, cell)
                        gridMap.delete(`${r},${c}`)
                    }
                }
            }
        })
    }, [doc, getGridMap])

    const deleteColumn = useCallback((atCol: number) => {
        const gridMap = getGridMap()
        doc.transact(() => {
            for (let r = 0; r < ROWS; r++) {
                gridMap.delete(`${r},${atCol}`)
                for (let c = atCol + 1; c < COLS; c++) {
                    const cell = gridMap.get(`${r},${c}`)
                    if (cell) {
                        gridMap.set(`${r},${c - 1}`, cell)
                        gridMap.delete(`${r},${c}`)
                    }
                }
            }
        })
    }, [doc, getGridMap])

    const sortColumn = useCallback((col: number, ascending: boolean) => {
        const gridMap = getGridMap()
        const rowsData: { r: number, cells: Map<number, CellData> }[] = []
        for (let r = 0; r < ROWS; r++) {
            const cells = new Map<number, CellData>()
            let hasData = false
            for (let c = 0; c < COLS; c++) {
                const cell = gridMap.get(`${r},${c}`)
                if (cell) { cells.set(c, cell); hasData = true }
            }
            if (hasData) rowsData.push({ r, cells })
        }

        rowsData.sort((a, b) => {
            const aVal = a.cells.get(col)?.value || ''
            const bVal = b.cells.get(col)?.value || ''
            const aNum = Number(aVal), bNum = Number(bVal)
            if (!isNaN(aNum) && !isNaN(bNum)) return ascending ? aNum - bNum : bNum - aNum
            return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
        })

        doc.transact(() => {
            gridMap.forEach((_, key) => gridMap.delete(key))
            rowsData.forEach((row, newR) => {
                row.cells.forEach((cell, c) => { gridMap.set(`${newR},${c}`, cell) })
            })
        })
    }, [doc, getGridMap])

    const mergeCells = useCallback((minR: number, maxR: number, minC: number, maxC: number) => {
        const gridMap = getGridMap()
        const rows = maxR - minR + 1
        const cols = maxC - minC + 1
        if (rows <= 1 && cols <= 1) return

        doc.transact(() => {
            const topLeft = gridMap.get(`${minR},${minC}`) || { value: '' }
            gridMap.set(`${minR},${minC}`, {
                ...topLeft,
                style: { ...(topLeft.style || {}), mergeRows: rows, mergeCols: cols }
            })
            for (let r = minR; r <= maxR; r++) {
                for (let c = minC; c <= maxC; c++) {
                    if (r === minR && c === minC) continue
                    const existing = gridMap.get(`${r},${c}`) || { value: '' }
                    gridMap.set(`${r},${c}`, {
                        ...existing,
                        style: { ...(existing.style || {}), mergedInto: `${minR},${minC}` }
                    })
                }
            }
        })
    }, [doc, getGridMap])

    const unmergeCells = useCallback((r: number, c: number) => {
        const gridMap = getGridMap()
        const cell = gridMap.get(`${r},${c}`)
        if (!cell?.style?.mergeRows) return

        const rows = cell.style.mergeRows
        const cols = cell.style.mergeCols || 1

        doc.transact(() => {
            const { mergeRows: _, mergeCols: __, ...cleanStyle } = cell.style!
            gridMap.set(`${r},${c}`, { ...cell, style: cleanStyle })
            for (let dr = 0; dr < rows; dr++) {
                for (let dc = 0; dc < cols; dc++) {
                    if (dr === 0 && dc === 0) continue
                    const existing = gridMap.get(`${r + dr},${c + dc}`)
                    if (existing?.style?.mergedInto) {
                        const { mergedInto: ___, ...clean } = existing.style
                        gridMap.set(`${r + dr},${c + dc}`, { ...existing, style: clean })
                    }
                }
            }
        })
    }, [doc, getGridMap])

    const addSheet = useCallback((name: string) => {
        const sheetsMetaV2 = doc.getArray<any>('sheets-meta-v2')
        sheetsMetaV2.push([{ id: uuidv4(), name }])
    }, [doc])

    const removeSheet = useCallback((index: number) => {
        const sheetsMetaV2 = doc.getArray<any>('sheets-meta-v2')
        if (sheetsMetaV2.length <= 1) return
        
        const sheetId = sheetsMetaV2.get(index).id
        
        doc.transact(() => {
            sheetsMetaV2.delete(index, 1)
            const gridMap = doc.getMap<CellData>(`grid-${sheetId}`)
            gridMap.forEach((_, key) => gridMap.delete(key))
            const sheetsColors = doc.getMap<string>('sheets-colors')
            sheetsColors.delete(sheetId)
        })
    }, [doc])

    const renameSheet = useCallback((index: number, newName: string) => {
        const sheetsMetaV2 = doc.getArray<any>('sheets-meta-v2')
        const existing = sheetsMetaV2.get(index)
        doc.transact(() => {
            sheetsMetaV2.delete(index, 1)
            sheetsMetaV2.insert(index, [{ ...existing, name: newName }])
        })
    }, [doc])

    const setSheetColor = useCallback((sheetId: string, color: string | undefined) => {
        const sheetsColors = doc.getMap<string>('sheets-colors')
        if (color) sheetsColors.set(sheetId, color)
        else sheetsColors.delete(sheetId)
    }, [doc])

    const getCrossSheetValue = useCallback((sheetName: string, r: number, c: number): string => {
        const sheetsMetaV2 = doc.getArray<any>('sheets-meta-v2')
        const arr = sheetsMetaV2.toArray()
        // Allow unquoted names space resilient search
        const cleanName = sheetName.replace(/^'|'$/g, '')
        const match = arr.find((s: any) => s.name.toUpperCase() === cleanName.toUpperCase())
        if (!match) return ''
        const gridMap = doc.getMap<CellData>(`grid-${match.id}`)
        const cell = gridMap.get(`${r},${c}`)
        if (!cell) return ''
        // Return the formula if present so the evaluator can compute it;
        // fall back to the cached value otherwise.
        return cell.formula || cell.value || ''
    }, [doc])

    const undo = useCallback(() => { undoManagerRef.current?.undo() }, [])
    const redo = useCallback(() => { undoManagerRef.current?.redo() }, [])

    const transact = useCallback((fn: () => void) => {
        doc.transact(fn)
    }, [doc])

    return {
        doc,
        data, setCell, setCellStyle, setCellFull, setCellComment, setCellValidation,
        deleteCell, deleteCellRange, getCellRange, setCellRange,
        insertRow, deleteRow, insertColumn, deleteColumn,
        sortColumn, mergeCells, unmergeCells,
        isConnected, undo, redo, canUndo, canRedo,
        sheets, activeSheetIndex, setActiveSheetIndex,
        addSheet, removeSheet, renameSheet, setSheetColor,
        getCrossSheetValue,
        transact,
        globalGridVersion
    }
}
