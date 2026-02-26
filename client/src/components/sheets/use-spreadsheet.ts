import { useEffect, useState, useRef, useCallback } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { CellData, CellStyle, CellValidation, SheetInfo, ROWS, COLS } from './types'

export type { CellStyle, CellData, CellValidation, SheetInfo }

export function useSpreadsheet(docId: string = 'default-sheet') {
    const [doc] = useState(() => new Y.Doc())
    const [data, setData] = useState<Record<string, CellData>>({})
    const [isConnected, setIsConnected] = useState(false)
    const undoManagerRef = useRef<Y.UndoManager | null>(null)
    const [canUndo, setCanUndo] = useState(false)
    const [canRedo, setCanRedo] = useState(false)
    const [sheets, setSheets] = useState<SheetInfo[]>([{ name: 'Sheet1' }])
    const [activeSheetIndex, setActiveSheetIndex] = useState(0)

    const activeMapKey = `grid-${activeSheetIndex}`

    // WebSocket + IndexedDB providers (once)
    useEffect(() => {
        const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3010/api/v1/docs/sheet'
        const wsUrl = `${baseUrl}/${docId}`
        const wsProvider = new WebsocketProvider(wsUrl, docId, doc, { connect: false })
        const idbProvider = new IndexeddbPersistence(docId, doc)

        // Check health endpoint (WS paths don't support HTTP methods)
        fetch('http://localhost:3010/health', { method: 'GET', mode: 'no-cors' })
            .then(() => wsProvider.connect())
            .catch(() => { })

        wsProvider.on('status', (event: any) => {
            setIsConnected(event.status === 'connected')
        })

        return () => {
            wsProvider.destroy()
            idbProvider.destroy()
        }
    }, [docId, doc])

    // Sheets metadata
    useEffect(() => {
        const sheetsMeta = doc.getArray<string>('sheets-meta')
        const sheetsColors = doc.getMap<string>('sheets-colors')
        if (sheetsMeta.length === 0) {
            sheetsMeta.push(['Sheet1'])
        }
        const syncSheets = () => {
            setSheets(sheetsMeta.toArray().map((name, i) => ({ name, color: sheetsColors.get(String(i)) })))
        }
        sheetsMeta.observe(syncSheets)
        sheetsColors.observe(syncSheets)
        syncSheets()
        return () => { sheetsMeta.unobserve(syncSheets); sheetsColors.unobserve(syncSheets) }
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
        doc.getArray<string>('sheets-meta').push([name])
    }, [doc])

    const removeSheet = useCallback((index: number) => {
        const sheetsMeta = doc.getArray<string>('sheets-meta')
        if (sheetsMeta.length <= 1) return
        sheetsMeta.delete(index, 1)
        const gridMap = doc.getMap<CellData>(`grid-${index}`)
        doc.transact(() => { gridMap.forEach((_, key) => gridMap.delete(key)) })
        if (activeSheetIndex >= sheetsMeta.length) {
            setActiveSheetIndex(sheetsMeta.length - 1)
        }
    }, [doc, activeSheetIndex])

    const renameSheet = useCallback((index: number, newName: string) => {
        const sheetsMeta = doc.getArray<string>('sheets-meta')
        doc.transact(() => {
            sheetsMeta.delete(index, 1)
            sheetsMeta.insert(index, [newName])
        })
    }, [doc])

    const setSheetColor = useCallback((index: number, color: string | undefined) => {
        const sheetsColors = doc.getMap<string>('sheets-colors')
        if (color) sheetsColors.set(String(index), color)
        else sheetsColors.delete(String(index))
    }, [doc])

    const getCrossSheetValue = useCallback((sheetName: string, r: number, c: number): string => {
        const sheetsMeta = doc.getArray<string>('sheets-meta')
        const names = sheetsMeta.toArray()
        const idx = names.findIndex(n => n.toUpperCase() === sheetName.toUpperCase())
        if (idx === -1) return ''
        const gridMap = doc.getMap<CellData>(`grid-${idx}`)
        return gridMap.get(`${r},${c}`)?.value || ''
    }, [doc])

    const undo = useCallback(() => { undoManagerRef.current?.undo() }, [])
    const redo = useCallback(() => { undoManagerRef.current?.redo() }, [])

    return {
        data, setCell, setCellStyle, setCellFull, setCellComment, setCellValidation,
        deleteCell, deleteCellRange, getCellRange, setCellRange,
        insertRow, deleteRow, insertColumn, deleteColumn,
        sortColumn, mergeCells, unmergeCells,
        isConnected, undo, redo, canUndo, canRedo,
        sheets, activeSheetIndex, setActiveSheetIndex,
        addSheet, removeSheet, renameSheet, setSheetColor,
        getCrossSheetValue,
    }
}
