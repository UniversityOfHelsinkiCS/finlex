import React from 'react'

interface FooterDisclaimerProps {
  language?: string
}

const FooterDisclaimer = ({ language }: FooterDisclaimerProps) => {
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
  const disclaimer = language === 'swe'
    ? 'Denna webbplats är avsedd att användas enbart i samband med tentamina vid Juridiska fakulteten vid Helsingfors universitet. Annan användning av webbplatsen är förbjuden.'
    : 'Tämä sivusto on tarkoitettu käytettäväksi ainoastaan Helsingin yliopiston oikeustieteellisen tiedekunnan tenttien yhteydessä. Sivuston muunlainen käyttö on kielletty.'

  const description = language === 'swe'
    ? 'Tenttilex innehåller Finlexs gällande lagstiftning samt prejudikat från högsta förvaltningsdomstolen och högsta domstolen på finska och svenska.'
    : 'Tenttilex sisältää Finlexin ajantasaisen lainsäädännön sekä korkeimman hallinto-oikeuden ja korkeimman oikeuden ennakkopäätökset suomeksi ja ruotsiksi.'

  return (
    <footer style={style} id="footer-disclaimer">
      <div>{disclaimer}</div>
      <div>{description}</div>
    </footer>
  )
}

export default FooterDisclaimer
