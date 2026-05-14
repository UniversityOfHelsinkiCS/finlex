import React from "react"
import { useLocation } from "react-router-dom"

interface FooterDisclaimerProps {
  language?: string
}

const FooterDisclaimer = ({ language }: FooterDisclaimerProps) => {
  const { pathname } = useLocation()
  const browserPath =
    typeof window !== "undefined" ? window.location.pathname : pathname
  const normalizedPath = browserPath.replace(/\/+$/, "") || "/"
  const showFooter =
    normalizedPath === "/lainsaadanto" || normalizedPath === "/oikeuskaytanto"

  const style: React.CSSProperties = {
    position: "fixed" as const,
    bottom: 0,
    left: 0,
    width: "100%",
    background: "#f5f5f5",
    color: "#333",
    padding: "6px 12px",
    fontSize: "12px",
    textAlign: "center" as const,
    borderTop: "1px solid #e0e0e0",
    zIndex: 1000,
    boxSizing: "border-box",
  }

  const disclaimer =
    language === "swe"
      ? "Denna webbplats är avsedd att användas enbart i samband med tentamina vid Juridiska fakulteten vid Helsingfors universitet. Annan användning av webbplatsen är förbjuden."
      : "Tämä sivusto on tarkoitettu käytettäväksi ainoastaan Helsingin yliopiston oikeustieteellisen tiedekunnan tenttien yhteydessä. Sivuston muunlainen käyttö on kielletty."

  const description =
    language === "swe"
      ? "Tenttilex innehåller Finlexs gällande lagstiftning samt prejudikat från högsta förvaltningsdomstolen och högsta domstolen på finska och svenska."
      : "Tenttilex sisältää Finlexin ajantasaisen lainsäädännön sekä korkeimman hallinto-oikeuden ja korkeimman oikeuden ennakkopäätökset suomeksi ja ruotsiksi."

  if (!showFooter) {
    return null
  }

  return (
    <footer style={style} id="footer-disclaimer">
      <div>{description}</div>
      <div>{disclaimer}</div>
    </footer>
  )
}

export default FooterDisclaimer
