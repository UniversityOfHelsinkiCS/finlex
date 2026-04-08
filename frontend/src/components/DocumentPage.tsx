import axios from 'axios'
import type { Headings, DocumentPageProps } from "../types"
import { useCallback, useEffect, useMemo, useState } from 'react'
import TableOfContent from './TableOfContent'
import { useParams } from 'react-router-dom'
import {Helmet} from "react-helmet";
import TopMenu from './TopMenu'
import { buildHighlightedHtml } from '../util/documentSearch'

const tocVisibilityStorageKey = 'finlex.document.toc.visible'
const searchVisibilityStorageKey = 'finlex.document.search.visible'

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
  const [tocButtonHovered, setTocButtonHovered] = useState<boolean>(false)
  const [searchToggleButtonHovered, setSearchToggleButtonHovered] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState<number>(0)
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
  const [isSearchVisible, setIsSearchVisible] = useState<boolean>(() => {
    try {
      const savedValue = localStorage.getItem(searchVisibilityStorageKey)
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
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    height: '50px',
    backgroundColor: '#0C6FC0',
    boxSizing: 'border-box',
    padding: '0px',
    margin: '0px',
    border: '0px solid red',
    paddingLeft: '20px',
    paddingRight: '20px'
  }

  const topCenterMenuStyle: React.CSSProperties = {
    position: 'absolute',
    left: '20px',
    right: '20px',
    width: 'auto',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
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
    display: 'grid',
    gridTemplateColumns: '40px 350px minmax(0, 900px) 288px',
    columnGap: '16px',
    alignItems: 'start',
    width: 'min(100%, 1700px)',
    padding: '0px',
    margin: '0px',
    marginTop: '70px',
    border: '0px solid pink'
  }

  const leftEmptyMarginStyle: React.CSSProperties = {
    gridColumn: '1 / 2',
    width: '100%',
    minHeight: '1px',
  }

  const tocStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'start',
    gridColumn: '2 / 3',
    width: '100%',
    padding: '0px',
    margin: '10px 0px',
    border: '0px solid yellow',
    flexShrink: 0,
    position: 'sticky',
    top: '80px',
    alignSelf: 'flex-start',
  }

  const docBodyStyle: React.CSSProperties = {
    gridColumn: '3 / 4',
    width: '100%',
    minWidth: '0',
    margin: '10px 0px',
    border: '0px solid pink'
  }

  const docBodyExpandedStyle: React.CSSProperties = {
    gridColumn: '2 / 4',
  }

  const docBodyWithSearchHiddenStyle: React.CSSProperties = {
    gridColumn: '3 / 5',
  }

  const docBodyExpandedWithSearchHiddenStyle: React.CSSProperties = {
    gridColumn: '2 / 5',
  }

  const searchPanelStyle: React.CSSProperties = {
    gridColumn: '4 / 5',
    width: '100%',
    maxWidth: '288px',
    margin: '10px 0px 10px 0px',
    border: '1px solid #0C6FC0',
    backgroundColor: '#F3F8FC',
    borderRadius: '4px',
    padding: '12px',
    position: 'sticky',
    top: '80px',
    alignSelf: 'flex-start'
  }

  const searchHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px'
  }

  const searchTitleStyle: React.CSSProperties = {
    margin: '0',
    fontSize: '14px',
    fontWeight: 'bold'
  }

  const searchCountStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#345'
  }

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #0C6FC0',
    borderRadius: '3px',
    padding: '8px 10px',
    fontSize: '14px',
    marginBottom: '10px'
  }

  const searchControlsStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '10px'
  }

  const searchButtonStyle: React.CSSProperties = {
    color: '#fafafa',
    backgroundColor: '#0C6FC0',
    fontSize: '14px',
    border: 'none',
    padding: '6px 10px',
    borderRadius: '3px',
    cursor: 'pointer'
  }

  const searchButtonDisabledStyle: React.CSSProperties = {
    ...searchButtonStyle,
    backgroundColor: '#8db4d7',
    cursor: 'not-allowed'
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
    backgroundColor: tocButtonHovered ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
    transition: 'background-color 0.2s ease'
  }

  const searchToggleButtonStyle: React.CSSProperties = {
    color: '#fefefe',
    textDecoration: 'none',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    backgroundColor: searchToggleButtonHovered ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
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

  const getDocumentReference = () => {
    const ref = `${docnumber}/${docyear}`
    return doclevel ? `${doclevel.toUpperCase()} ${ref}` : ref
  }

  const getTocButtonText = () => {
    if (lan === 'fin') {
      return isTocVisible ? 'Piilota sisällysluettelo' : 'Näytä sisällysluettelo'
    }
    return isTocVisible ? 'Dölj innehållsförteckning' : 'Visa innehållsförteckning'
  }

  const getSearchToggleButtonText = () => {
    if (lan === 'fin') {
      return isSearchVisible ? 'Piilota haku' : 'Näytä haku'
    }
    return isSearchVisible ? 'Dölj sökning' : 'Visa sökning'
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

  const handleSearchToggle = () => {
    const nextValue = !isSearchVisible
    setIsSearchVisible(nextValue)
    try {
      localStorage.setItem(searchVisibilityStorageKey, String(nextValue))
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
      setDocTitle(getDocumentReference())
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

      const parsedDocTitle = xmlDoc.querySelector("docTitle")?.textContent?.trim() || "Lain otsikko puuttuu"
      setDocTitle(`${getDocumentReference()} - ${parsedDocTitle}`)

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

  const handleSearchSubmit = (event: React.SyntheticEvent) => {
    event.preventDefault()
    if (searchMatchCount === 0) {
      return
    }

    setActiveSearchMatchIndex((currentValue) => (currentValue + 1) % searchMatchCount)
  }

  const handlePreviousSearchMatch = () => {
    if (searchMatchCount === 0) {
      return
    }

    setActiveSearchMatchIndex((currentValue) => (
      currentValue === 0 ? searchMatchCount - 1 : currentValue - 1
    ))
  }

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
    setActiveSearchMatchIndex(0)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setActiveSearchMatchIndex(0)
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
  const highlightedLaw = useMemo(() => {
    return buildHighlightedHtml(lawWithKeywords, searchQuery, activeSearchMatchIndex)
  }, [lawWithKeywords, searchQuery, activeSearchMatchIndex])

  const searchMatchCount = highlightedLaw.matchCount

  useEffect(() => {
    if (searchMatchCount === 0) {
      if (activeSearchMatchIndex !== 0) {
        setActiveSearchMatchIndex(0)
      }
      return
    }

    if (activeSearchMatchIndex >= searchMatchCount) {
      setActiveSearchMatchIndex(0)
    }
  }, [activeSearchMatchIndex, searchMatchCount])

  useEffect(() => {
    if (!searchQuery.trim() || searchMatchCount === 0) {
      return
    }

    const activeHit = document.querySelector('[data-finlex-search-active="true"]') as HTMLElement | null
    activeHit?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }, [highlightedLaw.html, searchMatchCount, searchQuery])

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
            onMouseEnter={() => setTocButtonHovered(true)}
            onMouseLeave={() => setTocButtonHovered(false)}
          >
            {getTocButtonText()}
          </button>
          <button
            onClick={handleSearchToggle}
            style={searchToggleButtonStyle}
            aria-pressed={isSearchVisible}
            aria-label={getSearchToggleButtonText()}
            onMouseEnter={() => setSearchToggleButtonHovered(true)}
            onMouseLeave={() => setSearchToggleButtonHovered(false)}
          >
            {getSearchToggleButtonText()}
          </button>
        </div>
        <div style={topCenterMenuStyle}>
          <TopMenu language={lan} handleSelect={handleSelect} />
        </div>
      </div>
      <div id="contentDiv" style={contentStyle}>
        <div id="contentBlock" style={contentBlockStyle}>
          {hasRequiredParams ? (
            <>
              <div style={leftEmptyMarginStyle} aria-hidden="true" />

              {isTocVisible && (
                <div id="leftMargin" style={tocStyle}>
                  <TableOfContent headings={headings} />
                </div>
              )}

              <div
                id="documentbodydiv"
                style={
                  isTocVisible
                    ? (isSearchVisible ? docBodyStyle : { ...docBodyStyle, ...docBodyWithSearchHiddenStyle })
                    : (isSearchVisible
                      ? { ...docBodyStyle, ...docBodyExpandedStyle }
                      : { ...docBodyStyle, ...docBodyExpandedWithSearchHiddenStyle })
                }
              >
                <div dangerouslySetInnerHTML={{ __html: highlightedLaw.html}}></div>
              </div>

              {isSearchVisible && (
                <div style={searchPanelStyle} aria-label={lan === 'fin' ? 'Sivun sisäinen haku' : 'Intern sökning på sidan'}>
                  <div style={searchHeaderStyle}>
                    <p style={searchTitleStyle}>{lan === 'fin' ? 'Hae tältä sivulta' : 'Sök på denna sida'}</p>
                    <span style={searchCountStyle} aria-live="polite">
                      {searchQuery.trim() ? `${searchMatchCount === 0 ? 0 : activeSearchMatchIndex + 1}/${searchMatchCount}` : '0/0'}
                    </span>
                  </div>
                  <form onSubmit={handleSearchSubmit}>
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={handleSearchChange}
                      style={searchInputStyle}
                      placeholder={lan === 'fin' ? 'Etsi tästä asiakirjasta' : 'Sök i detta dokument'}
                      aria-label={lan === 'fin' ? 'Etsi tästä asiakirjasta' : 'Sök i detta dokument'}
                    />
                    <div style={searchControlsStyle}>
                      <button
                        type="button"
                        onClick={handlePreviousSearchMatch}
                        style={searchMatchCount > 0 ? searchButtonStyle : searchButtonDisabledStyle}
                        disabled={searchMatchCount === 0 || !searchQuery.trim()}
                      >
                        {lan === 'fin' ? 'Edellinen' : 'Föregående'}
                      </button>
                      <button
                        type="submit"
                        style={searchMatchCount > 0 ? searchButtonStyle : searchButtonDisabledStyle}
                        disabled={searchMatchCount === 0 || !searchQuery.trim()}
                      >
                        {lan === 'fin' ? 'Seuraava' : 'Nästa'}
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        style={searchQuery.trim() ? searchButtonStyle : searchButtonDisabledStyle}
                        disabled={!searchQuery.trim()}
                      >
                        {lan === 'fin' ? 'Tyhjennä' : 'Rensa'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
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
