import { useState, useEffect, useRef } from 'react'
import StatuteComparePanel from './StatuteComparePanel'
import axios from 'axios'
import AdminLogin from './AdminLogin'

interface AdminPageProps {
  language: string
}

interface StatusEntry {
  id: number
  date: string
  data: Record<string, unknown>
  updating: boolean
}

interface RunCheck { ok: boolean, detail: string }

// One update run (weekly scheduled, manual or index rebuild) from /api/update-runs
interface UpdateRun {
  id: number
  scheduled_for: string
  trigger: 'schedule' | 'manual' | 'rebuild'
  phase: 'fetch' | 'index' | 'verify' | 'swap' | 'done' | 'failed'
  attempts: number
  result: { ok?: boolean, error?: string | null, retryAfter?: string | null, checks?: Record<string, RunCheck> }
  started_at: string | null
  finished_at: string | null
}

interface RunsResponse { runs: UpdateRun[], scheduleEnabled: boolean, nextRun: string | null }

const isActive = (r: UpdateRun) => r.phase !== 'done' && r.phase !== 'failed'

const PHASE_LABELS: Record<UpdateRun['phase'], { fin: string, swe: string }> = {
  fetch: { fin: 'haetaan Finlexistä', swe: 'hämtar från Finlex' },
  index: { fin: 'rakennetaan hakuindeksiä (haku toimii vanhalla indeksillä)', swe: 'bygger sökindex' },
  verify: { fin: 'tarkistetaan', swe: 'kontrollerar' },
  swap: { fin: 'otetaan uusi hakuindeksi käyttöön', swe: 'tar nytt sökindex i bruk' },
  done: { fin: 'valmis', swe: 'klar' },
  failed: { fin: 'epäonnistui', swe: 'misslyckades' },
}

const TRIGGER_LABELS: Record<UpdateRun['trigger'], { fin: string, swe: string }> = {
  schedule: { fin: 'Ajastettu päivitys', swe: 'Schemalagd uppdatering' },
  manual: { fin: 'Käsin käynnistetty päivitys', swe: 'Manuell uppdatering' },
  rebuild: { fin: 'Hakuindeksin uudelleenrakennus', swe: 'Ombyggnad av sökindex' },
}

const CHECK_LABELS: Record<string, string> = {
  upToDate: 'Ajan tasalla',
  finlex: 'Sama kuin Finlex',
  indexCounts: 'Hakuindeksi täydellinen',
  search: 'Koehaut',
  live: 'Haku käytössä',
}

// Explanations shown as hover texts and as a visible list under the maintenance buttons
const HELP = {
  update: {
    labelFin: 'Päivitä', labelSwe: 'Uppdatera',
    fin: 'Sama päivitys ajetaan automaattisesti joka perjantai klo 23.55. Hakee Finlexistä uudet ja muuttuneet lait ja tuomiot aloitusvuodesta alkaen, rakentaa uuden hakuindeksin vanhan rinnalle ja tarkistaa lopuksi, että kanta on ajan tasalla ja haku toimii; vasta sitten uusi indeksi otetaan käyttöön. Jo ajan tasalla olevia lakeja ei haeta uudelleen, paitsi kahden viimeisimmän vuoden muuttamattomat lait, jotka haetaan aina (Finlex korjaa niitä ilman versionumeron muutosta). Päivitys jatkuu palvelimella, vaikka sivun sulkisi; sivusto pysyy käytössä ja näyttää ylälaidassa ilmoituksen. Jos palvelin käynnistyy uudelleen kesken päivityksen, päivitys jatkuu itsestään siitä mihin jäi.',
    swe: 'Hämtar nya och ändrade lagar och avgöranden från Finlex från startåret framåt och bygger sedan om sökindexet. Uppdaterade lagar hämtas inte på nytt. Uppdateringen fortsätter på servern även om sidan stängs. Om den avbryts, tryck igen: den fortsätter med det som saknas.',
  },
  clear: {
    labelFin: 'Tyhjennä tilat', labelSwe: 'Rensa status',
    fin: 'Hätäkeino: poistaa tiedon käynnissä olevasta päivityksestä, jolloin sivuston ylälaidan päivitysilmoitus katoaa. Ei pysäytä päivitystä eikä poista lakeja tai tuomioita. Käytä vain, jos päivitys on kaatunut ja ilmoitus on jäänyt näkyviin. Älä paina kesken käynnissä olevan päivityksen.',
    swe: 'Nödåtgärd: tar bort informationen om en pågående uppdatering så att meddelandet på webbplatsen försvinner. Stoppar inte uppdateringen och raderar inga dokument. Använd endast om uppdateringen har kraschat.',
  },
  rebuild: {
    labelFin: 'Uudelleen rakenna Typesense', labelSwe: 'Bygga om Typesense',
    fin: 'Rakentaa sivuston hakukoneen (Typesense) hakemiston uudelleen tietokannassa jo olevista asiakirjoista. Ei hae mitään Finlexistä. Tarvitaan vain, jos haku antaa puuttuvia tai vääriä tuloksia, vaikka asiakirjat näkyvät oikein. Uusi hakemisto rakennetaan vanhan rinnalle, joten haku toimii koko ajan; se otetaan käyttöön vasta tarkistusten jälkeen. Päivitä-nappi tekee tämän automaattisesti.',
    swe: 'Bygger om sökmotorns (Typesense) index från dokumenten i databasen. Hämtar inget från Finlex. Behövs endast om sökningen ger felaktiga resultat. Uppdatera gör detta automatiskt.',
  },
  startYear: {
    labelFin: 'Aloitusvuosi', labelSwe: 'Startår',
    fin: 'Päivitys käsittelee vain tämän vuoden ja sitä uudemmat vuodet. Pienempi vuosi = kattavampi mutta hitaampi päivitys. Esim. 2020 päivittää vain vuodet 2020– nopeasti; 1730 käy läpi kaikki vuodet.',
    swe: 'Uppdateringen behandlar endast detta år och senare år. Tidigare år = mer omfattande men långsammare uppdatering.',
  },
}

