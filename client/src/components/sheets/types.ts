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
    borderTop?: boolean
    borderRight?: boolean
    borderBottom?: boolean
    borderLeft?: boolean
    mergeRows?: number
    mergeCols?: number
    mergedInto?: string
}

export interface CellData {
    value: string
    formula?: string
    style?: CellStyle
}

export interface SelectionBounds {
    minR: number
    maxR: number
    minC: number
    maxC: number
}

export interface SheetInfo {
    name: string
}

export const ROWS = 200
export const COLS = 50
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
