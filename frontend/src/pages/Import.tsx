import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { readSheet } from 'read-excel-file/browser'
import { AppShell } from '../components/AppShell'
import { useAuth } from '../hooks/useAuth'
import { useInventoryData } from '../hooks/useInventoryData'
import { getDataErrorMessage } from '../services/dataErrors'
import { importMedicines, importStock } from '../services/importService'
import type { MedicineInput } from '../types/medicine'
import type { StockInput } from '../types/stock'
import { parseCsv } from '../utils/csv'
import { MEDICINE_TEMPLATE, STOCK_TEMPLATE, parseMedicineRows, parseStockRows } from '../utils/importParse'
import type { Cell, ParsedRow } from '../utils/importParse'

type Kind = 'medicines' | 'stock'

const MAX_FILE_BYTES = 5 * 1024 * 1024

async function readRows(file: File): Promise<Cell[][]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) return parseCsv(await file.text())
  if (name.endsWith('.xlsx')) return (await readSheet(file)) as Cell[][]
  throw new Error('unsupported')
}

function downloadTemplate(kind: Kind) {
  const blob = new Blob([kind === 'medicines' ? MEDICINE_TEMPLATE : STOCK_TEMPLATE], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = kind === 'medicines' ? 'medicines-template.csv' : 'stock-template.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export function Import() {
  const { user, role } = useAuth()
  const { warehouses, medicines, stock, loading, error: loadError } = useInventoryData()

  const [kind, setKind] = useState<Kind>('medicines')
  const [fileName, setFileName] = useState('')
  const [medicineRows, setMedicineRows] = useState<ParsedRow<MedicineInput>[]>([])
  const [stockRows, setStockRows] = useState<ParsedRow<StockInput>[]>([])
  const [fatal, setFatal] = useState('')
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const rows: ParsedRow<MedicineInput | StockInput>[] = kind === 'medicines' ? medicineRows : stockRows
  const valid = rows.filter((row) => row.data)
  const skipped = rows.filter((row) => row.skipped)
  const bad = rows.filter((row) => row.errors.length > 0)

  function reset() {
    setFileName('')
    setMedicineRows([])
    setStockRows([])
    setFatal('')
  }

  function switchKind(next: Kind) {
    if (importing) return
    setKind(next)
    reset()
    setMessage(null)
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // lets the same file be chosen again
    if (!file) return
    reset()
    setMessage(null)
    if (file.size > MAX_FILE_BYTES) {
      setFatal('The file is larger than 5 MB.')
      return
    }
    setReading(true)
    try {
      const sheet = await readRows(file)
      setFileName(file.name)
      if (kind === 'medicines') {
        const parsed = parseMedicineRows(sheet, medicines.map((item) => item.name))
        setMedicineRows(parsed.rows)
        setFatal(parsed.fatal ?? '')
      } else {
        const parsed = parseStockRows(sheet, warehouses, medicines, stock)
        setStockRows(parsed.rows)
        setFatal(parsed.fatal ?? '')
      }
    } catch (err) {
      setFatal(
        err instanceof Error && err.message === 'unsupported'
          ? 'Please choose an .xlsx or .csv file. (Older .xls files: open them in Excel and save as .xlsx.)'
          : 'This file could not be read. Check that it is a valid .xlsx or .csv file.',
      )
    } finally {
      setReading(false)
    }
  }

  async function handleImport() {
    if (importing || !user || valid.length === 0) return
    setImporting(true)
    setMessage(null)
    const outcome =
      kind === 'medicines'
        ? await importMedicines(medicineRows.flatMap((row) => (row.data ? [row.data] : [])), user.uid)
        : await importStock(stockRows.flatMap((row) => (row.data ? [row.data] : [])), user.uid)
    setImporting(false)

    if (outcome.error) {
      setMessage({
        type: 'error',
        text: `${outcome.saved} saved, ${outcome.failed} not saved. ${getDataErrorMessage(outcome.error)} Fix the problem and import the file again: rows already saved are skipped as duplicates.`,
      })
    } else {
      setMessage({ type: 'success', text: `${outcome.saved} ${kind === 'medicines' ? 'medicines' : 'stock batches'} imported.` })
      reset()
    }
  }

  const notAdmin = role !== 'admin'

  return (
    <AppShell>
      <div className="page-head">
        <h1>Import from a spreadsheet</h1>
        <p>Upload your Excel (.xlsx) or CSV file. You see a preview and any problems before anything is saved.</p>
      </div>

      {notAdmin && <div className="alert alert-error" role="alert">Only admins can import data.</div>}
      {loadError && <div className="alert alert-error" role="alert">Could not load data: {loadError}</div>}

      <section className="panel">
        <div className="mode-toggle import-tabs" role="group" aria-label="What to import">
          <button type="button" className={kind === 'medicines' ? 'mode selected' : 'mode'} onClick={() => switchKind('medicines')} aria-pressed={kind === 'medicines'}>
            Medicines
          </button>
          <button type="button" className={kind === 'stock' ? 'mode selected' : 'mode'} onClick={() => switchKind('stock')} aria-pressed={kind === 'stock'}>
            Stock batches
          </button>
        </div>

        <p className="map-hint">
          {kind === 'medicines' ? (
            <>
              Needed columns: <strong>Medicine name, Units per carton, Carton length (cm), width (cm), height (cm), weight (kg)</strong>.
              Optional: Max stack (blank = 4), Fragile (yes/no), This side up (yes/no). Carton sizes are needed for the 3D packing, so rows without them are rejected.
            </>
          ) : (
            <>
              Needed columns: <strong>Warehouse, Medicine, Cartons, Batch number, Expiry date</strong>. Warehouse and medicine names must already exist
              (import medicines first). Dates: 2027-03-31 or 31/03/2027.
            </>
          )}
        </p>

        <div className="inline-actions">
          <button type="button" className="btn btn-outline btn-inline" onClick={() => downloadTemplate(kind)}>
            Download template
          </button>
          <label className={notAdmin || loading || reading || importing ? 'btn btn-primary btn-inline file-btn disabled' : 'btn btn-primary btn-inline file-btn'}>
            {reading ? 'Reading…' : loading ? 'Loading data…' : 'Choose file'}
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFile}
              disabled={notAdmin || loading || reading || importing}
            />
          </label>
          {fileName && <span className="warehouse-meta">{fileName}</span>}
        </div>

        {fatal && <div className="alert alert-error import-alert" role="alert">{fatal}</div>}
        {message && (
          <div className={message.type === 'success' ? 'alert alert-success import-alert' : 'alert alert-error import-alert'} role={message.type === 'success' ? 'status' : 'alert'}>
            {message.text}
          </div>
        )}
      </section>

      {rows.length > 0 && (
        <section className="panel" aria-labelledby="preview-heading">
          <div className="panel-head">
            <h2 id="preview-heading">Preview</h2>
            <div className="inline-actions">
              <span className="badge badge-success">{valid.length} ready</span>
              {skipped.length > 0 && <span className="badge badge-warn">{skipped.length} skipped</span>}
              {bad.length > 0 && <span className="badge badge-danger">{bad.length} with errors</span>}
            </div>
          </div>

          <div className="table-wrap import-table">
            <table className="data-table">
              <caption className="sr-only">Rows found in the file</caption>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">{kind === 'medicines' ? 'Medicine' : 'Medicine · batch'}</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 300).map((row) => (
                  <tr key={row.line}>
                    <td>{row.line}</td>
                    <td className="cell-strong">{row.label}</td>
                    <td>
                      {row.errors.length > 0 ? (
                        <span className="import-error">{row.errors.join('; ')}</span>
                      ) : row.skipped ? (
                        <span className="badge badge-warn">{row.skipped}</span>
                      ) : (
                        <span className="badge badge-success">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 300 && <p className="map-hint">Showing the first 300 of {rows.length} rows. All rows are checked.</p>}

          <div className="inline-actions import-actions">
            <button type="button" className="btn btn-primary btn-inline" onClick={handleImport} disabled={importing || valid.length === 0 || notAdmin}>
              {importing ? (<><span className="spinner" aria-hidden="true" />Importing…</>) : `Import ${valid.length} ${kind === 'medicines' ? 'medicines' : 'batches'}`}
            </button>
            <button type="button" className="btn btn-outline btn-inline" onClick={reset} disabled={importing}>
              Clear
            </button>
          </div>
        </section>
      )}
    </AppShell>
  )
}
