import LanguageSelection from "./LanguageSelection"
import type { TopMenuProps } from "../types"


const TopMenu = ({language, handleSelect}: TopMenuProps) => {

  const menyStyle: React.CSSProperties = {
    color: '#fefefe',
    textDecoration: 'none',
    border: 0,
  }

  const menyActiveStyle: React.CSSProperties = {
    color: 'black',
    textDecoration: 'none',
  }

  const menuDivStle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '0px',
    width: '100%',
    border: '0px solid pink',
    paddingBottom: '0px',
    position: 'relative',
  }

  const menuCenterStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: '30px',
  }

  const menuRightStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '10px',
    marginRight: '20px',
    position: 'absolute',
    right: 0,
  }

  const secdivStyle: React.CSSProperties = {
    border: '0px solid pink',
    padding: 0,
    paddingTop: '14px',
    margin: 0,
  }

  const secdivActiveStyle: React.CSSProperties = {
    border: '0px solid pink',
    borderTop: '1px solid #0C6FC0',
    backgroundColor: "#F3F8FC",
    padding: 10,
    paddingTop: '14px',
  }

  const adminButtonStyle: React.CSSProperties = {
    color: '#fefefe',
    textDecoration: 'none',
    border: '1px solid #fefefe',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    backgroundColor: 'transparent',
  }

  const adminButtonHoverStyle: React.CSSProperties = {
    ...adminButtonStyle,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  }

  const path: string = window.location.pathname
  const lawpage: boolean = path.startsWith("/lainsaadanto")

  return (
    <div id="topmenudiv" style={menuDivStle} >
      <div style={menuCenterStyle}>
        <div id="lainsdiv" style={lawpage ? secdivActiveStyle :  secdivStyle}>
          <a style={lawpage ? menyActiveStyle :  menyStyle} href="/lainsaadanto/">{(language === "fin") ? "Lainsäädäntö" : "Lagstiftning"}</a>
        </div>
        <div id="oikkaytdiv" style={!lawpage ? secdivActiveStyle :  secdivStyle}>
          <a style={!lawpage ? menyActiveStyle :  menyStyle} href="/oikeuskaytanto/">{(language === "fin") ? "Oikeuskäytäntö" : "Rättspraxis"}</a>
        </div>
      </div>
      <div style={menuRightStyle}>
        <LanguageSelection language={language} handleSelect={handleSelect}/>
        <a 
          href="/admin" 
          style={adminButtonStyle}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, adminButtonHoverStyle)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, adminButtonStyle)}
        >
          {(language === "fin") ? "Ylläpito" : "Admin"}
        </a>
      </div>
    </div>
  )
}

export default TopMenu
