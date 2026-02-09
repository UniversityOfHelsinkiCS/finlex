import axios from 'axios'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import TopMenu from './TopMenu'
import type { KeywordPageType } from '../types'

interface KeywordResultItem {
  keyword: string
}

interface KeywordResultsBaseProps<T extends KeywordResultItem> extends KeywordPageType {
  apiBasePath: string
  buildLink: (item: T) => string
  formatLabel: (item: T) => React.ReactNode
  getItemKey: (item: T) => string
}

const KeywordResultsBase = <T extends KeywordResultItem,>({
  language,
  apiBasePath,
  buildLink,
  formatLabel,
  getItemKey
}: KeywordResultsBaseProps<T>) => {
  const keyword_id: string = decodeURIComponent(useParams().keyword_id ?? '')
  const [items, setItems] = useState<T[]>([])
  const [lan, setLan] = useState<string>(() => localStorage.getItem('language') || language)
  const path = `${apiBasePath}/${lan}/${encodeURIComponent(keyword_id)}`
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

  const listStyle: React.CSSProperties = {
    width: '500px',
    backgroundColor: '#F3F8FC',
    padding: '10px',
    margin: '4px'
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

  const getItems = async (url: string) => {
    const resp = await axios.get(url)
    setItems(resp.data)
  }

  useEffect(() => {
    getItems(path)
  }, [path])

  const handleSelect = (event: React.SyntheticEvent) => {
    const currentValue = (event.target as HTMLInputElement).value
    setLan(currentValue)
    localStorage.setItem('language', currentValue)
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
          <h1>{title} - {items.length > 0 && ` ${items[0].keyword}`}</h1>
          {Array.isArray(items) && items.map(item => (
            <div style={listStyle} key={getItemKey(item)}>
              <a href={buildLink(item)}>
                {formatLabel(item)}
              </a>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default KeywordResultsBase
