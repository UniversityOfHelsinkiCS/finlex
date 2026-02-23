import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import TopMenu from './TopMenu'
import type { KeysType, KeywordPageType } from '../types'

interface KeywordListBaseProps extends KeywordPageType {
  apiBasePath: string
  routeBasePath: string
}

const KeywordListBase = ({ language, apiBasePath, routeBasePath }: KeywordListBaseProps) => {
  const [keywords, setKeywords] = useState<KeysType[]>([])
  const [lan, setLan] = useState<string>(() => localStorage.getItem('language') || language)
  const path = `${apiBasePath}/${lan}`
  const title = lan === 'fin' ? 'Asiasanat' : 'Ämnesord'
  let letter = ''

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
    width: '700px',
    border: '0px solid black',
    marginTop: '50px'
  }

  const getKeywords = async (url: string) => {
    const resp = await axios.get(url)
    setKeywords(resp.data)
  }

  useEffect(() => {
    getKeywords(path)
  }, [path])


  const sortedKeywords = useMemo(() => {
    const collator = new Intl.Collator('fi', {
      usage: 'sort',
      sensitivity: 'base',
      ignorePunctuation: true,
      numeric: false
    })

    return [...keywords].sort((a, b) => collator.compare(a.keyword, b.keyword))
  }, [keywords])

  function prepareLink(keyword_id: string) {
    return `${routeBasePath}/${encodeURIComponent(keyword_id)}`
  }

  const handleSelect = (event: React.SyntheticEvent) => {
    const currentValue = (event.target as HTMLInputElement).value
    setLan(currentValue)
    localStorage.setItem('language', currentValue)
    setKeywords([])
  }

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
          <h1>{title}</h1>
          {Array.isArray(sortedKeywords) && sortedKeywords.map(keyword => {
            const firstLetter = keyword.keyword.charAt(0).toLocaleUpperCase('fi')
            const letterChanged = firstLetter !== letter
            letter = firstLetter
            return (
              <div key={`${keyword.id}-upper`}>
                {letterChanged && <h2>{firstLetter}</h2>}
                <div key={keyword.id}>
                  <a href={prepareLink(keyword.id)}>{keyword.keyword}</a>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

export default KeywordListBase