import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

import { ErrorButton } from '../util/sentry.tsx'
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
  const [isUpdating, setIsUpdating] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [isRebuilding, setIsRebuilding] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [latestStatus, setLatestStatus] = useState<StatusEntry | null>(null)
  const [hasStartedUpdate, setHasStartedUpdate] = useState(false)
  const [startYearInput, setStartYearInput] = useState<string>('')
  const [hasStartedRebuild, setHasStartedRebuild] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [defaultStartYear, setDefaultStartYear] = useState<number | null>(null)

  const pollLatestStatus = async () => {
    try {
      const response = await axios.get('/api/status/latest')
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
        const resp = await axios.get('/api/config')
        const sy = resp.data?.startYear
        if (mounted && typeof sy === 'number') {
          setDefaultStartYear(sy)
          if (startYearInput.trim() === '') setStartYearInput(String(sy))
        }
      } catch (e) {
        // ignore
      }
    }
    fetchConfig()
    return () => { mounted = false }
  }, [])

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
      const response = await axios.post('/api/setup', payload)
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
      const response = await axios.delete('/api/status')
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
      const response = await axios.post('/api/rebuild-typesense')
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
        fontWeight: 'bold'
      }}>
        {language === 'fin' ? 'Ylläpito' : 'Administration'}
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

          {/* sentry error button */}
          <ErrorButton/>

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
