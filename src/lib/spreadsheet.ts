import * as XLSX from 'xlsx'

// Reading and writing spreadsheets (.xlsx, .xls, .csv) in the browser: booking
// files, unsubscribe and bounce lists, and the marketing list export.

export interface SpreadsheetData {
  headers: string[] // column headings, made unique
  rows: string[][] // one array of cell text per row, in heading order
}

const pad = (n: number) => String(n).padStart(2, '0')

// Spreadsheet date cells are day numbers (46316 = 21 Oct 2026). They are
// turned into '2026-10-21' (or '2026-10-21 14:20' with a time) from the
// number itself, so the browser's timezone can never shift them a day.
function dateText(serial: number): string {
  const days = Math.floor(serial)
  const minutes = Math.round((serial - days) * 1440)
  const { y, m, d } = XLSX.SSF.parse_date_code(days)
  const day = `${y}-${pad(m)}-${pad(d)}`
  return minutes > 0 && minutes < 1440 ? `${day} ${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}` : day
}

function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v == null || cell.t === 'e' || cell.t === 'z') return ''
  if (cell.t === 'n') {
    const value = cell.v as number
    return cell.z && XLSX.SSF.is_date(cell.z) ? dateText(value) : String(value)
  }
  if (cell.t === 'b') return cell.v ? 'TRUE' : 'FALSE'
  return String(cell.v).trim()
}

// Every cell of a sheet, as text.
function sheetGrid(sheet: XLSX.WorkSheet | undefined): string[][] {
  if (!sheet?.['!ref']) throw new Error('The sheet is empty.')
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const grid: string[][] = []
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = []
    for (let c = range.s.c; c <= range.e.c; c++) row.push(cellText(sheet[XLSX.utils.encode_cell({ r, c })]))
    grid.push(row)
  }
  return grid
}

// raw: CSV text is kept as typed, so 01/10/2026 isn't read the American way
// and 00123 keeps its zeros. cellNF: date cells keep their date format.
const readWorkbook = async (file: File) => XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true, cellNF: true })

// Every cell of the first sheet, as text.
export async function readGrid(file: File): Promise<string[][]> {
  const workbook = await readWorkbook(file)
  return sheetGrid(workbook.Sheets[workbook.SheetNames[0]])
}

// The heading row is the first row with at least two filled cells, since
// some exports start with a title line.
function tableOf(grid: string[][]): SpreadsheetData {
  const headerAt = grid.findIndex((row) => row.filter(Boolean).length >= 2)
  if (headerAt < 0) throw new Error('No heading row found. The first row should name the columns.')
  const body = grid.slice(headerAt + 1).filter((row) => row.some(Boolean))
  // leave out columns with neither a heading nor any data
  const keep = grid[headerAt].map((h, c) => !!h || body.some((row) => row[c]))

  const seen = new Map<string, number>()
  const headers = grid[headerAt]
    .map((h, c) => h || `Column ${XLSX.utils.encode_col(c)}`)
    .map((h) => {
      const n = (seen.get(h) ?? 0) + 1
      seen.set(h, n)
      return n > 1 ? `${h} (${n})` : h
    })
    .filter((_, c) => keep[c])
  const rows = body.map((row) => row.filter((_, c) => keep[c]))
  if (!rows.length) throw new Error('The file has headings but no rows below them.')
  return { headers, rows }
}

// The first sheet as headings and rows.
export async function readSpreadsheet(file: File): Promise<SpreadsheetData> {
  return tableOf(await readGrid(file))
}

// A workbook whose sheet the user picks: the names, and each sheet as headings and rows.
export async function openWorkbook(file: File) {
  const workbook = await readWorkbook(file)
  return {
    sheetNames: workbook.SheetNames,
    read: (name: string): SpreadsheetData => tableOf(sheetGrid(workbook.Sheets[name])),
  }
}

// Saves rows as a CSV file, e.g. the rows an import couldn't save, with why.
export function downloadCsv(fileName: string, headers: string[], rows: string[][]) {
  download(fileName, headers, rows, 'csv')
}

// Saves rows as an Excel file, e.g. the marketing email list.
export function downloadXlsx(fileName: string, headers: string[], rows: string[][]) {
  download(fileName, headers, rows, 'xlsx')
}

// Saves an Excel file with several tabs, e.g. the contact template and its allowed values.
export function downloadSheets(fileName: string, sheets: { name: string; headers: string[]; rows: string[][]; widths?: number[] }[]) {
  const workbook = XLSX.utils.book_new()
  for (const s of sheets) {
    const sheet = XLSX.utils.aoa_to_sheet([s.headers, ...s.rows])
    if (s.widths) sheet['!cols'] = s.widths.map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(workbook, sheet, s.name)
  }
  XLSX.writeFile(workbook, fileName, { bookType: 'xlsx' })
}

function download(fileName: string, headers: string[], rows: string[][], bookType: 'csv' | 'xlsx') {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Rows')
  XLSX.writeFile(workbook, fileName, { bookType })
}
