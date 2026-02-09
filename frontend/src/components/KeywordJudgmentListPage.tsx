import axios from 'axios'
import { useEffect, useState } from 'react'
import type { KeywordPageType, JudgmentByKey } from '../types'
import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import TopMenu from './TopMenu'

const KeywordJudgmentListPage = ({ language }: KeywordPageType) => {
  const keyword_id: string = decodeURIComponent(useParams().keyword_id ?? '')
  const [judgments, setJudgments] = useState<JudgmentByKey[]>([])
  const [lan, setLan] = useState<string>(() => localStorage.getItem('language') || language)
  const path = `/api/judgment/keyword/${lan}/${encodeURIComponent(keyword_id)}`
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

  const getJudgments = async (path: string) => {
    const resp = await axios.get(path)
    setJudgments(resp.data)
  }

  useEffect(() => {
    getJudgments(path)
  }, [path])

  function prepareLink(judgment: JudgmentByKey): string {
    return `/oikeuskaytanto/${judgment.year}/${judgment.number}/${judgment.level}`
  }

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
          <h1>{title} - {judgments.length > 0 && ` ${judgments[0].keyword}`}</h1>
          {Array.isArray(judgments) && judgments.map(judgment => (
            <div style={listStyle} key={`${judgment.level}-${judgment.number}-${judgment.year}`}>
              <a href={prepareLink(judgment)}>
                <b>{judgment.level.toUpperCase()} {judgment.number}/{judgment.year}</b>
              </a>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default KeywordJudgmentListPage
