import LanguageSelection from "./LanguageSelection"
import type { TopMenuProps } from "../types"
import { useState } from "react"

const TopMenu = ({ language, handleSelect }: TopMenuProps) => {
  const [showTenttilexTooltip, setShowTenttilexTooltip] = useState(false)

  const menyStyle: React.CSSProperties = {
    color: "#fefefe",
    textDecoration: "none",
    border: 0,
  }

  const menyActiveStyle: React.CSSProperties = {
    color: "black",
    textDecoration: "none",
  }

  const menuDivStle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginTop: "0px",
    width: "100%",
    border: "0px solid pink",
    paddingBottom: "0px",
    position: "relative",
  }

  const menuCenterStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    gap: "30px",
  }

  const menuRightStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "10px",
    marginRight: "20px",
    position: "absolute",
    right: 0,
  }

  const secdivStyle: React.CSSProperties = {
    border: "0px solid pink",
    padding: 0,
    paddingTop: "14px",
    margin: 0,
  }

  const secdivActiveStyle: React.CSSProperties = {
    border: "0px solid pink",
    borderTop: "1px solid #0C6FC0",
    backgroundColor: "#F3F8FC",
    padding: 10,
    paddingTop: "14px",
  }

  const adminButtonStyle: React.CSSProperties = {
    color: "#fefefe",
    textDecoration: "none",
    border: "none",
    padding: "6px 12px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    backgroundColor: "transparent",
  }

  const iconButtonStyle: React.CSSProperties = {
    ...adminButtonStyle,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    padding: "0",
  }

  const adminButtonHoverStyle: React.CSSProperties = {
    ...adminButtonStyle,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  }

  const tooltipStyle: React.CSSProperties = {
    position: "absolute",
    top: "42px",
    right: "0",
    backgroundColor: "#1f1f1f",
    color: "#ffffff",
    padding: "6px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    whiteSpace: "nowrap",
    zIndex: 1000,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
  }

  const tooltipAnchorStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
  }

  const srOnlyStyle: React.CSSProperties = {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  }

  const path: string = window.location.pathname
  const lawpage: boolean = path.startsWith("/lainsaadanto")
  const tenttilexUrl = "https://finlex.ext.ocp-prod-0.k8s.it.helsinki.fi/"
  const tenttilexHoverText =
    language === "fin"
      ? "avaa tenttilex uuteen selaimeen/välilehteen"
      : "Open TenttiLex in a new tab (external site)."

  return (
    <div id="topmenudiv" style={menuDivStle}>
      <div style={menuCenterStyle}>
        <div id="lainsdiv" style={lawpage ? secdivActiveStyle : secdivStyle}>
          <a
            style={lawpage ? menyActiveStyle : menyStyle}
            href="/lainsaadanto/"
          >
            {language === "fin" ? "Lainsäädäntö" : "Lagstiftning"}
          </a>
        </div>
        <div id="oikkaytdiv" style={!lawpage ? secdivActiveStyle : secdivStyle}>
          <a
            style={!lawpage ? menyActiveStyle : menyStyle}
            href="/oikeuskaytanto/"
          >
            {language === "fin" ? "Oikeuskäytäntö" : "Rättspraxis"}
          </a>
        </div>
      </div>
      <div style={menuRightStyle}>
        <span style={tooltipAnchorStyle}>
          <a
            href={tenttilexUrl}
            title={tenttilexHoverText}
            aria-label={tenttilexHoverText}
            target="_blank"
            rel="noopener noreferrer"
            style={iconButtonStyle}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, adminButtonHoverStyle)
              setShowTenttilexTooltip(true)
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, adminButtonStyle)
              setShowTenttilexTooltip(false)
            }}
            onFocus={() => setShowTenttilexTooltip(true)}
            onBlur={() => setShowTenttilexTooltip(false)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 3h7v7" />
              <path d="M10 14L21 3" />
              <path d="M21 14v7h-18v-18h7" />
            </svg>
            <span style={srOnlyStyle}>uusi tenttilex</span>
          </a>
          {showTenttilexTooltip && (
            <span style={tooltipStyle} role="tooltip">
              {tenttilexHoverText}
            </span>
          )}
        </span>
        <LanguageSelection language={language} handleSelect={handleSelect} />
        <a
          href="/admin"
          style={adminButtonStyle}
          onMouseEnter={(e) =>
            Object.assign(e.currentTarget.style, adminButtonHoverStyle)
          }
          onMouseLeave={(e) =>
            Object.assign(e.currentTarget.style, adminButtonStyle)
          }
        >
          {language === "fin" ? "Ylläpito" : "Admin"}
        </a>
      </div>
    </div>
  )
}

export default TopMenu
