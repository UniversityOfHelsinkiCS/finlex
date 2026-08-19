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
  // List pages, plus the document pages themselves:
  //   statute  /lainsaadanto/:year/:id
  //   judgment /oikeuskaytanto/:year/:id/:level
  // The :year segment is numeric, which keeps /lainsaadanto/asiasanat/:id out.
  const isListPath =
    normalizedPath === "/lainsaadanto" || normalizedPath === "/oikeuskaytanto"
  const isDocumentPath =
    /^\/lainsaadanto\/\d+\/[^/]+$/.test(normalizedPath) ||
    /^\/oikeuskaytanto\/\d+\/[^/]+\/[^/]+$/.test(normalizedPath)
  const showFooter = isListPath || isDocumentPath

  // Sits at the end of the page content rather than pinned to the viewport, so
  // it does not eat vertical space while reading.
  const style: React.CSSProperties = {
    width: "100%",
    marginTop: "24px",
    background: "#f5f5f5",
    color: "#333",
    padding: "8px 12px",
    fontSize: "11px",
    lineHeight: 1.35,
    textAlign: "center" as const,
    borderTop: "1px solid #e0e0e0",
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
