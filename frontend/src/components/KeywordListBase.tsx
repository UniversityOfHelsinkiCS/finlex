import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import TopMenu from './TopMenu'
import type { KeysType, KeywordPageType } from '../types'

interface KeywordListBaseProps extends KeywordPageType {
  apiBasePath: string
  routeBasePath: string
}

type KeywordRow = KeysType & {
  displayKeyword?: string
}

const KeywordListBase = ({ language, apiBasePath, routeBasePath }: KeywordListBaseProps) => {
  const [keywords, setKeywords] = useState<KeysType[]>([])
  const [lan, setLan] = useState<string>(() => localStorage.getItem('language') || language)
  const path = `${apiBasePath}/${lan}`
  const title = lan === 'fin' ? 'Asiasanat' : 'Ämnesord'

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
    margin: '0px',
    border: '0px solid red'
  }

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    padding: '5px'
  }

  const contentContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: '20px',
    width: '100%',
    maxWidth: '900px',
    border: '0px solid black',
    marginTop: '50px'
  }

  const indexSidebarStyle: React.CSSProperties = {
    width: '90px',
    position: 'sticky',
    top: '95px',
    alignSelf: 'flex-start',
    border: '0px solid green'
  }

  const indexStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  }

  const indexLinkStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '4px',
    textDecoration: 'none',
    backgroundColor: '#F3F8FC',
    color: '#000000'
  }

  const keywordListStyle: React.CSSProperties = {
    width: '700px',
    maxWidth: '100%'
  }

  const groupHeadingStyle: React.CSSProperties = {
    scrollMarginTop: '70px'
  }

  const getKeywords = async (url: string) => {
    const resp = await axios.get(url)
    setKeywords(resp.data)
  }

  useEffect(() => {
    getKeywords(path)
  }, [path])

  function prepareLink(keyword_id: string) {
    return `${routeBasePath}/${encodeURIComponent(keyword_id)}`
  }

  const handleSelect = (event: React.SyntheticEvent) => {
    const currentValue = (event.target as HTMLInputElement).value
    setLan(currentValue)
    localStorage.setItem('language', currentValue)
    setKeywords([])
  }

  const displayRows: KeywordRow[] = useMemo(() => {
    const rows: KeywordRow[] = keywords.map(k => ({ ...k }))

    // Special-case: in Finnish keyword list, show "lapseksiottaminen" also under A as
    // "Adoptio / Lapseksiottaminen" (same link/keyword_id).
    if (lan === 'fin') {
      const target = rows.find(
        r => r.keyword.trim().toLocaleLowerCase('fi') === 'lapseksiottaminen'
      )

      if (target) {
        rows.push({
          ...target,
          displayKeyword: 'Adoptio / Lapseksiottaminen',
          id: `${target.id}-alias-adoptio`
        })
      }
    }

    return rows
  }, [keywords, lan])

  const sortedRows = useMemo(() => {
    const collator = new Intl.Collator('fi', {
      usage: 'sort',
      sensitivity: 'base',
      ignorePunctuation: true,
      numeric: false
    })

    const getLabel = (r: KeywordRow) => r.displayKeyword ?? r.keyword

    return [...displayRows].sort((a, b) => collator.compare(getLabel(a), getLabel(b)))
  }, [displayRows])

  const rowsByLetter = useMemo(() => {
    const groups = new Map<string, KeywordRow[]>()

    sortedRows.forEach((row) => {
      const label = row.displayKeyword ?? row.keyword
      const firstLetter = label.charAt(0).toLocaleUpperCase('fi')

      if (!groups.has(firstLetter)) {
        groups.set(firstLetter, [])
      }

      groups.get(firstLetter)?.push(row)
    })

    return Array.from(groups.entries()).map(([groupLetter, groupRows]) => ({
      groupLetter,
      groupRows
    }))
  }, [sortedRows])

  const letterIndex = rowsByLetter.map(group => group.groupLetter)

  return (
    <>
      <Helmet>
        <title>
          {title}
        </title>
      </Helmet>
      <div id="topId" style={topStyle}>
        <TopMenu language={lan} handleSelect={handleSelect} />
      </div>
      <div style={contentStyle} id="contentdiv">
        <div id="contentDiv" style={contentContainerStyle}>
          {letterIndex.length > 0 && (
            <div style={indexSidebarStyle}>
              <div style={indexStyle}>
                {letterIndex.map(indexLetter => (
                  <a
                    key={indexLetter}
                    href={`#keyword-group-${indexLetter}`}
                    style={indexLinkStyle}
                  >
                    {indexLetter}
                  </a>
                ))}
              </div>
            </div>
          )}
          <div style={keywordListStyle}>
            <h1>{title}</h1>
            {rowsByLetter.map(({ groupLetter, groupRows }) => (
              <div key={groupLetter}>
                <h2 id={`keyword-group-${groupLetter}`} style={groupHeadingStyle}>{groupLetter}</h2>
                {groupRows.map(row => {
                  const label = row.displayKeyword ?? row.keyword

                  return (
                    <div key={row.id}>
                      <a href={prepareLink(row.id.replace('-alias-adoptio', ''))}>
                        {label}
                      </a>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default KeywordListBase
