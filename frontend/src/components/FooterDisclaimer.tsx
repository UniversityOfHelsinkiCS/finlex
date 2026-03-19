import React from 'react'

interface FooterDisclaimerProps {
  language?: string
}

const FooterDisclaimer = (_props: FooterDisclaimerProps) => {
  const style: React.CSSProperties = {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    width: '100%',
    background: '#f5f5f5',
    color: '#333',
    padding: '10px 16px',
    fontSize: '12px',
    textAlign: 'center' as const,
    borderTop: '1px solid #e0e0e0',
    zIndex: 1000,
  }
  const text = 'Tämä sivusto on tarkoitettu käytettäväksi ainoastaan Helsingin yliopiston oikeustieteellisen tiedekunnan tenttien yhteydessä. Sivuston muunlainen käyttö on kielletty.'

  return (
    <footer style={style} id="footer-disclaimer">
      {text}
    </footer>
  )
}

export default FooterDisclaimer
