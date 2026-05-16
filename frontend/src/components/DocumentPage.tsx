import axios from "axios"
import type { Headings, DocumentPageProps } from "../types"
import { useCallback, useEffect, useMemo, useState } from "react"
import TableOfContent from "./TableOfContent"
import { useParams } from "react-router-dom"
import { Helmet } from "react-helmet"
import TopMenu from "./TopMenu"
import { buildHighlightedHtml } from "../util/documentSearch"

const tocVisibilityStorageKey = "finlex.document.toc.visible"
const searchVisibilityStorageKey = "finlex.document.search.visible"
const savedPagesStorageKey = "finlex.savedVisitedPages"
const savedPagesUpdatedEvent = "finlex-saved-pages-updated"

interface SavedPageEntry {
  path: string
  title: string
}

interface DocumentKeyword {
  id: string
  keyword: string
}

const DocumentPage = ({ language, apipath }: DocumentPageProps) => {
  const docnumber: string = useParams().id ?? ""
  const docyear: string = useParams().year ?? ""
  const doclevel: string = useParams().level ?? ""

  const [docTitle, setDocTitle] = useState<string>("Tenttilex")
  const [law, setLaw] = useState<string>("")
  const [headings, setHeadings] = useState<Headings[]>([])
  const [keywords, setKeywords] = useState<DocumentKeyword[]>([])
  const [lan, setLan] = useState<string>(language)
  const [backButtonHovered, setBackButtonHovered] = useState<boolean>(false)
  const [isCurrentPageSaved, setIsCurrentPageSaved] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] =
    useState<number>(0)
  const [isTocVisible, setIsTocVisible] = useState<boolean>(() => {
    try {
      const savedValue = localStorage.getItem(tocVisibilityStorageKey)
      if (savedValue === null) {
        return true
      }
      return savedValue === "true"
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
      return savedValue === "true"
    } catch {
      return true
    }
  })

  const isCompactViewport =
    typeof window !== "undefined" && window.innerWidth < 1000
  const tocColumnWidth = isTocVisible
    ? isCompactViewport
      ? "200px"
      : "320px"
    : "24px"
  const searchColumnWidth = isSearchVisible
    ? isCompactViewport
      ? "200px"
      : "272px"
    : "24px"

  const topStyle: React.CSSProperties = {
    display: "flex",
    position: "fixed",
    top: "0px",
    left: "0px",
    zIndex: 20,
    alignItems: "center",
    justifyContent: "flex-start",
    width: "100%",
    height: "50px",
    backgroundColor: "#0C6FC0",
    boxSizing: "border-box",
    padding: "0px",
    margin: "0px",
    border: "0px solid red",
    paddingLeft: "20px",
    paddingRight: "20px",
  }

  const topCenterMenuStyle: React.CSSProperties = {
    position: "absolute",
    left: "20px",
    right: "20px",
    width: "auto",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  }

  const contentStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    padding: "5px 0px",
    margin: "10px 0px",
    border: "0px solid blue",
    overflowX: "clip",
  }

  const contentBlockStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `4px ${tocColumnWidth} minmax(0, 1fr) ${searchColumnWidth} 4px`,
    columnGap: "12px",
    alignItems: "start",
    width: "100%",
    maxWidth: "100vw",
    padding: "0px",
    margin: "0px",
    marginTop: "70px",
    border: "0px solid pink",
    boxSizing: "border-box",
  }

  const leftEmptyMarginStyle: React.CSSProperties = {
    gridColumn: "1 / 2",
    width: "100%",
    minHeight: "1px",
  }

  const rightEmptyMarginStyle: React.CSSProperties = {
    gridColumn: "5 / 6",
    width: "100%",
    minHeight: "1px",
  }

  const tocStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    justifyContent: "start",
    gridColumn: "2 / 3",
    gridRow: "1 / 2",
    width: "100%",
    padding: "0px",
    margin: "6px 0px",
    border: "0px solid yellow",
    flexShrink: 0,
    position: "sticky",
    top: "60px",
    alignSelf: "flex-start",
  }

  const docBodyStyle: React.CSSProperties = {
    gridColumn: "3 / 4",
    gridRow: "1 / 2",
    width: "100%",
    minWidth: "0",
    margin: "10px 0px",
    border: "0px solid pink",
  }

  const docBodyExpandedStyle: React.CSSProperties = {
    gridColumn: "3 / 4",
  }

  const docBodyWithSearchHiddenStyle: React.CSSProperties = {
    gridColumn: "3 / 4",
  }

  const docBodyExpandedWithSearchHiddenStyle: React.CSSProperties = {
    gridColumn: "3 / 4",
  }

  const searchPanelStyle: React.CSSProperties = {
    gridColumn: "4 / 5",
    gridRow: "1 / 2",
    width: "100%",
    maxWidth: "272px",
    margin: "6px 0px 6px 0px",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    position: "sticky",
    top: "60px",
    alignSelf: "flex-start",
  }

  const searchPanelContentStyle: React.CSSProperties = {
    border: "1px solid #0C6FC0",
    backgroundColor: "#F3F8FC",
    borderRadius: "4px",
    padding: "12px",
    boxSizing: "border-box",
    width: "100%",
  }

  const searchHeaderStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px",
  }

  const searchTitleStyle: React.CSSProperties = {
    margin: "0",
    fontSize: "14px",
    fontWeight: "bold",
  }

  const searchCountStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#345",
  }

  const searchInputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #0C6FC0",
    borderRadius: "3px",
    padding: "8px 10px",
    fontSize: "14px",
    marginBottom: "10px",
  }

  const searchControlsStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "10px",
  }

  const searchButtonStyle: React.CSSProperties = {
    color: "#fafafa",
    backgroundColor: "#0C6FC0",
    fontSize: "14px",
    border: "none",
    padding: "6px 10px",
    borderRadius: "3px",
    cursor: "pointer",
  }

  const searchButtonDisabledStyle: React.CSSProperties = {
    ...searchButtonStyle,
    backgroundColor: "#8db4d7",
    cursor: "not-allowed",
  }

  const backButtonStyle: React.CSSProperties = {
    color: "#fefefe",
    textDecoration: "none",
    border: "none",
    padding: "6px 12px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    backgroundColor: backButtonHovered
      ? "rgba(255, 255, 255, 0.2)"
      : "transparent",
    transition: "background-color 0.2s ease",
  }

  const topLeftControlsStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    position: "relative",
    zIndex: 2,
  }

  const saveButtonStyle: React.CSSProperties = {
    color: "#ffffff",
    backgroundColor: "#d97706",
    border: "1px solid #d97706",
    borderRadius: "4px",
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: "14px",
  }

  const saveButtonSavedStyle: React.CSSProperties = {
    ...saveButtonStyle,
    backgroundColor: "#2e7d32",
    borderColor: "#2e7d32",
    opacity: 1,
    cursor: "default",
  }

  const documentActionsStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: "12px",
  }

  const sideToggleButtonStyle: React.CSSProperties = {
    color: "#0C6FC0",
    textDecoration: "none",
    border: "1px solid #0C6FC0",
    padding: "4px 8px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "13px",
    backgroundColor: "#FFFFFF",
    width: "fit-content",
    maxWidth: "100%",
    whiteSpace: "nowrap",
    textAlign: "left",
    marginBottom: "8px",
  }

  const searchSideToggleButtonStyle: React.CSSProperties = {
    ...sideToggleButtonStyle,
    alignSelf: "flex-end",
    marginLeft: "auto",
  }

  const collapsedSidebarToggleButtonStyle: React.CSSProperties = {
    color: "#FFFFFF",
    textDecoration: "none",
    border: "1px solid #0C6FC0",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "13px",
    backgroundColor: "#0C6FC0",
    width: "100%",
    minHeight: "116px",
    padding: "6px 0px",
    marginBottom: "0px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    writingMode: "vertical-rl",
    textOrientation: "mixed",
    lineHeight: "1",
    letterSpacing: "0.02em",
  }

  const collapsedTocButtonStyle: React.CSSProperties = {
    ...collapsedSidebarToggleButtonStyle,
    alignSelf: "flex-start",
    paddingLeft: "0px",
    paddingRight: "0px",
  }

  const collapsedSearchButtonStyle: React.CSSProperties = {
    ...collapsedSidebarToggleButtonStyle,
    alignSelf: "flex-end",
    paddingLeft: "0px",
    paddingRight: "0px",
  }

  const getBackUrl = () => {
    if (apipath === "statute") {
      return "/lainsaadanto/"
    } else {
      return "/oikeuskaytanto/"
    }
  }

  const getKeywordBaseUrl = () => {
    if (apipath === "statute") {
      return "/lainsaadanto/asiasanat/"
    }
    return "/oikeuskaytanto/asiasanat/"
  }

  const getDocumentReference = () => {
    const ref = `${docnumber}/${docyear}`
    return doclevel ? `${doclevel.toUpperCase()} ${ref}` : ref
  }

  const getTocButtonText = () => {
    if (lan === "fin") {
      return isTocVisible
        ? "Piilota sisällysluettelo"
        : "Näytä sisällysluettelo"
    }
    return isTocVisible
      ? "Dölj innehållsförteckning"
      : "Visa innehållsförteckning"
  }

  const getSearchToggleButtonText = () => {
    if (lan === "fin") {
      return isSearchVisible ? "Piilota haku" : "Näytä haku"
    }
    return isSearchVisible ? "Dölj sökning" : "Visa sökning"
  }

  const getCurrentDocumentPath = useCallback(() => {
    if (apipath === "statute" && docyear && docnumber) {
      return `/lainsaadanto/${docyear}/${docnumber}`
    }

    if (apipath !== "statute" && docyear && docnumber && doclevel) {
      return `/oikeuskaytanto/${docyear}/${docnumber}/${doclevel}`
    }

    return ""
  }, [apipath, docyear, docnumber, doclevel])

  const syncCurrentPageSavedState = useCallback(() => {
    const currentPath = getCurrentDocumentPath()
    if (!currentPath) {
      setIsCurrentPageSaved(false)
      return
    }

    try {
      const savedPagesRaw = localStorage.getItem(savedPagesStorageKey)
      const savedPages = savedPagesRaw ? JSON.parse(savedPagesRaw) : []
      if (Array.isArray(savedPages)) {
        const isSaved = savedPages.some((item) => {
          if (typeof item === "string") {
            return item === currentPath
          }

          if (
            item !== null
            && typeof item === "object"
            && typeof item.path === "string"
          ) {
            return item.path === currentPath
          }

          return false
        })
        setIsCurrentPageSaved(isSaved)
        return
      }
    } catch {
      // Ignore localStorage parse failures.
    }

    setIsCurrentPageSaved(false)
  }, [getCurrentDocumentPath])

  const handleSaveCurrentPage = () => {
    const currentPath = getCurrentDocumentPath()
    if (!currentPath) {
      return
    }

    try {
      const savedPagesRaw = localStorage.getItem(savedPagesStorageKey)
      const savedPages = savedPagesRaw ? JSON.parse(savedPagesRaw) : []
      const parsedSavedPages: SavedPageEntry[] = Array.isArray(savedPages)
        ? savedPages
            .map((item) => {
              if (typeof item === "string") {
                return { path: item, title: item }
              }
              if (
                item !== null
                && typeof item === "object"
                && typeof item.path === "string"
              ) {
                return {
                  path: item.path,
                  title:
                    typeof item.title === "string" && item.title.trim()
                      ? item.title
                      : item.path,
                }
              }
              return null
            })
            .filter((item): item is SavedPageEntry => item !== null)
        : []

      if (!parsedSavedPages.some((item) => item.path === currentPath)) {
        const savedTitle = docTitle && docTitle !== "Tenttilex"
          ? docTitle
          : `${docnumber}/${docyear}`
        const updatedPages = [
          { path: currentPath, title: savedTitle },
          ...parsedSavedPages,
        ].slice(0, 8)
        localStorage.setItem(savedPagesStorageKey, JSON.stringify(updatedPages))
      }

      setIsCurrentPageSaved(true)
      window.dispatchEvent(new Event(savedPagesUpdatedEvent))
    } catch {
      // Ignore localStorage write failures.
    }
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
      const parsed = parser.parseFromString(
        `<div id="law-root">${html}</div>`,
        "text/html",
      )
      const root = parsed.getElementById("law-root")
      if (!root) return html

      // Avoid duplicate insertion if the content is re-rendered.
      if (root.querySelector('[data-finlex-keywords="true"]')) {
        return root.innerHTML
      }

      const headings = Array.from(
        root.querySelectorAll("h1, h2, h3, h4, h5, h6"),
      )
      const metadataHeading = headings.find((heading) => {
        const text = (heading.textContent || "").trim().toLowerCase()
        return text === "metatiedot" || text === "metadata"
      })

      const headingTag = metadataHeading
        ? metadataHeading.tagName.toLowerCase()
        : "h3"
      const sectionHeading = parsed.createElement(headingTag)
      sectionHeading.setAttribute("data-finlex-keywords", "true")
      sectionHeading.textContent = lan === "fin" ? "Asiasanat" : "Ämnesord"

      const linksParagraph = parsed.createElement("p")
      linksParagraph.setAttribute("data-finlex-keywords", "true")

      keywords.forEach((keyword, index) => {
        const link = parsed.createElement("a")
        link.href = `${getKeywordBaseUrl()}${encodeURIComponent(keyword.id)}`
        link.textContent = keyword.keyword
        linksParagraph.appendChild(link)

        if (index < keywords.length - 1) {
          linksParagraph.appendChild(parsed.createTextNode(", "))
        }
      })

      const section = parsed.createElement("div")
      section.setAttribute("data-finlex-keywords", "true")
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
          const metadataContainer = metadataHeading.closest("section")
          if (metadataContainer && metadataContainer.parentElement) {
            metadataContainer.insertAdjacentElement("afterend", section)
          } else if (metadataHeading.nextElementSibling) {
            metadataHeading.nextElementSibling.insertAdjacentElement(
              "afterend",
              section,
            )
          } else {
            metadataHeading.insertAdjacentElement("afterend", section)
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

  const buildPaths = useCallback(
    (currentLanguage: string) => {
      let docPath = `/api/${apipath}/id/${docyear}/${docnumber}/${currentLanguage}`
      if (apipath !== "statute") {
        docPath = `${docPath}/${doclevel}`
      }
      let structurePath = `/api/${apipath}/structure/id/${docyear}/${docnumber}/${currentLanguage}`
      if (apipath !== "statute") {
        structurePath = `${structurePath}/${doclevel}`
      }
      let keywordsPath = `/api/${apipath}/keywords/id/${docyear}/${docnumber}/${currentLanguage}`
      if (apipath !== "statute") {
        keywordsPath = `${keywordsPath}/${doclevel}`
      }
      return { docPath, structurePath, keywordsPath }
    },
    [apipath, docyear, docnumber, doclevel],
  )

  const hasRequiredParams = docnumber !== "" && docyear !== ""

  const getHtml = useCallback(
    async (path: string) => {
      try {
        const htmlResp = await axios.get(path)
        const levelLabel = doclevel ? doclevel.toUpperCase() : ""
        const htmlText: string = `<h1>${levelLabel} ${docnumber}/${docyear} </h1> ${htmlResp.data}`
        setLaw(htmlText)
        setDocTitle(getDocumentReference())
      } catch (error) {
        console.error(error)
      }
    },
    [doclevel, docnumber, docyear],
  )

  const getLawHtml = async (path: string) => {
    try {
      const xmlResp = await axios.get(path)
      const xmlText: string = xmlResp.data

      const xsltResp = await axios.get("/akomo_ntoso.xsl")
      const xsltText: string = xsltResp.data

      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlText, "text/xml")
      const xsltDoc = parser.parseFromString(xsltText, "text/xml")

      const xsltProcessor = new XSLTProcessor()
      xsltProcessor.importStylesheet(xsltDoc)
      const resultDocumentFragment = xsltProcessor.transformToFragment(
        xmlDoc,
        document,
      )
      const container = document.createElement("div")
      container.appendChild(resultDocumentFragment)

      const parsedDocTitle =
        xmlDoc.querySelector("docTitle")?.textContent?.trim() ||
        "Lain otsikko puuttuu"
      setDocTitle(`${getDocumentReference()} - ${parsedDocTitle}`)

      const bodyarr = Array.from(container.querySelectorAll("article"))
      if (bodyarr.length >= 1) {
        const body = bodyarr[0].innerHTML
        setLaw(body)
      }
    } catch (error) {
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

    setActiveSearchMatchIndex(
      (currentValue) => (currentValue + 1) % searchMatchCount,
    )
  }

  const handlePreviousSearchMatch = () => {
    if (searchMatchCount === 0) {
      return
    }

    setActiveSearchMatchIndex((currentValue) =>
      currentValue === 0 ? searchMatchCount - 1 : currentValue - 1,
    )
  }

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
    setActiveSearchMatchIndex(0)
  }

  const handleClearSearch = () => {
    setSearchQuery("")
    setActiveSearchMatchIndex(0)
  }

  const getHeadings = async (structurePath: string) => {
    try {
      const response = await axios.get(structurePath)
      setHeadings(response.data)
    } catch (error) {
      console.error(error)
    }
  }

  const getKeywords = async (keywordsPath: string) => {
    try {
      const response = await axios.get(keywordsPath)
      if (Array.isArray(response.data)) {
        const parsedKeywords: DocumentKeyword[] = response.data.filter(
          (item): item is DocumentKeyword =>
            item !== null &&
            typeof item === "object" &&
            typeof item.id === "string" &&
            typeof item.keyword === "string",
        )
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
  }, [
    apipath,
    docnumber,
    docyear,
    doclevel,
    lan,
    hasRequiredParams,
    buildPaths,
    getHtml,
  ])

  const lawWithKeywords = injectKeywordsIntoLawHtml(law)
  const highlightedLaw = useMemo(() => {
    return buildHighlightedHtml(
      lawWithKeywords,
      searchQuery,
      activeSearchMatchIndex,
    )
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

    const activeHit = document.querySelector(
      '[data-finlex-search-active="true"]',
    ) as HTMLElement | null
    activeHit?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    })
  }, [highlightedLaw.html, searchMatchCount, searchQuery])

  useEffect(() => {
    syncCurrentPageSavedState()

    const syncSavedState = () => {
      syncCurrentPageSavedState()
    }

    window.addEventListener(savedPagesUpdatedEvent, syncSavedState)
    window.addEventListener("storage", syncSavedState)

    return () => {
      window.removeEventListener(savedPagesUpdatedEvent, syncSavedState)
      window.removeEventListener("storage", syncSavedState)
    }
  }, [syncCurrentPageSavedState])

  return (
    <>
      <Helmet>
        <title>{docTitle}</title>
      </Helmet>
      <div id="topId" style={topStyle}>
        <div style={topLeftControlsStyle}>
          <button
            onClick={() => (window.location.href = getBackUrl())}
            style={backButtonStyle}
            onMouseEnter={() => setBackButtonHovered(true)}
            onMouseLeave={() => setBackButtonHovered(false)}
          >
            {language === "fin" ? "Takaisin" : "Tillbaka"}
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

              <div id="leftMargin" style={tocStyle}>
                <button
                  onClick={handleTocToggle}
                  style={
                    isTocVisible
                      ? sideToggleButtonStyle
                      : collapsedTocButtonStyle
                  }
                  aria-pressed={isTocVisible}
                  aria-label={getTocButtonText()}
                >
                  {getTocButtonText()}
                </button>
                {isTocVisible && <TableOfContent headings={headings} />}
              </div>

              <div
                id="documentbodydiv"
                style={
                  isTocVisible
                    ? isSearchVisible
                      ? docBodyStyle
                      : { ...docBodyStyle, ...docBodyWithSearchHiddenStyle }
                    : isSearchVisible
                      ? { ...docBodyStyle, ...docBodyExpandedStyle }
                      : {
                          ...docBodyStyle,
                          ...docBodyExpandedWithSearchHiddenStyle,
                        }
                }
              >
                {apipath === "statute" && (
                  <div style={documentActionsStyle}>
                    <button
                      type="button"
                      onClick={handleSaveCurrentPage}
                      style={isCurrentPageSaved ? saveButtonSavedStyle : saveButtonStyle}
                      disabled={isCurrentPageSaved}
                    >
                      {isCurrentPageSaved
                        ? language === "fin"
                          ? "Tallennettu sivu"
                          : "Sidan sparad"
                        : language === "fin"
                          ? "Tallenna sivu"
                          : "Spara sida"}
                    </button>
                  </div>
                )}
                <div
                  dangerouslySetInnerHTML={{ __html: highlightedLaw.html }}
                ></div>
              </div>

              <div
                style={searchPanelStyle}
                aria-label={
                  lan === "fin"
                    ? "Sivun sisäinen haku"
                    : "Intern sökning på sidan"
                }
              >
                <button
                  onClick={handleSearchToggle}
                  style={
                    isSearchVisible
                      ? searchSideToggleButtonStyle
                      : collapsedSearchButtonStyle
                  }
                  aria-pressed={isSearchVisible}
                  aria-label={getSearchToggleButtonText()}
                >
                  {getSearchToggleButtonText()}
                </button>
                {isSearchVisible && (
                  <div style={searchPanelContentStyle}>
                    <div style={searchHeaderStyle}>
                      <p style={searchTitleStyle}>
                        {lan === "fin"
                          ? "Hae tältä sivulta"
                          : "Sök på denna sida"}
                      </p>
                      <span style={searchCountStyle} aria-live="polite">
                        {searchQuery.trim()
                          ? `${searchMatchCount === 0 ? 0 : activeSearchMatchIndex + 1}/${searchMatchCount}`
                          : "0/0"}
                      </span>
                    </div>
                    <form onSubmit={handleSearchSubmit}>
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        style={searchInputStyle}
                        placeholder={
                          lan === "fin"
                            ? "Etsi tästä asiakirjasta"
                            : "Sök i detta dokument"
                        }
                        aria-label={
                          lan === "fin"
                            ? "Etsi tästä asiakirjasta"
                            : "Sök i detta dokument"
                        }
                      />
                      <div style={searchControlsStyle}>
                        <button
                          type="button"
                          onClick={handlePreviousSearchMatch}
                          style={
                            searchMatchCount > 0
                              ? searchButtonStyle
                              : searchButtonDisabledStyle
                          }
                          disabled={
                            searchMatchCount === 0 || !searchQuery.trim()
                          }
                        >
                          {lan === "fin" ? "Edellinen" : "Föregående"}
                        </button>
                        <button
                          type="submit"
                          style={
                            searchMatchCount > 0
                              ? searchButtonStyle
                              : searchButtonDisabledStyle
                          }
                          disabled={
                            searchMatchCount === 0 || !searchQuery.trim()
                          }
                        >
                          {lan === "fin" ? "Seuraava" : "Nästa"}
                        </button>
                        <button
                          type="button"
                          onClick={handleClearSearch}
                          style={
                            searchQuery.trim()
                              ? searchButtonStyle
                              : searchButtonDisabledStyle
                          }
                          disabled={!searchQuery.trim()}
                        >
                          {lan === "fin" ? "Tyhjennä" : "Rensa"}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              <div style={rightEmptyMarginStyle} aria-hidden="true" />
            </>
          ) : (
            <div style={{ padding: "20px", color: "#666" }}>
              {language === "fin"
                ? "Asiakirjaa ei voitu ladata."
                : "Dokumentet kunde inte laddas."}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default DocumentPage
