import axios from 'axios'
import type { Headings, DocumentPageProps } from "../types"
import { useCallback, useEffect, useState } from 'react'
import TableOfContent from './TableOfContent'
import { useParams } from 'react-router-dom'
import {Helmet} from "react-helmet";
import TopMenu from './TopMenu'

const tocVisibilityStorageKey = 'finlex.document.toc.visible'

interface DocumentKeyword {
  id: string,
  keyword: string
}

const DocumentPage = ({language, apipath} : DocumentPageProps) => {

  const docnumber: string = useParams().id ?? ""
  const docyear: string = useParams().year ?? ""
  const doclevel: string = useParams().level ?? ""

  const [docTitle, setDocTitle] = useState<string>("Tenttilex")
  const [law, setLaw] = useState<string>('')
  const [headings, setHeadings] = useState<Headings[]>([])
  const [keywords, setKeywords] = useState<DocumentKeyword[]>([])
  const [lan, setLan] = useState<string>(language)
  const [backButtonHovered, setBackButtonHovered] = useState<boolean>(false)
  const [isTocVisible, setIsTocVisible] = useState<boolean>(() => {
    try {
      const savedValue = localStorage.getItem(tocVisibilityStorageKey)
      if (savedValue === null) {
        return true
      }
      return savedValue === 'true'
    } catch {
      return true
    }
  })

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
    width: isTocVisible ? '600px' : 'min(900px, 100%)',
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

  const topLeftControlsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }

  const tocButtonStyle: React.CSSProperties = {
    color: '#fefefe',
    textDecoration: 'none',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    backgroundColor: isTocVisible ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
    transition: 'background-color 0.2s ease'
  }

  const getBackUrl = () => {
    if (apipath === 'statute') {
      return '/lainsaadanto/'
    } else {
      return '/oikeuskaytanto/'
    }
  }

  const getKeywordBaseUrl = () => {
    if (apipath === 'statute') {
      return '/lainsaadanto/asiasanat/'
    }
    return '/oikeuskaytanto/asiasanat/'
  }

  const getTocButtonText = () => {
    if (lan === 'fin') {
      return isTocVisible ? 'Piilota sisällysluettelo' : 'Näytä sisällysluettelo'
    }
    return isTocVisible ? 'Dölj innehållsförteckning' : 'Visa innehållsförteckning'
  }

  const handleTocToggle = () => {
    const nextValue = !isTocVisible
    setIsTocVisible(nextValue)
    try {
      localStorage.setItem(tocVisibilityStorageKey, String(nextValue))
    } catch {
      // Ignore localStorage write failures.
    }
  }

  const injectKeywordsIntoLawHtml = (html: string): string => {
    if (!html || keywords.length === 0) return html

    try {
      const parser = new DOMParser()
      const parsed = parser.parseFromString(`<div id="law-root">${html}</div>`, 'text/html')
      const root = parsed.getElementById('law-root')
      if (!root) return html

      // Avoid duplicate insertion if the content is re-rendered.
      if (root.querySelector('[data-finlex-keywords="true"]')) {
        return root.innerHTML
      }

      const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      const metadataHeading = headings.find((heading) => {
        const text = (heading.textContent || '').trim().toLowerCase()
        return text === 'metatiedot' || text === 'metadata'
      })

      const headingTag = metadataHeading ? metadataHeading.tagName.toLowerCase() : 'h3'
      const sectionHeading = parsed.createElement(headingTag)
      sectionHeading.setAttribute('data-finlex-keywords', 'true')
      sectionHeading.textContent = lan === 'fin' ? 'Asiasanat' : 'Ämnesord'

      const linksParagraph = parsed.createElement('p')
      linksParagraph.setAttribute('data-finlex-keywords', 'true')

      keywords.forEach((keyword, index) => {
        const link = parsed.createElement('a')
        link.href = `${getKeywordBaseUrl()}${encodeURIComponent(keyword.id)}`
        link.textContent = keyword.keyword
        linksParagraph.appendChild(link)

        if (index < keywords.length - 1) {
          linksParagraph.appendChild(parsed.createTextNode(', '))
        }
      })

      const section = parsed.createElement('div')
      section.setAttribute('data-finlex-keywords', 'true')
      section.appendChild(sectionHeading)
      section.appendChild(linksParagraph)

      if (metadataHeading) {
        let insertBefore: Element | null = null
        let nextNode = metadataHeading.nextElementSibling

        while (nextNode) {
          const tag = nextNode.tagName.toLowerCase()
          if (/^h[1-6]$/.test(tag)) {
            insertBefore = nextNode
            break
          }
          nextNode = nextNode.nextElementSibling
        }

        if (insertBefore) {
          root.insertBefore(section, insertBefore)
        } else {
          // If there is no following heading, place keywords right after metadata content.
          const metadataContainer = metadataHeading.closest('section')
          if (metadataContainer && metadataContainer.parentElement) {
            metadataContainer.insertAdjacentElement('afterend', section)
          } else if (metadataHeading.nextElementSibling) {
            metadataHeading.nextElementSibling.insertAdjacentElement('afterend', section)
          } else {
            metadataHeading.insertAdjacentElement('afterend', section)
          }
        }
      } else {
        root.insertBefore(section, root.firstChild)
      }

      return root.innerHTML
    } catch (error) {
      console.error(error)
      return html
    }
  }

  const buildPaths = useCallback((currentLanguage: string) => {
    let docPath = `/api/${apipath}/id/${docyear}/${docnumber}/${currentLanguage}`
    if (apipath !== 'statute') {
      docPath = `${docPath}/${doclevel}`
    }
    let structurePath = `/api/${apipath}/structure/id/${docyear}/${docnumber}/${currentLanguage}`
    if (apipath !== 'statute') {
      structurePath = `${structurePath}/${doclevel}`
    }
    let keywordsPath = `/api/${apipath}/keywords/id/${docyear}/${docnumber}/${currentLanguage}`
    if (apipath !== 'statute') {
      keywordsPath = `${keywordsPath}/${doclevel}`
    }
    return { docPath, structurePath, keywordsPath }
  }, [apipath, docyear, docnumber, doclevel])

  const hasRequiredParams = docnumber !== "" && docyear !== ""

  const getHtml = useCallback(async (path: string) => {

    try {
      const htmlResp = await axios.get(path)
      const levelLabel = doclevel ? doclevel.toUpperCase() : ''
      const htmlText: string = `<h1>${levelLabel} ${docnumber}/${docyear} </h1> ${htmlResp.data}`
      setLaw(htmlText)
    }
    catch (error) {
      console.error(error)
    }
  }, [doclevel, docnumber, docyear])

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

  const getKeywords = async (keywordsPath: string) => {
    try {
      const response = await axios.get(keywordsPath)
      if (Array.isArray(response.data)) {
        const parsedKeywords: DocumentKeyword[] = response.data
          .filter((item): item is DocumentKeyword => (
            item !== null
            && typeof item === 'object'
            && typeof item.id === 'string'
            && typeof item.keyword === 'string'
          ))
        setKeywords(parsedKeywords)
      } else {
        setKeywords([])
      }
    } catch (error) {
      console.error(error)
      setKeywords([])
    }
  }

  useEffect(() => {
    if (!hasRequiredParams) {
      return
    }

    const { docPath, structurePath, keywordsPath } = buildPaths(lan)
    if (apipath === "statute") {
      getLawHtml(docPath)
    } else {
      getHtml(docPath)
    }
    getHeadings(structurePath)
    getKeywords(keywordsPath)
  }, [apipath, docnumber, docyear, doclevel, lan, hasRequiredParams, buildPaths, getHtml])

  const lawWithKeywords = injectKeywordsIntoLawHtml(law)

  return (
    <>
      <Helmet>
        <title>
          {docTitle}
        </title>
      </Helmet>
      <div id="topId" style={topStyle}>
        <div style={topLeftControlsStyle}>
          <button
            onClick={() => window.location.href = getBackUrl()}
            style={backButtonStyle}
            onMouseEnter={() => setBackButtonHovered(true)}
            onMouseLeave={() => setBackButtonHovered(false)}
          >
            {language === 'fin' ? 'Takaisin' : 'Tillbaka'}
          </button>
          <button
            onClick={handleTocToggle}
            style={tocButtonStyle}
            aria-pressed={isTocVisible}
            aria-label={getTocButtonText()}
          >
            {getTocButtonText()}
          </button>
        </div>
        <div style={{flex: 1, display: 'flex', justifyContent: 'center'}}>
          <TopMenu language={lan} handleSelect={handleSelect} />
        </div>
      </div>
      <div id="contentDiv" style={contentStyle}>
        <div id="contentBlock" style={contentBlockStyle}>
          {hasRequiredParams ? (
            <>
              {isTocVisible && (
                <div id="leftMargin" style={tocStyle}>
                  <TableOfContent headings={headings} />
                </div>
              )}

              <div id="documentbodydiv" style={docBodyStyle}>
                <div dangerouslySetInnerHTML={{ __html: lawWithKeywords}}></div>
              </div>
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
