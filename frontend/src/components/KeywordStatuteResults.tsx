import type { KeywordPageType, LawByKey } from '../types'
import KeywordResultsBase from './KeywordResultsBase'

const KeywordStatuteResults = ({ language }: KeywordPageType) => (
  <KeywordResultsBase<LawByKey>
    language={language}
    apiBasePath="/api/statute/keyword"
    buildLink={(law) => `/lainsaadanto/${law.year}/${law.number}`}
    formatLabel={(law) => (
      <>
        <b>{law.number}/{law.year}</b> - {law.title}
      </>
    )}
    getItemKey={(law) => `${law.number}-${law.year}`}
  />
)

export default KeywordStatuteResults
