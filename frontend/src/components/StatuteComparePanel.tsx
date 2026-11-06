import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

interface DiffHunk {
  tenttilex: string
  finlex: string
  contextBefore: string
  contextAfter: string
}

type CompareStatus = 'identical' | 'different' | 'missing_tenttilex' | 'missing_finlex' | 'error'

interface StatuteComparison {
  year: number
  number: string
  language: string
  tenttilexUrl: string
  finlexUrl: string
  status: CompareStatus
  error?: string
  tenttilexWords?: number
  finlexWords?: number
  hunks?: DiffHunk[]
  labelsOnlyInTenttilex?: string[]
  labelsOnlyInFinlex?: string[]
}

interface CompareYearJob {
  id: string
  year: number
  language: string
  target: string
  done: boolean
  processed: number
  total: number
  results: StatuteComparison[]
  summary?: { total: number; counts: Record<CompareStatus, number> }
  error?: string
}

interface Props {
  language: string
  buttonStyle: React.CSSProperties
  disabled?: boolean
}

const inputStyle: React.CSSProperties = { padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '120px' }
const selectStyle: React.CSSProperties = { padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }
const delStyle: React.CSSProperties = { background: '#fde2e2', color: '#8a1c1c', textDecoration: 'line-through' }
const insStyle: React.CSSProperties = { background: '#dcf5dc', color: '#1c5e1c' }