type StatusTone = 'running' | 'ok' | 'error' | 'warning' | 'neutral'

const STATUS_COLORS: Record<StatusTone, React.CSSProperties> = {
  running: { backgroundColor: '#e8f1fb', borderColor: '#0c6fc0', color: '#0a3d66' },
  ok: { backgroundColor: '#e6f4ea', borderColor: '#2e7d32', color: '#1b4d1f' },
  error: { backgroundColor: '#fdecea', borderColor: '#c62828', color: '#7a1414' },
  warning: { backgroundColor: '#fff4ce', borderColor: '#b58900', color: '#3d3000' },
  neutral: { backgroundColor: '#f2f2f2', borderColor: '#999', color: '#333' },
}

// Turns the latest raw status row into a sentence an admin can act on
const describeStatus = (entry: StatusEntry, language: string): { tone: StatusTone, title: string, detail?: string } => {
  const fi = language === 'fin'
  const when = new Date(entry.date).toLocaleString(fi ? 'fi-FI' : 'sv-FI')
  const d = entry.data ?? {}
  const kind = String(d.message ?? d.action ?? '')
  const years = d.from && d.to ? ` (${d.from}–${d.to})` : ''
  switch (kind) {
  case 'updating':
    return {
      tone: 'running',
      title: fi ? `🔄 Päivitys käynnissä${years}, aloitettu ${when}` : `🔄 Uppdatering pågår${years}, startad ${when}`,
      detail: fi
        ? 'Päivitys jatkuu palvelimella, vaikka sulkisit sivun. Kaikkien vuosien päivitys voi kestää tunteja. Tila päivittyy tähän automaattisesti.'
        : 'Uppdateringen fortsätter på servern även om du stänger sidan. Den kan ta timmar.',
    }
  case 'indexing':
    return {
      tone: 'running',
      title: fi ? `🔄 Lait haettu, hakuindeksiä rakennetaan (aloitettu ${when})` : `🔄 Sökindexet byggs (startat ${when})`,
      detail: fi ? 'Haku toimii koko ajan vanhalla indeksillä. Uusi otetaan käyttöön tarkistusten jälkeen.' : 'Sökningen fungerar med det gamla indexet.',
    }
  case 'verifying':
    return { tone: 'running', title: fi ? `🔄 Tarkistetaan päivityksen tulosta (aloitettu ${when})` : `🔄 Kontrollerar resultatet (startat ${when})` }
  case 'update_check_failed':
    return {
      tone: 'error',
      title: fi ? `❌ Päivitys ajettu, mutta tarkistus epäonnistui ${when}` : `❌ Kontrollen misslyckades ${when}`,
      detail: fi ? 'Katso tarkistusten tulokset alta.' : 'Se resultaten nedan.',
    }
  case 'updated':
    return { tone: 'ok', title: fi ? `✅ Päivitys valmis ja tarkistettu${years}, ${when}` : `✅ Uppdateringen klar${years}, ${when}` }
  case 'setup_failed':
    return {
      tone: 'error',
      title: fi ? `❌ Päivitys epäonnistui ${when}` : `❌ Uppdateringen misslyckades ${when}`,
      detail: (d.error ? `${d.error}. ` : '') + (fi ? 'Paina Päivitä uudelleen: jo haetut lait säilyvät ja päivitys jatkaa puuttuvista.' : 'Tryck Uppdatera igen.'),
    }
  case 'server_started':
    return {
      tone: 'warning',
      title: fi ? `Palvelin käynnistyi ${when}` : `Servern startades ${when}`,
      detail: fi
        ? 'Jos päivitys oli tuolloin käynnissä, se jatkuu automaattisesti noin minuutin kuluttua.'
        : 'En pågående uppdatering fortsätter automatiskt inom en minut.',
    }
  case 'typesense_rebuild_start':
    return { tone: 'running', title: fi ? `🔄 Hakuindeksiä rakennetaan, aloitettu ${when}` : `🔄 Sökindexet byggs om, startat ${when}` }
  case 'typesense_rebuild_complete':
    return { tone: 'ok', title: fi ? `✅ Hakuindeksi rakennettu ${when}` : `✅ Sökindexet ombyggt ${when}` }
  case 'typesense_rebuild_failed':
    return { tone: 'error', title: fi ? `❌ Hakuindeksin rakentaminen epäonnistui ${when}` : `❌ Ombyggnaden av sökindexet misslyckades ${when}`, detail: d.error ? String(d.error) : undefined }
  default:
    return { tone: entry.updating ? 'running' : 'neutral', title: `${kind || (fi ? 'Tila' : 'Status')} – ${when}` }
  }
}

