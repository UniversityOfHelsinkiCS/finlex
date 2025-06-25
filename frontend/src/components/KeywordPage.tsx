import axios from 'axios'
import type { KeywordPageType, KeysType } from "../types"
import { useState } from 'react'
import {Helmet} from "react-helmet";
import TopMenu from './TopMenu'


const KeywordPage = ({language} : KeywordPageType) => {

  const [keywords, setKeywords] = useState<KeysType[]>([])
  const [lan, setLan] = useState<string>(language)
  const path = `/api/statute/keywords/${lan}`
  const title = lan === "fin" ? "Asiasanat" : "Ämnesord"
  let letter = ""

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
    padding: '5px',
  }

  const contentContainerStyle: React.CSSProperties = {
    width: '700px',
    border: '0px solid black',
    marginTop:'50px',
  }

  const getKeywords = async (path: string) => {
    const keywordss = await axios.get(path)
    setKeywords(keywordss.data)
    console.log(keywords)
  }
  if (keywords.length === 0) {
    getKeywords(path)}

  function prepareLink(keyword_id: string) {
    return `/lainsaadanto/asiasanat/${keyword_id}`;
  }

  const handleSelect = (event: React.SyntheticEvent) => {
    const currentValue = (event.target as HTMLInputElement).value
    setLan(currentValue)
    localStorage.setItem("language", currentValue)
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
          {keywords.map(keyword => {
            const firstLetter = keyword.keyword.charAt(0).toUpperCase()
            const letterChanged = firstLetter !== letter
            letter = firstLetter
            return (
              <>
                {letterChanged && <h2>{firstLetter}</h2>}
                <div key={keyword.id}>
                  <a href={prepareLink(keyword.id)}>{keyword.keyword}</a>
                </div>
              </>
            )
          })}
        </div>
      </div>
    </>
  )
}

export default KeywordPage