const authHeaders = () => ({ headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` } })

const statusColor = (s: CompareStatus) =>
  s === 'identical' ? '#1c5e1c' : s === 'different' ? '#8a5a00' : '#8a1c1c'

const statusText = (r: StatuteComparison, fi: boolean) => {
  switch (r.status) {
  case 'identical': return fi ? 'Tekstisisältö on sama' : 'Textinnehållet är detsamma'
  case 'different': {
    const labels = (r.labelsOnlyInTenttilex?.length ?? 0) + (r.labelsOnlyInFinlex?.length ?? 0)
    return fi
      ? `Eroja löytyi: ${r.hunks?.length ?? 0} tekstikohtaa, ${labels} muutosmerkintää`
      : `Skillnader: ${r.hunks?.length ?? 0} textställen, ${labels} ändringsmarkeringar`
  }
  case 'missing_tenttilex': return fi ? 'Lakia ei löydy Tenttilexistä' : 'Lagen finns inte i Tenttilex'
  case 'missing_finlex': return fi ? 'Lakia ei löydy finlex.fi:stä' : 'Lagen finns inte på finlex.fi'
  default: return (fi ? 'Virhe: ' : 'Fel: ') + (r.error ?? '')
  }
}

const ComparisonDetails = ({ result, fi }: { result: StatuteComparison; fi: boolean }) => (
  <div>
    <div style={{ fontSize: '14px', marginTop: '6px' }}>
      <a href={result.tenttilexUrl} target="_blank" rel="noreferrer">Tenttilex</a>
      {result.tenttilexWords !== undefined && ` (${result.tenttilexWords} ${fi ? 'sanaa' : 'ord'})`}
      {' · '}
      <a href={result.finlexUrl} target="_blank" rel="noreferrer">finlex.fi</a>
      {result.finlexWords !== undefined && ` (${result.finlexWords} ${fi ? 'sanaa' : 'ord'})`}
    </div>

    {((result.labelsOnlyInTenttilex?.length ?? 0) > 0 || (result.labelsOnlyInFinlex?.length ?? 0) > 0) && (
      <div style={{ fontSize: '14px', marginTop: '10px' }}>
        <strong>{fi ? 'Muutosmerkinnät:' : 'Ändringsmarkeringar:'}</strong>
        {(result.labelsOnlyInTenttilex?.length ?? 0) > 0 && (
          <div>{fi ? 'Vain Tenttilexissä: ' : 'Endast i Tenttilex: '}<span style={delStyle}>{result.labelsOnlyInTenttilex!.join(' ')}</span></div>
        )}
        {(result.labelsOnlyInFinlex?.length ?? 0) > 0 && (
          <div>{fi ? 'Vain finlex.fi:ssä: ' : 'Endast på finlex.fi: '}<span style={insStyle}>{result.labelsOnlyInFinlex!.join(' ')}</span></div>
        )}
      </div>
    )}

    {result.hunks && result.hunks.length > 0 && (
      <div style={{ marginTop: '10px', fontSize: '14px' }}>
        <div style={{ marginBottom: '6px' }}>
          <span style={delStyle}>{fi ? 'vain Tenttilexissä' : 'endast i Tenttilex'}</span>{' '}
          <span style={insStyle}>{fi ? 'vain finlex.fi:ssä' : 'endast på finlex.fi'}</span>
        </div>
        {result.hunks.map((h, i) => (
          <div key={i} style={{ borderTop: '1px solid #ddd', padding: '8px 0', lineHeight: 1.5 }}>
            <span style={{ color: '#666' }}>…{h.contextBefore} </span>
            {h.tenttilex && <span style={delStyle}>{h.tenttilex}</span>}
            {h.tenttilex && h.finlex && ' '}
            {h.finlex && <span style={insStyle}>{h.finlex}</span>}
            <span style={{ color: '#666' }}> {h.contextAfter}…</span>
          </div>
        ))}
      </div>
    )}
  </div>
)

const StatuteComparePanel = ({ language, buttonStyle, disabled }: Props) => {
  const fi = language === 'fin'
  const [year, setYear] = useState('')
  const [number, setNumber] = useState('')
  const [docLanguage, setDocLanguage] = useState('fin')
  const [target, setTarget] = useState('production')
  const [isComparing, setIsComparing] = useState(false)
  const [result, setResult] = useState<StatuteComparison | null>(null)
  const [job, setJob] = useState<CompareYearJob | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState('')
  const pollRef = useRef<number | null>(null)

  const stopPolling = () => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }
  useEffect(() => stopPolling, [])

  const handleCompare = async () => {
    setIsComparing(true)
    setResult(null)
    setJob(null)
    setError('')
    try {
      const resp = await axios.post<StatuteComparison>('/api/admin/compare-statute',
        { year: year.trim(), number: number.trim(), language: docLanguage, target }, authHeaders())
      setResult(resp.data)
    } catch (err) {
      console.error('Compare statute failed:', err)
      setError(fi ? 'Vertailu epäonnistui.' : 'Jämförelsen misslyckades.')
    } finally {
      setIsComparing(false)
    }
  }

  const pollJob = (jobId: string) => {
    stopPolling()
    pollRef.current = window.setInterval(async () => {
      try {
        const resp = await axios.get<CompareYearJob>(`/api/admin/compare-year/${jobId}`, authHeaders())
        setJob(resp.data)
        if (resp.data.done) {
          stopPolling()
          setIsComparing(false)
        }
      } catch (err) {
        console.error('Polling compare job failed:', err)
        stopPolling()
        setIsComparing(false)
        setError(fi ? 'Vertailun tilan haku epäonnistui.' : 'Det gick inte att hämta jämförelsens status.')
      }
    }, 2000)
  }

  const handleCompareYear = async () => {
    setIsComparing(true)
    setResult(null)
    setJob(null)
    setExpanded(null)
    setError('')
    try {
      const resp = await axios.post<{ jobId: string }>('/api/admin/compare-year',
        { year: year.trim(), language: docLanguage, target }, authHeaders())
      pollJob(resp.data.jobId)
    } catch (err) {
      console.error('Compare year failed:', err)
      if (axios.isAxiosError(err) && err.response?.status === 409 && err.response.data?.jobId) {
        // a comparison is already running: follow it
        pollJob(err.response.data.jobId)
        return
      }
      setError(fi ? 'Vertailun käynnistys epäonnistui.' : 'Det gick inte att starta jämförelsen.')
      setIsComparing(false)
    }
  }

  const sortedJobResults = job
    ? [...job.results].sort((a, b) => a.number.localeCompare(b.number, 'fi', { numeric: true }))
    : []

  return (
    <div style={{ marginTop: '30px', width: '100%', maxWidth: '800px' }}>
      <h3 style={{ textAlign: 'center' }}>
        {fi ? 'Vertaa lakia Finlexiin' : 'Jämför lag med Finlex'}
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        <strong style={{ minWidth: '160px' }}>{fi ? 'Lainsäädäntö:' : 'Lagstiftning:'}</strong>
        <input type="number" value={year} onChange={(e) => setYear(e.target.value)}
          placeholder={fi ? 'Vuosi' : 'År'} style={inputStyle} />
        <input type="text" value={number} onChange={(e) => setNumber(e.target.value)}
          placeholder={fi ? 'Numero' : 'Nummer'} style={inputStyle} />
        <select value={docLanguage} onChange={(e) => setDocLanguage(e.target.value)} style={selectStyle}>
          <option value="fin">Suomi</option>
          <option value="swe">Svenska</option>
        </select>
        <select value={target} onChange={(e) => setTarget(e.target.value)} style={selectStyle}
          title={fi ? 'Verrattava Tenttilex' : 'Tenttilex som jämförs'}>
          <option value="production">{fi ? 'Tuotanto' : 'Produktion'}</option>
          <option value="local">{fi ? 'Tämä palvelin' : 'Denna server'}</option>
        </select>
        <button style={buttonStyle} onClick={handleCompare}
          disabled={disabled || isComparing || !year.trim() || !number.trim()}>
          {fi ? 'Vertaa' : 'Jämför'}
        </button>
        <button style={buttonStyle} onClick={handleCompareYear}
          disabled={disabled || isComparing || !year.trim()}>
          {fi ? 'Vertaa koko vuosi' : 'Jämför hela året'}
        </button>
      </div>

      {isComparing && !job && <div style={{ marginTop: '12px', color: '#666' }}>{fi ? 'Verrataan...' : 'Jämför...'}</div>}
      {error && <div style={{ color: '#8a1c1c', marginTop: '12px' }}>{error}</div>}

      {result && (
        <div style={{ marginTop: '16px' }} data-testid="compare-result">
          <div style={{ fontWeight: 'bold', color: statusColor(result.status) }}>
            {result.number}/{result.year}: {statusText(result, fi)}
          </div>
          <ComparisonDetails result={result} fi={fi} />
        </div>
      )}

      {job && (
        <div style={{ marginTop: '16px' }} data-testid="compare-year-result">
          <div style={{ fontWeight: 'bold' }}>
            {job.year} ({job.language}, {job.target === 'local' ? (fi ? 'tämä palvelin' : 'denna server') : (fi ? 'tuotanto' : 'produktion')}): {job.done
              ? (fi ? 'valmis' : 'klar')
              : job.total === 0
                ? (fi ? 'haetaan lakiluetteloa...' : 'hämtar lagförteckning...')
                : `${job.processed}/${job.total} ${fi ? 'verrattu' : 'jämförda'}`}
          </div>
          {job.error && <div style={{ color: '#8a1c1c' }}>{(fi ? 'Virhe: ' : 'Fel: ') + job.error}</div>}
          {job.summary && (
            <div style={{ fontSize: '14px', marginTop: '6px' }}>
              {fi ? 'Lakeja' : 'Lagar'} {job.summary.total}:{' '}
              <span style={{ color: statusColor('identical') }}>{job.summary.counts.identical} {fi ? 'samoja' : 'lika'}</span>,{' '}
              <span style={{ color: statusColor('different') }}>{job.summary.counts.different} {fi ? 'eroavia' : 'olika'}</span>,{' '}
              <span style={{ color: statusColor('error') }}>
                {job.summary.counts.missing_tenttilex} {fi ? 'puuttuu Tenttilexistä' : 'saknas i Tenttilex'},{' '}
                {job.summary.counts.missing_finlex} {fi ? 'puuttuu finlex.fi:stä' : 'saknas på finlex.fi'},{' '}
                {job.summary.counts.error} {fi ? 'virhettä' : 'fel'}
              </span>
            </div>
          )}
          <div style={{ marginTop: '10px' }}>
            {sortedJobResults.map(r => {
              const key = `${r.number}/${r.year}`
              const open = expanded === key
              return (
                <div key={key} style={{ borderTop: '1px solid #ddd', padding: '6px 0' }}>
                  <button
                    onClick={() => setExpanded(open ? null : key)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: statusColor(r.status), fontSize: '15px' }}
                  >
                    {open ? '▾' : '▸'} <strong>{key}</strong>: {statusText(r, fi)}
                  </button>
                  {open && <ComparisonDetails result={r} fi={fi} />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default StatuteComparePanel
