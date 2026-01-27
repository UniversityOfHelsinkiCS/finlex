import { useState } from 'react'
import axios from 'axios'
import TopMenu from './TopMenu'

interface AdminLoginProps {
  language: string
  onLoginSuccess: () => void
}

const AdminLogin = ({ language, onLoginSuccess }: AdminLoginProps) => {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await axios.post('/api/admin/login', { password })
      localStorage.setItem('adminToken', response.data.token)
      onLoginSuccess()
    } catch (err) {
      setError(language === 'fin' ? 'Väärä salasana' : 'Felaktigt lösenord')
      setPassword('')
    } finally {
      setIsLoading(false)
    }
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px'
  }

  const topStyle: React.CSSProperties = {
    display: 'flex',
    position: 'fixed',
    top: '0px',
    left: '0px',
    justifyContent: 'center',
    alignContent: 'center',
    width: '100%',
    height: '50px',
    backgroundColor: '#0C6FC0',
    padding: '0px',
    paddingBottom: '0px',
    margin: '0px',
    border: '0px solid #0C6FC0'
  }

  const formStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    width: '100%',
    maxWidth: '400px'
  }

  const titleStyle: React.CSSProperties = {
    textAlign: 'center',
    marginBottom: '30px',
    color: '#333',
    fontSize: '24px',
    fontWeight: 'bold'
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    marginBottom: '20px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '16px',
    boxSizing: 'border-box'
  }

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0C6FC0',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    opacity: isLoading ? 0.6 : 1
  }

  const errorStyle: React.CSSProperties = {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '12px',
    borderRadius: '4px',
    marginBottom: '20px',
    border: '1px solid #f5c6cb',
    textAlign: 'center'
  }

  const handleSelect = (event: React.SyntheticEvent) => {
    const currentValue = (event.target as HTMLInputElement).value
    localStorage.setItem('language', currentValue)
    // Reload to propagate language to App and routes
    window.location.reload()
  }

  return (
    <div style={containerStyle}>
      <div style={topStyle}>
        <TopMenu language={language} handleSelect={handleSelect} />
      </div>
      <div style={{ marginTop: '60px', width: '100%', display: 'flex', justifyContent: 'center' }}>
      <form style={formStyle} onSubmit={handleSubmit}>
        <h1 style={titleStyle}>
          {language === 'fin' ? 'Ylläpito' : 'Administration'}
        </h1>

        {error && <div style={errorStyle}>{error}</div>}

        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
          {language === 'fin' ? 'Salasana' : 'Lösenord'}
        </label>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={language === 'fin' ? 'Kirjoita salasana' : 'Ange lösenord'}
          style={inputStyle}
          disabled={isLoading}
          autoFocus
        />

        <button type="submit" style={buttonStyle} disabled={isLoading}>
          {isLoading
            ? (language === 'fin' ? 'Tarkistetaan...' : 'Verifierar...')
            : (language === 'fin' ? 'Kirjaudu sisään' : 'Logga in')
          }
        </button>
      </form>
      </div>
    </div>
  )
}

export default AdminLogin
