import { useEffect, useState } from "react"
import LanguageSelection from "./LanguageSelection"
import type { TopMenuProps } from "../types"

const savedPagesStorageKey = "finlex.savedVisitedPages"
const savedPagesUpdatedEvent = "finlex-saved-pages-updated"

interface SavedPageEntry {
  path: string
  title: string
}

const getSavedPages = (): SavedPageEntry[] => {
  try {
    const storedPages = localStorage.getItem(savedPagesStorageKey)
    const parsedPages = storedPages ? JSON.parse(storedPages) : []

    if (!Array.isArray(parsedPages)) {
      return []
    }

    const normalizedPages: SavedPageEntry[] = []
    parsedPages.forEach((item) => {
      if (typeof item === "string") {
        normalizedPages.push({
          path: item,
          title: getPageLabel(item),
        })
        return
      }

      if (
        item !== null
        && typeof item === "object"
        && typeof item.path === "string"
      ) {
        normalizedPages.push({
          path: item.path,
          title:
            typeof item.title === "string" && item.title.trim()
              ? item.title
              : getPageLabel(item.path),
        })
      }
    })

    return normalizedPages
  } catch {
    return []
  }
}

const getPageLabel = (path: string) => {
  const cleanPath = path.endsWith("/") ? path.slice(0, -1) : path
  const parts = cleanPath.split("/")
  const section = parts[1]
  const year = parts[2]
  const id = parts[3]
  const level = parts[4]

  if (section === "oikeuskaytanto" && level) {
    return `OK ${year}/${id}/${level}`
  }

  return `L ${year}/${id}`
}

const TopMenu = ({ language, handleSelect }: TopMenuProps) => {
  const [savedPages, setSavedPages] = useState<SavedPageEntry[]>(() => getSavedPages())

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

  const savedPagesDropdownStyle: React.CSSProperties = {
    position: "relative",
  }

  const savedPagesSummaryStyle: React.CSSProperties = {
    color: "#fefefe",
    fontSize: "13px",
    border: "2px solid rgba(255,255,255,0.55)",
    borderRadius: "10px",
    padding: "3px 10px",
    whiteSpace: "nowrap",
    cursor: "pointer",
    listStyle: "none",
  }

  const savedPagesMenuStyle: React.CSSProperties = {
    position: "absolute",
    top: "32px",
    right: 0,
    minWidth: "420px",
    maxWidth: "560px",
    maxHeight: "220px",
    overflowY: "auto",
    backgroundColor: "#ffffff",
    border: "1px solid #c7d9ea",
    borderRadius: "6px",
    padding: "8px",
    boxShadow: "0 6px 14px rgba(0,0,0,0.18)",
    zIndex: 35,
  }

  const savedPagesListStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "8px",
  }

  const savedPageLinkStyle: React.CSSProperties = {
    color: "#0C6FC0",
    textDecoration: "none",
    border: "1px solid #c7d9ea",
    borderRadius: "4px",
    padding: "4px 8px",
    fontSize: "13px",
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  }

  const clearSavedPagesButtonStyle: React.CSSProperties = {
    color: "#ffffff",
    backgroundColor: "#0C6FC0",
    border: "1px solid #0C6FC0",
    borderRadius: "4px",
    padding: "4px 8px",
    fontSize: "13px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    width: "100%",
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

  const adminButtonHoverStyle: React.CSSProperties = {
    ...adminButtonStyle,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  }

  const path: string = window.location.pathname
  const lawpage: boolean = path.startsWith("/lainsaadanto")

  useEffect(() => {
    const refreshSavedPages = () => {
      setSavedPages(getSavedPages())
    }

    window.addEventListener(savedPagesUpdatedEvent, refreshSavedPages)
    window.addEventListener("storage", refreshSavedPages)

    return () => {
      window.removeEventListener(savedPagesUpdatedEvent, refreshSavedPages)
      window.removeEventListener("storage", refreshSavedPages)
    }
  }, [])

  const clearSavedPages = () => {
    setSavedPages([])
    localStorage.removeItem(savedPagesStorageKey)
    window.dispatchEvent(new Event(savedPagesUpdatedEvent))
  }

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
        {savedPages.length > 0 && (
          <details style={savedPagesDropdownStyle}>
            <summary style={savedPagesSummaryStyle}>
              {language === "fin" ? "Tallennetut" : "Sparade"}
            </summary>
            <div style={savedPagesMenuStyle}>
              <div style={savedPagesListStyle}>
                {savedPages.map((savedPage) => (
                  <a key={savedPage.path} href={savedPage.path} style={savedPageLinkStyle}>
                    {savedPage.title}
                  </a>
                ))}
              </div>
              <button type="button" onClick={clearSavedPages} style={clearSavedPagesButtonStyle}>
                {language === "fin" ? "Tyhjenna lista" : "Clear list"}
              </button>
            </div>
          </details>
        )}
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
