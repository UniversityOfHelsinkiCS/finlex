import axios from 'axios'
import type { Headings, DocumentPageProps } from "../types"
import { useEffect, useState } from 'react'
import TableOfContent from './TableOfContent'
import { useParams } from 'react-router-dom'
import {Helmet} from "react-helmet";
import TopMenu from './TopMenu'


const DocumentPage = ({language, apipath} : DocumentPageProps) => {

  const docnumber: string = useParams().id ?? ""
  const docyear: string = useParams().year ?? ""
  const doclevel: string = useParams().level ?? ""

  const [docTitle, setDocTitle] = useState<string>("Finlex Lite")
  const [law, setLaw] = useState<string>('')
  const [headings, setHeadings] = useState<Headings[]>([])
  const [lan, setLan] = useState<string>(language)
  const [backButtonHovered, setBackButtonHovered] = useState<boolean>(false)

  const topStyle: React.CSSProperties = {
    display: 'flex',
    position: 'fixed',
    top: '0px',
    left: '0px',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: '50px',
    backgroundColor: '#0C6FC0',
    padding: '0px',
    margin: '0px',
    border: '0px solid red',
    paddingLeft: '20px',
    paddingRight: '20px'
  }

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    padding: '5px',
    margin: '10px',
    border: '0px solid blue'
  }

  const contentBlockStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    padding: '0px',
    margin: '0px',
    marginTop: '70px',
    border: '0px solid pink'
  }

  const tocStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'start',
    width: '350px',
    padding: '00px',
    margin: '10px',
    border: '0px solid yellow',
  }

  const docBodyStyle: React.CSSProperties = {
    width: '600px',
    border: '0px solid pink'
  }

  const backButtonStyle: React.CSSProperties = {
    color: '#fefefe',
    textDecoration: 'none',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    backgroundColor: backButtonHovered ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
    transition: 'background-color 0.2s ease'
  }

  const getBackUrl = () => {
    if (apipath === 'statute') {
      return '/lainsaadanto/'
    } else {
      return '/oikeuskaytanto/'
    }
  }

  const buildPaths = (currentLanguage: string) => {
    let docPath = `/api/${apipath}/id/${docyear}/${docnumber}/${currentLanguage}`
    if (apipath !== 'statute') {
      docPath = `${docPath}/${doclevel}`
    }
    let structurePath = `/api/${apipath}/structure/id/${docyear}/${docnumber}/${currentLanguage}`
    if (apipath !== 'statute') {
      structurePath = `${structurePath}/${doclevel}`
    }
    return { docPath, structurePath }
  }

  const hasRequiredParams = docnumber !== "" && docyear !== ""

  const getHtml = async (path: string) => {

    try {
      const htmlResp = await axios.get(path)
      const htmlText: string = `<h1>${doclevel} ${docnumber}/${docyear} </h1> ${htmlResp.data}`
      setLaw(htmlText)
    }
    catch (error) {
      console.error(error)
    }
  }

  const getLawHtml = async (path: string) => {

    try {
      const xmlResp = await axios.get(path)
      const xmlText: string = xmlResp.data

      const xsltResp = await axios.get('/akomo_ntoso.xsl')
      const xsltText: string = xsltResp.data

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
      const xsltDoc = parser.parseFromString(xsltText, 'text/xml')

      const xsltProcessor = new XSLTProcessor()
      xsltProcessor.importStylesheet(xsltDoc)
      const resultDocumentFragment = xsltProcessor.transformToFragment(xmlDoc, document)
      const container = document.createElement('div')
      container.appendChild(resultDocumentFragment)

      setDocTitle(xmlDoc.querySelector("docTitle")?.textContent || "Lain otsikko puuttuu")

      const bodyarr = Array.from (container.querySelectorAll("article"))
      if(bodyarr.length >= 1) {
        const body = bodyarr[0].innerHTML
        setLaw(body)
      }
    }
    catch (error) {
      console.error(error)
    }
  }

  const handleSelect = (event: React.SyntheticEvent) => {
    const currentValue = (event.target as HTMLInputElement).value
    setLan(currentValue)
    localStorage.setItem("language", currentValue)
  }

  const getHeadings = async (structurePath: string) => {
    try {
      const response = await axios.get(structurePath)
      setHeadings(response.data)
    } catch(error) {
      console.error(error)
    }
  }

  useEffect(() => {
    if (!hasRequiredParams) {
      return
    }

    const { docPath, structurePath } = buildPaths(lan)
    if (apipath === "statute") {
      getLawHtml(docPath)
    } else {
      getHtml(docPath)
    }
    getHeadings(structurePath)
  }, [apipath, docnumber, docyear, doclevel, lan, hasRequiredParams])

  return (
    <>
      <Helmet>
        <title>
          {docTitle}
        </title>
      </Helmet>
      <div id="topId" style={topStyle}>
        <button
          onClick={() => window.location.href = getBackUrl()}
          style={backButtonStyle}
          onMouseEnter={() => setBackButtonHovered(true)}
          onMouseLeave={() => setBackButtonHovered(false)}
        >
          {language === 'fin' ? 'Takaisin' : 'Tillbaka'}
        </button>
        <div style={{flex: 1, display: 'flex', justifyContent: 'center'}}>
          <TopMenu language={lan} handleSelect={handleSelect} />
        </div>
      </div>
      <div id="contentDiv" style={contentStyle}>
        <div id="contentBlock" style={contentBlockStyle}>
          {hasRequiredParams ? (
            <>
              <div id="leftMargin" style={tocStyle}>
                <TableOfContent headings={headings} />
              </div>

              <div id="documentbodydiv" style={docBodyStyle} dangerouslySetInnerHTML={{ __html: law}}></div>
            </>
          ) : (
            <div style={{ padding: '20px', color: '#666' }}>
              {language === 'fin' ? 'Asiakirjaa ei voitu ladata.' : 'Dokumentet kunde inte laddas.'}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default DocumentPage
