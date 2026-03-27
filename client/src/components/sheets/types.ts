export interface CellStyle {
    bold?: boolean
    italic?: boolean
    strikethrough?: boolean
    underline?: boolean
    align?: 'left' | 'center' | 'right'
    verticalAlign?: 'top' | 'middle' | 'bottom'
    wrap?: boolean
    overflow?: 'visible' | 'hidden' | 'clip'
    textColor?: string
    fillColor?: string
    fontFamily?: string
    fontSize?: number
    numberFormat?: 'auto' | 'currency' | 'percent' | 'number' | 'date' | 'time' | 'datetime' | 'duration' | 'text' | 'scientific' | 'accounting'
    decimals?: number
    borderTop?: boolean
    borderRight?: boolean
    borderBottom?: boolean
    borderLeft?: boolean
    mergeRows?: number
    mergeCols?: number
    mergedInto?: string
    locked?: boolean
    rotation?: number | 'vertical'
}

export type CellValidation = 
    | { type: 'list', values: string[] }
    | { type: 'boolean' }

export interface CellData {
    value: string
    formula?: string
    style?: CellStyle
    comment?: string
    validation?: CellValidation
}

export interface SelectionBounds {
    minR: number
    maxR: number
    minC: number
    maxC: number
}

export interface SheetInfo {
    id: string
    name: string
    color?: string
}

export const TAB_COLORS = [
    '#ea4335', '#fbbc04', '#34a853', '#4a86e8', '#ff6d01',
    '#46bdc6', '#9334e6', '#d81b60', '#795548', '#607d8b',
]

export const ROWS = 10500
export const COLS = 200
export const DEFAULT_COL_WIDTH = 100
export const DEFAULT_ROW_HEIGHT = 21
export const ROW_HEADER_WIDTH = 46
export const COL_HEADER_HEIGHT = 25

export const PRESET_COLORS = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
    '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
]

export const FONTS = [
    'Arial', 'Courier New', 'Georgia', 'Times New Roman',
    'Verdana', 'Trebuchet MS', 'Comic Sans MS', 'Impact'
]