const AdminPage = ({ language }: AdminPageProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [isRebuilding, setIsRebuilding] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [latestStatus, setLatestStatus] = useState<StatusEntry | null>(null)
  const [hasStartedUpdate, setHasStartedUpdate] = useState(false)
  const [startYearInput, setStartYearInput] = useState<string>('')
  const [hasStartedRebuild, setHasStartedRebuild] = useState(false)
  const [isAddingStatute, setIsAddingStatute] = useState(false)
  const [isAddingJudgment, setIsAddingJudgment] = useState(false)
  const [statuteYear, setStatuteYear] = useState('')
  const [statuteNumber, setStatuteNumber] = useState('')
  const [statuteLanguage, setStatuteLanguage] = useState('fin')
  const [judgmentYear, setJudgmentYear] = useState('')
  const [judgmentNumber, setJudgmentNumber] = useState('')
  const [judgmentLanguage, setJudgmentLanguage] = useState('fin')
  const [judgmentLevel, setJudgmentLevel] = useState('kko')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [defaultStartYear, setDefaultStartYear] = useState<number | null>(null)
  const [runsInfo, setRunsInfo] = useState<RunsResponse | null>(null)
  const activeRun = runsInfo?.runs.find(isActive) ?? null
  const busy = !!latestStatus?.updating || !!activeRun

  // Check if user is already authenticated
  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    if (token) {
      // Verify token with backend
      axios.get('/api/admin/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {
        localStorage.removeItem('adminToken')
      })
      setIsAuthenticated(!!token)
    }
  }, [])

  const pollLatestStatus = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      const response = await axios.get('/api/status/latest', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setLatestStatus(response.data)
      const runs = await axios.get<RunsResponse>('/api/update-runs', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setRunsInfo(runs.data)
    } catch (err) {
      console.error('Failed to fetch latest status:', err)
    }
  }

  const startPolling = () => {
    console.log('Starting polling...')
    pollLatestStatus() // Initial fetch
    intervalRef.current = setInterval(pollLatestStatus, 2000)
  }

  const stopPolling = () => {
    console.log('Stopping polling...')
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      stopPolling() // Cleanup on unmount
    }
  }, [])

  // Show the current status whenever the page is open, not only after pressing a button here:
  // an update runs for hours and may have been started earlier or from another browser
  useEffect(() => {
    if (!isAuthenticated) return
    pollLatestStatus()
    const id = setInterval(pollLatestStatus, 15000)
    return () => clearInterval(id)
  }, [isAuthenticated])

  // Fetch backend config (current START_YEAR) and prefill input if empty
  useEffect(() => {
    let mounted = true
    const fetchConfig = async () => {
      try {
        const token = localStorage.getItem('adminToken')
        const resp = await axios.get('/api/config', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const sy = resp.data?.startYear
        if (mounted && typeof sy === 'number') {
          setDefaultStartYear(sy)
          if (startYearInput.trim() === '') setStartYearInput(String(sy))
        }
      } catch {
        // ignore
      }
    }
    if (isAuthenticated) {
      fetchConfig()
    }
    return () => { mounted = false }
  }, [isAuthenticated, startYearInput])

  const handleUpdate = async () => {
    setIsUpdating(true)
    setMessage('')
    setError('')
    setLatestStatus(null)
    setHasStartedUpdate(true)

    try {
      const payload: Record<string, unknown> = {}
      if (startYearInput.trim() !== '') {
        const yearNum = parseInt(startYearInput, 10)
        if (!Number.isNaN(yearNum)) payload.startYear = yearNum
      }
      const token = localStorage.getItem('adminToken')
      const response = await axios.post('/api/setup', payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setMessage(language === 'fin'
        ? 'Päivitys aloitettu!'
        : 'Uppdatering startad!'
      )
      console.log('Setup response:', response.data)

      // Start polling for status updates
      startPolling()

    } catch (err) {
      console.error('Setup failed:', err)
      setError(language === 'fin'
        ? 'Päivitys epäonnistui. Tarkista konsoli lisätiedoille.'
        : 'Uppdatering misslyckades. Kontrollera konsolen för mer information.'
      )
      setIsUpdating(false)
    }
  }

  const handleClearStatus = async () => {
    setIsClearing(true)
    setMessage('')
    setError('')

    try {
      const token = localStorage.getItem('adminToken')
      const response = await axios.delete('/api/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setMessage(language === 'fin'
        ? `Tilan viestit tyhjennetty! Poistettu ${response.data.deletedCount} viestiä.`
        : `Statusmeddelanden rensade! Raderade ${response.data.deletedCount} meddelanden.`
      )
      setLatestStatus(null) // Clear the displayed status
      console.log('Clear response:', response.data)
    } catch (err) {
      console.error('Clear failed:', err)
      setError(language === 'fin'
        ? 'Tilan viestien tyhjennys epäonnistui.'
        : 'Rensning av statusmeddelanden misslyckades.'
      )
    } finally {
      setIsClearing(false)
    }
  }

  const handleRebuildTypesense = async () => {
    setIsRebuilding(true)
    setMessage('')
    setError('')
    setLatestStatus(null)
    setHasStartedRebuild(true)

    try {
      const token = localStorage.getItem('adminToken')
      const response = await axios.post('/api/rebuild-typesense', {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setMessage(language === 'fin'
        ? 'Typesense-indeksien uudelleenrakentaminen aloitettu!'
        : 'Typesense-indexombyggnad startad!'
      )
      console.log('Rebuild response:', response.data)

      // Start polling for status updates
      startPolling()

    } catch (err) {
      console.error('Rebuild failed:', err)
      setError(language === 'fin'
        ? 'Indeksien uudelleenrakentaminen epäonnistui. Tarkista konsoli lisätiedoille.'
        : 'Ombyggnad av index misslyckades. Kontrollera konsolen för mer information.'
      )
      setIsRebuilding(false)
    }
  }

  const handleAddStatute = async () => {
    setIsAddingStatute(true)
    setMessage('')
    setError('')

    try {
      const token = localStorage.getItem('adminToken')
      const payload: Record<string, string> = {
        year: statuteYear.trim(),
        number: statuteNumber.trim(),
        language: statuteLanguage
      }
      const resp = await axios.post('/api/admin/add-statute', payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setMessage(language === 'fin'
        ? `Laki lisätty: ${resp.data.statute?.number}/${resp.data.statute?.year}`
        : `Lag tillagd: ${resp.data.statute?.number}/${resp.data.statute?.year}`
      )
    } catch (err) {
      console.error('Add statute failed:', err)
      setError(language === 'fin'
        ? 'Lain lisääminen epäonnistui.'
        : 'Det gick inte att lägga till lagen.'
      )
    } finally {
      setIsAddingStatute(false)
    }
  }

  const handleAddJudgment = async () => {
    setIsAddingJudgment(true)
    setMessage('')
    setError('')

    try {
      const token = localStorage.getItem('adminToken')
      const payload: Record<string, string> = {
        year: judgmentYear.trim(),
        number: judgmentNumber.trim(),
        language: judgmentLanguage,
        level: judgmentLevel
      }
      const resp = await axios.post('/api/admin/add-judgment', payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setMessage(language === 'fin'
        ? `Tuomio lisätty: ${resp.data.judgment?.level?.toUpperCase()} ${resp.data.judgment?.number}/${resp.data.judgment?.year}`
        : `Dom tillagd: ${resp.data.judgment?.level?.toUpperCase()} ${resp.data.judgment?.number}/${resp.data.judgment?.year}`
      )
    } catch (err) {
      console.error('Add judgment failed:', err)
      setError(language === 'fin'
        ? 'Tuomion lisääminen epäonnistui.'
        : 'Det gick inte att lägga till domen.'
      )
    } finally {
      setIsAddingJudgment(false)
    }
  }

  // Stop polling when the run started from this page has finished
  useEffect(() => {
    if (!(hasStartedUpdate || hasStartedRebuild) || !runsInfo || activeRun) return
    const last = runsInfo.runs[0]
    if (!last?.finished_at) return
    setIsUpdating(false)
    setIsRebuilding(false)
    setHasStartedUpdate(false)
    setHasStartedRebuild(false)
    stopPolling()
    const fi = language === 'fin'
    if (last.phase === 'done') {
      setMessage(fi ? 'Valmis: kaikki tarkistukset menivät läpi.' : 'Klart: alla kontroller godkända.')
    } else {
      setError(fi ? 'Ajo päättyi, mutta jokin tarkistus epäonnistui. Katso tulokset alta.' : 'Körningen slutade men en kontroll misslyckades.')
    }
  }, [runsInfo, activeRun, hasStartedUpdate, hasStartedRebuild, language])

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '50px 20px',
    minHeight: '60vh'
  }

  const statusBoxStyle: React.CSSProperties = {
    marginTop: '20px',
    padding: '12px 16px',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '15px',
    lineHeight: 1.5,
    maxWidth: '800px',
    width: '100%',
    boxSizing: 'border-box',
  }

  const helpTextStyle: React.CSSProperties = {
    color: '#555',
    fontSize: '14px',
    lineHeight: 1.5,
    margin: '0 0 12px 0',
  }

  const helpListStyle: React.CSSProperties = {
    ...helpTextStyle,
    maxWidth: '800px',
    marginTop: '20px',
    paddingLeft: '20px',
  }

  const buttonStyle: React.CSSProperties = {
    backgroundColor: '#0C6FC0',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    fontSize: '16px',
    borderRadius: '4px',
    cursor: isUpdating ? 'not-allowed' : 'pointer',
    opacity: isUpdating ? 0.6 : 1,
    margin: '0 10px 20px 10px'
  }

  const clearButtonStyle: React.CSSProperties = {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    fontSize: '16px',
    borderRadius: '4px',
    cursor: (isUpdating || isClearing) ? 'not-allowed' : 'pointer',
    opacity: (isUpdating || isClearing) ? 0.6 : 1,
    margin: '0 10px 20px 10px'
  }

  const rebuildButtonStyle: React.CSSProperties = {
    backgroundColor: '#FFA500',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    fontSize: '16px',
    borderRadius: '4px',
    cursor: (isUpdating || isRebuilding) ? 'not-allowed' : 'pointer',
    opacity: (isUpdating || isRebuilding) ? 0.6 : 1,
    margin: '0 10px 20px 10px'
  }

  const messageStyle: React.CSSProperties = {
    padding: '10px',
    borderRadius: '4px',
    marginTop: '10px',
    textAlign: 'center'
  }

  const successStyle: React.CSSProperties = {
    ...messageStyle,
    backgroundColor: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb'
  }

  const errorStyle: React.CSSProperties = {
    ...messageStyle,
    backgroundColor: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb'
  }

  const jsonStyle: React.CSSProperties = {
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    padding: '15px',
    margin: '20px 0',
    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
    fontSize: '12px',
    whiteSpace: 'pre-wrap',
    overflow: 'auto',
    maxHeight: '300px',
    maxWidth: '600px',
    textAlign: 'left'
  }

  const backButtonStyle: React.CSSProperties = {
    color: '#fefefe',
    textDecoration: 'none',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    backgroundColor: 'transparent',
    marginRight: '20px',
  }

  const backButtonHoverStyle: React.CSSProperties = {
    ...backButtonStyle,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    setIsAuthenticated(false)
  }

  if (!isAuthenticated) {
    return <AdminLogin language={language} onLoginSuccess={() => setIsAuthenticated(true)} />
  }

  return (
    <div>
      <div style={{
        position: 'fixed',
        top: '0px',
        left: '0px',
        width: '100%',
        height: '50px',
        backgroundColor: '#0C6FC0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '18px',
        fontWeight: 'bold',
        boxSizing: 'border-box',
      }}>
        <div>{language === 'fin' ? 'Ylläpito' : 'Administration'}</div>
        <div style={{
          position: 'absolute',
          right: '20px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center'
        }}>
          <a
            href="/lainsaadanto/"
            style={backButtonStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, backButtonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, backButtonStyle)}
          >
            {(language === "fin") ? "Lainsäädäntö" : "Lagstiftning"}
          </a>
          <button
            onClick={handleLogout}
            style={{
              ...backButtonStyle,
              marginRight: '0',
              background: 'transparent',
              padding: '6px 12px'
            }}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, backButtonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, backButtonStyle)}
          >
            {language === "fin" ? "Kirjaudu ulos" : "Logga ut"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: '50px' }}>
        <div style={containerStyle}>
          <h2>{language === 'fin' ? 'Järjestelmän ylläpito' : 'Systemunderhåll'}</h2>

          <p style={{ textAlign: 'center', marginBottom: '30px', color: '#666' }}>
            {language === 'fin'
              ? 'Päivitä tietokanta ja hakuindeksi uusimmilla asiakirjoilla.'
              : 'Uppdatera databasen och sökindexet med de senaste dokumenten.'
            }
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '10px' }}>
              <label style={{ fontSize: '14px' }} htmlFor="admin-start-year"
                title={language === 'fin' ? HELP.startYear.fin : HELP.startYear.swe}>
                {language === 'fin' ? 'Aloitusvuosi, oletuksena .env START_YEAR:' : 'Startår:'}
              </label>
              <input
                id="admin-start-year"
                title={language === 'fin' ? HELP.startYear.fin : HELP.startYear.swe}
                type="number"
                value={startYearInput}
                onChange={(e) => setStartYearInput(e.target.value)}
                placeholder={defaultStartYear !== null ? String(defaultStartYear) : (language === 'fin' ? 'Oletus .env START_YEAR' : 'Default from .env START_YEAR')}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '140px' }}
              />
            </div>

            <button
              style={buttonStyle}
              onClick={handleUpdate}
              title={busy
                ? (language === 'fin' ? 'Päivitys on jo käynnissä. Uutta päivitystä ei voi aloittaa ennen kuin se on valmis.' : 'En uppdatering pågår redan.')
                : (language === 'fin' ? HELP.update.fin : HELP.update.swe)}
              disabled={isUpdating || isClearing || busy}
            >
              {isUpdating
                ? (language === 'fin' ? 'Päivitetään...' : 'Uppdaterar...')
                : (language === 'fin' ? 'Päivitä' : 'Uppdatera')
              }
            </button>

            <button
              style={clearButtonStyle}
              onClick={handleClearStatus}
              title={language === 'fin' ? HELP.clear.fin : HELP.clear.swe}
              disabled={isUpdating || isClearing || busy}
            >
              {isClearing
                ? (language === 'fin' ? 'Tyhjennetään...' : 'Rensar...')
                : (language === 'fin' ? 'Tyhjennä tilat' : 'Rensa status')
              }
            </button>

            <button
              style={rebuildButtonStyle}
              onClick={handleRebuildTypesense}
              title={language === 'fin' ? HELP.rebuild.fin : HELP.rebuild.swe}
              disabled={isUpdating || isRebuilding || busy}
            >
              {isRebuilding
                ? (language === 'fin' ? 'Rakennetaan uudelleen...' : 'Bygger om...')
                : (language === 'fin' ? 'Uudelleen rakenna Typesense' : 'Bygga om Typesense')
              }
            </button>
          </div>

          {latestStatus && (() => {
            const s = describeStatus(latestStatus, language)
            return (
              <div role="status" style={{ ...statusBoxStyle, ...STATUS_COLORS[s.tone] }}>
                <strong>{s.title}</strong>
                {s.detail && <div style={{ marginTop: '4px' }}>{s.detail}</div>}
              </div>
            )
          })()}

          {runsInfo && (
            <div style={{ ...statusBoxStyle, ...STATUS_COLORS.neutral }}>
              <strong>{language === 'fin' ? 'Ajastettu päivitys' : 'Schemalagd uppdatering'}: </strong>
              {runsInfo.scheduleEnabled && runsInfo.nextRun
                ? (language === 'fin' ? 'seuraava ' : 'nästa ') + new Date(runsInfo.nextRun).toLocaleString(language === 'fin' ? 'fi-FI' : 'sv-FI')
                : (language === 'fin' ? 'ei käytössä tässä ympäristössä' : 'inte i bruk')}
              {runsInfo.runs.map(run => (
                <div key={run.id} style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #ccc' }}>
                  <div>
                    {run.phase === 'done' ? '✅' : run.phase === 'failed' ? '❌' : '🔄'}{' '}
                    <strong>{language === 'fin' ? TRIGGER_LABELS[run.trigger].fin : TRIGGER_LABELS[run.trigger].swe}</strong>{' '}
                    {new Date(run.started_at ?? run.scheduled_for).toLocaleString(language === 'fin' ? 'fi-FI' : 'sv-FI')}
                    {' – '}{language === 'fin' ? PHASE_LABELS[run.phase].fin : PHASE_LABELS[run.phase].swe}
                    {run.attempts > 1 && ` (${language === 'fin' ? 'yritys' : 'försök'} ${run.attempts})`}
                  </div>
                  {run.result?.error && isActive(run) && (
                    <div style={{ color: '#7a1414' }}>
                      {language === 'fin' ? 'Edellinen yritys keskeytyi: ' : 'Föregående försök avbröts: '}{run.result.error}
                      {run.result.retryAfter && ` – ${language === 'fin' ? 'jatketaan' : 'fortsätter'} ${new Date(run.result.retryAfter).toLocaleTimeString(language === 'fin' ? 'fi-FI' : 'sv-FI')}`}
                    </div>
                  )}
                  {run.result?.error && run.phase === 'failed' && !run.result.checks && (
                    <div style={{ color: '#7a1414' }}>{run.result.error}</div>
                  )}
                  {run.result?.checks && (
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                      {Object.entries(run.result.checks).map(([key, c]) => (
                        <li key={key}>{c.ok ? '✓' : '✗'} {CHECK_LABELS[key] ?? key}: {c.detail}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          <ul style={helpListStyle}>
            {(['update', 'clear', 'rebuild', 'startYear'] as const).map(key => (
              <li key={key} style={{ marginBottom: '6px' }}>
                <strong>{language === 'fin' ? HELP[key].labelFin : HELP[key].labelSwe}:</strong>{' '}
                {language === 'fin' ? HELP[key].fin : HELP[key].swe}
              </li>
            ))}
          </ul>

          <div style={{ marginTop: '30px', width: '100%', maxWidth: '800px' }}>
            <h3 style={{ textAlign: 'center' }}>
              {language === 'fin' ? 'Lisää yksittäinen asiakirja' : 'Lägg till enstaka dokument'}
            </h3>
            <p style={helpTextStyle}>
              {language === 'fin'
                ? 'Hakee yhden lain tai tuomion Finlexistä heti ja päivittää sen myös hakuun, ilman koko tietokannan päivitystä. Jos asiakirja on jo olemassa, se korvataan Finlexin uusimmalla versiolla. Hyödyllinen, kun yksittäinen laki on muuttunut tai puuttuu.'
                : 'Hämtar en lag eller ett avgörande från Finlex direkt och uppdaterar det också i sökningen, utan att uppdatera hela databasen. Ett befintligt dokument ersätts med Finlex senaste version.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                <strong style={{ minWidth: '160px' }}>{language === 'fin' ? 'Lainsäädäntö:' : 'Lagstiftning:'}</strong>
                <input
                  type="number"
                  value={statuteYear}
                  onChange={(e) => setStatuteYear(e.target.value)}
                  placeholder={language === 'fin' ? 'Vuosi' : 'Ar'}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '120px' }}
                />
                <input
                  type="text"
                  value={statuteNumber}
                  onChange={(e) => setStatuteNumber(e.target.value)}
                  placeholder={language === 'fin' ? 'Numero' : 'Nummer'}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '120px' }}
                />
                <select
                  value={statuteLanguage}
                  onChange={(e) => setStatuteLanguage(e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="fin">Suomi</option>
                  <option value="swe">Svenska</option>
                </select>
                <button
                  style={buttonStyle}
                  onClick={handleAddStatute}
                  title={language === 'fin'
                    ? 'Hakee lain (vuosi, numero, kieli) Finlexistä ja tallentaa sen uusimman version. Esim. 2003 / 434 / Suomi.'
                    : 'Hämtar lagen (år, nummer, språk) från Finlex och sparar dess senaste version.'}
                  disabled={isUpdating || isClearing || isAddingStatute}
                >
                  {isAddingStatute
                    ? (language === 'fin' ? 'Lisätään...' : 'Lägger till...')
                    : (language === 'fin' ? 'Lisää laki' : 'Lägg till lag')
                  }
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                <strong style={{ minWidth: '160px' }}>{language === 'fin' ? 'Oikeuskäytäntö:' : 'Rättspraxis:'}</strong>
                <input
                  type="number"
                  value={judgmentYear}
                  onChange={(e) => setJudgmentYear(e.target.value)}
                  placeholder={language === 'fin' ? 'Vuosi' : 'Ar'}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '120px' }}
                />
                <input
                  type="text"
                  value={judgmentNumber}
                  onChange={(e) => setJudgmentNumber(e.target.value)}
                  placeholder={language === 'fin' ? 'Numero' : 'Nummer'}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '120px' }}
                />
                <select
                  value={judgmentLanguage}
                  onChange={(e) => setJudgmentLanguage(e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="fin">Suomi</option>
                  <option value="swe">Svenska</option>
                </select>
                <select
                  value={judgmentLevel}
                  onChange={(e) => setJudgmentLevel(e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="kko">KKO</option>
                  <option value="kho">KHO</option>
                </select>
                <button
                  style={buttonStyle}
                  onClick={handleAddJudgment}
                  title={language === 'fin'
                    ? 'Hakee ennakkopäätöksen Finlexistä. Numero ilman vuotta (esim. KKO:2024:15 → vuosi 2024, numero 15), valitse tuomioistuin KKO tai KHO.'
                    : 'Hämtar prejudikatet från Finlex. Nummer utan år (t.ex. HD:2024:15 → år 2024, nummer 15).'}
                  disabled={isUpdating || isClearing || isAddingJudgment}
                >
                  {isAddingJudgment
                    ? (language === 'fin' ? 'Lisätään...' : 'Lägger till...')
                    : (language === 'fin' ? 'Lisää tuomio' : 'Lägg till dom')
                  }
                </button>
              </div>
            </div>
          </div>

          <StatuteComparePanel language={language} buttonStyle={buttonStyle} disabled={isUpdating || isClearing} />

          {message && (
            <div style={successStyle}>
              {message}
            </div>
          )}

          {error && (
            <div style={errorStyle}>
              {error}
            </div>
          )}

          {isUpdating && (
            <div style={{ color: '#666', fontSize: '14px', textAlign: 'center' }}>
              {language === 'fin'
                ? 'Päivitys käynnistetty. Se jatkuu palvelimella, vaikka sulkisit sivun. Kaikkien vuosien päivitys voi kestää tunteja.'
                : 'Uppdateringen har startat. Den fortsätter på servern även om du stänger sidan. En uppdatering av alla år kan ta timmar.'
              }
            </div>
          )}

          {latestStatus && (
            <div style={{ width: '100%', maxWidth: '800px' }}>
              <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>
                {language === 'fin' ? 'Viimeisin tila:' : 'Senaste status:'}
              </h3>
              <div style={{ marginBottom: '10px' }}>
                <strong>{language === 'fin' ? 'Päivämäärä:' : 'Datum:'}</strong> {latestStatus.date}
              </div>
              <div>
                <strong>{language === 'fin' ? 'Tiedot:' : 'Data:'}</strong>
              </div>
              <div style={jsonStyle}>
                {JSON.stringify(latestStatus.data, null, 2)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminPage
