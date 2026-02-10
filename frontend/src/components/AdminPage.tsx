import { useState, useEffect, useRef } from 'react'
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
      console.log('Polled status:', response.data)
      setLatestStatus(response.data)
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
      } catch (e) {
        // ignore
      }
    }
    if (isAuthenticated) {
      fetchConfig()
    }
    return () => { mounted = false }
  }, [isAuthenticated])

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

  // Stop polling and updating state when updating becomes false (only if we started an update)
  useEffect(() => {
    if (latestStatus && (hasStartedUpdate || hasStartedRebuild) && !latestStatus.updating) {
      setIsUpdating(false)
      setIsRebuilding(false)
      setHasStartedUpdate(false)
      setHasStartedRebuild(false)
      stopPolling()

      // Check the action to determine success or failure
      const action = latestStatus.data?.action as string
      if (action === 'setup_completed') {
        setMessage(language === 'fin'
          ? 'Päivitys valmistui onnistuneesti!'
          : 'Uppdatering slutfördes framgångsrikt!'
        )
      } else if (action === 'setup_failed') {
        setError(language === 'fin'
          ? 'Päivitys epäonnistui.'
          : 'Uppdatering misslyckades.'
        )
      } else if (action === 'typesense_rebuild_complete') {
        setMessage(language === 'fin'
          ? 'Indeksien uudelleenrakentaminen valmistui onnistuneesti!'
          : 'Ombyggnad av indexen slutfördes framgångsrikt!'
        )
      } else if (action === 'typesense_rebuild_failed') {
        setError(language === 'fin'
          ? 'Indeksien uudelleenrakentaminen epäonnistui.'
          : 'Ombyggnad av indexen misslyckades.'
        )
      } else {
        // Generic completion message if no specific action
        setMessage(language === 'fin'
          ? 'Operaatio valmistui!'
          : 'Operationen slutfördes!'
        )
      }
    }
  }, [latestStatus, hasStartedUpdate, hasStartedRebuild, language])

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '50px 20px',
    minHeight: '60vh'
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
              <label style={{ fontSize: '14px' }}>{language === 'fin' ? 'Aloitusvuosi, oletuksena .env START_YEAR:' : 'Startår:'}</label>
              <input
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
              disabled={isUpdating || isClearing}
            >
              {isUpdating
                ? (language === 'fin' ? 'Päivitetään...' : 'Uppdaterar...')
                : (language === 'fin' ? 'Päivitä' : 'Uppdatera')
              }
            </button>

            <button
              style={clearButtonStyle}
              onClick={handleClearStatus}
              disabled={isUpdating || isClearing}
            >
              {isClearing
                ? (language === 'fin' ? 'Tyhjennetään...' : 'Rensar...')
                : (language === 'fin' ? 'Tyhjennä tilat' : 'Rensa status')
              }
            </button>

            <button
              style={rebuildButtonStyle}
              onClick={handleRebuildTypesense}
              disabled={isUpdating || isRebuilding}
            >
              {isRebuilding
                ? (language === 'fin' ? 'Rakennetaan uudelleen...' : 'Bygger om...')
                : (language === 'fin' ? 'Uudelleen rakenna Typesense' : 'Bygga om Typesense')
              }
            </button>
          </div>

          <div style={{ marginTop: '30px', width: '100%', maxWidth: '800px' }}>
            <h3 style={{ textAlign: 'center' }}>
              {language === 'fin' ? 'Lisää yksittäinen asiakirja' : 'Lägg till enstaka dokument'}
            </h3>
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
                ? 'Tämä voi kestää useita minuutteja...'
                : 'Detta kan ta flera minuter...'
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
