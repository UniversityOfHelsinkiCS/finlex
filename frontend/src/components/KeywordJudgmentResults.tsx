import type { KeywordPageType, JudgmentByKey } from '../types'
import KeywordResultsBase from './KeywordResultsBase'

const KeywordJudgmentResults = ({ language }: KeywordPageType) => (
  <KeywordResultsBase<JudgmentByKey>
    language={language}
    apiBasePath="/api/judgment/keyword"
    buildLink={(judgment) => `/oikeuskaytanto/${judgment.year}/${judgment.number}/${judgment.level}`}
    formatLabel={(judgment) => (
      <>
        <b>{judgment.level.toUpperCase()} {judgment.number}/{judgment.year}</b>
      </>
    )}
    getItemKey={(judgment) => `${judgment.level}-${judgment.number}-${judgment.year}`}
  />
)

export default KeywordJudgmentResults
