import {
  BrowserRouter as Router,
  Routes, Route,
} from 'react-router-dom'
import ListDocumentPage from './components/ListDocumentPage'
import DocumentPage from './components/DocumentPage'
import KeywordPage from './components/KeywordPage'
import KeywordLawPage from './components/KeywordLawPage'
import AdminPage from './components/AdminPage'
import { useState, useEffect, useCallback } from 'react'
import { Helmet } from "react-helmet"
import { ThreeDot } from 'react-loading-indicators'
import axios from 'axios'


const App = () => {
  const [language, setLanguage] = useState<string>(() => {
    return localStorage.getItem("language") || "fin"
  })

  const buttontext: string = language === "fin" ? "Hae" : "Sök"

  const [appReady, setAppReady] = useState<boolean>(true)


  if (window.location.pathname === "/") {
    window.location.href = "/lainsaadanto/"
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

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    padding: '5px',
  }

  const appLoadingStyle: React.CSSProperties = {
    marginTop: '100px',
    width: '300px',
  }

  // Always allow access to admin page, regardless of database status
  const isAdminRoute = window.location.pathname === "/admin"
  
  const checkDbStatus = useCallback(async () => {
    // Don't continuously check database status if on admin page
    if (isAdminRoute) {
      setAppReady(true)
      return
    }
    
    try {
      const response = await axios.get(`/api/check-db-status`)
      if (response.status === 200) {
        setAppReady(true)
      }

    } catch (error) { // eslint-disable-line
      setAppReady(false)
      setTimeout(() => {
        checkDbStatus()
      }, 1000)
    }
  }, [isAdminRoute])
  
  useEffect(() => {
    checkDbStatus()
  }, [checkDbStatus])
  
  if (appReady || isAdminRoute) {
    return (
      <Router>
        <div>

          <Helmet>
            <title>Finlex Lite</title>
          </Helmet>
          <Routes>
            <Route key="listpage" path="/lainsaadanto/" element={<ListDocumentPage language={language} setLanguage={setLanguage} buttonetext={buttontext}
              apisection="statute"
              frontsection='lainsaadanto'
              placeholdertext={language === "fin" ? "Vuosi tai numero/vuosi tai avainsana" : "År eller nummer/år eller nyckelord"}
            />
            }
            />
            <Route key="lawpage" path="/lainsaadanto/:year/:id"
              element={<DocumentPage language={language}  apipath="statute" />
              }
            />
            <Route key="keywords" path="/lainsaadanto/asiasanat" element={<KeywordPage language={language} />}
            />
            <Route key="keyword_laws" path="/lainsaadanto/asiasanat/:keyword_id" element={<KeywordLawPage language={language} />}
            />
            <Route key="caselistpage" path="/oikeuskaytanto"
              element={<ListDocumentPage language={language} setLanguage={setLanguage} buttonetext={buttontext} apisection="judgment"
                frontsection='oikeuskaytanto'
                placeholdertext={language === "fin" ? "Vuosi tai oikeusaste:vuosi:numero tai avainsana" : "År eller domstol:år:nummer eller nyckelord"}
              />
              }
            />
            <Route key="caselawpage" path="/oikeuskaytanto/:year/:id/:level"
              element={<DocumentPage language={language} apipath="judgment" />
              }
            />
            <Route key="admin" path="/admin" element={<AdminPage language={language} />} />
          </Routes>
        </div>
      </Router>
    )
  }  else {

    return (

      <div id="lawpagediv">
        <div style={topStyle} id="topdiv">
          &nbsp;
        </div>
        <div style={contentStyle} id="contentdiv">
          <div id="ccDiv" style={appLoadingStyle}>
            <p>{(language === "fin") ? "Sovellus ei ole käytettävissä juuri nyt." : "Appen är inte i bruk just nu."}</p>
            <ThreeDot color="#0c6fc0" size="large" text="" textColor="" />
          </div>
        </div>
      </div>

    )
  }

}

export default App
