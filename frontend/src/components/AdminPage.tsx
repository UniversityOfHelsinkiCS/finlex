import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

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
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [latestStatus, setLatestStatus] = useState<StatusEntry | null>(null)
  const [hasStartedUpdate, setHasStartedUpdate] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

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

  const handleUpdate = async () => {
    setIsUpdating(true)
    setMessage('')
    setError('')
    setLatestStatus(null)
    setHasStartedUpdate(true)

    try {
      const response = await axios.get('/api/setup')
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

  // Stop polling and updating state when updating becomes false (only if we started an update)
  useEffect(() => {
    if (latestStatus && hasStartedUpdate && !latestStatus.updating) {
      setIsUpdating(false)
      setHasStartedUpdate(false)
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
      } else {
        // Generic completion message if no specific action
        setMessage(language === 'fin'
          ? 'Päivitys valmistui!'
          : 'Uppdatering slutförd!'
        )
      }
    }
  }, [latestStatus, hasStartedUpdate, language])

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
