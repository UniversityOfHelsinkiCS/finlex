import axios from 'axios'
import { useState } from 'react'
import { ThreeDot } from 'react-loading-indicators'
import SearchForm from './SearchForm'
import DocumentList from './DocumentList'
import Notification  from './Notification'
import type {Document, ListDocumentPageProps} from '../types'
import TopMenu from './TopMenu'


const ListDocumentPage = ({language, setLanguage, buttonetext, placeholdertext, apisection, frontsection} : ListDocumentPageProps) => {

  const defaultSearch = localStorage.getItem(`query_${apisection}`) || ""
  let defaultLaws: Document[] = [];
  try {
    const storedData = localStorage.getItem(`results_${apisection}`);
    defaultLaws = storedData ? JSON.parse(storedData) : [];
  } catch (error) {
    console.error("Failed to parse `results_${apisection}` from localStorage:", error);
    defaultLaws = [];
  }
  const [search, setSearch] = useState<string>(defaultSearch)
  const [laws, setLaws] = useState<Document[]>(defaultLaws)
  const [errorMessage, setErrorMessage] = useState<string>("")
  let lan: string = language


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

  const contentContainerStyle: React.CSSProperties = {
    width: '700px',
    border: '0px solid black',
    marginTop:'50px',
  }

  const loadingStyle: React.CSSProperties = {
    display: 'none',
    width: '50px',
    height: '50px',
  }

  const keywordLinkStyle: React.CSSProperties = {
    display: 'inline-block',
    marginTop: '6px',
    marginBottom: '10px',
    color: '#0C6FC0',
    textDecoration: 'none',
    fontSize: '14px'
  }

  function logError(error: unknown, msg: string) {
    console.error("Error:", error);
    localStorage.removeItem(`results_${apisection}`)
    setErrorMessage(msg)
    showError(msg)
  }

  const handleSearchEvent = async (event: React.SyntheticEvent) => {
    event.preventDefault()

    localStorage.setItem(`query_${apisection}`, search)
    doSearch()
  }

  const handleSearchInputChange = (event: React.SyntheticEvent) => {
    setSearch((event.target as HTMLInputElement).value)
  }

  const doSearch = async () => {
    setLaws([])
    const loadingScreen = document.getElementById("loadingScreen")
    if (loadingScreen) {
      loadingScreen.style.display = "inline";
    }

    try {
      const response = await axios.get(`/api/${apisection}/search`,
        { params: { q: search, language: lan } }
      )
      if (response.data.type === "resultList") {
        localStorage.setItem(`results_${apisection}`, JSON.stringify(response.data.content))
        if (loadingScreen) {
          loadingScreen.style.display = "none";
        }
        setLaws(response.data.content)
      } else if (response.data.type === "redirect") {
        const { number, year, level } = response.data.content
        if (loadingScreen) {
          loadingScreen.style.display = "none";
        }
        window.location.href = `/${frontsection}/${year}/${number}${level ? '/' + level : ''}`
      }
    } catch (error) {
      if (loadingScreen) {
        loadingScreen.style.display = "none";
      }
      if (axios.isAxiosError(error) && error.response) {
        console.error("Axios error:", error.response.data);
        if (error.response.status === 404) {
          logError(error, language === "fin" ? "Haulla ei löytynyt hakutuloksia" : "Inga sökresultat")
        } else if (error.response.status === 400) {
          logError(error, language === "fin" ? "Virheellinen haku" : "Ogiltig sökning")
        } else {
          logError(error, language === "fin" ? "Odottamaton virhe, yritä myöhemmin uudestaan" : "Okänt fel, försök igen senare")
        }
      } else {
        if (loadingScreen) {
          loadingScreen.style.display = "none";
        }
        logError(error, language === "fin" ? "Odottamaton virhe, yritä myöhemmin uudestaan" : "Okänt fel, försök igen senare")
      }

    }
  }

  function showError(errorMessage: string) {
    setErrorMessage(
      errorMessage
    )
    setLaws([])
    setTimeout(() => {
      setErrorMessage("")
    }, 2500)
  }


  const handleSelect = (event: React.SyntheticEvent) => {
    const currentValue = (event.target as HTMLInputElement).value
    localStorage.setItem("language", currentValue)
    setLanguage(currentValue)
    lan = currentValue
    doSearch()
  }

  return (
    <div id="lawpagediv">
      <div style={topStyle} id="topdiv">
        <TopMenu language={language} handleSelect={handleSelect} />

      </div>
      <div style={contentStyle} id="contentdiv">
        <div id="ccDiv" style={contentContainerStyle}>

          <SearchForm search={search}
            buttontext={buttonetext}
            placeholdertext={placeholdertext}
            handleSearchInputChange={handleSearchInputChange}
            handleSearchEvent={handleSearchEvent}
          />
          {apisection === 'statute' && (
            <a href="/lainsaadanto/asiasanat" style={keywordLinkStyle}>
              {language === 'fin' ? 'Asiasanahaku' : 'Ämnesordssökning'}
            </a>
          )}
          <div id="errorblock">
            <Notification message={errorMessage} />
          </div>
          <div style={loadingStyle} id="loadingScreen">
            <ThreeDot color="#0c6fc0" size="medium" text="" textColor="" />
          </div>

          <DocumentList laws={laws} frontsection={frontsection} language={language} />
        </div>
      </div>
    </div>
  )

}

export default ListDocumentPage
