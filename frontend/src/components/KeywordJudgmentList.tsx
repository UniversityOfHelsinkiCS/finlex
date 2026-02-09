import type { KeywordPageType } from '../types'
import KeywordListBase from './KeywordListBase'

const KeywordJudgmentList = ({ language }: KeywordPageType) => (
  <KeywordListBase
    language={language}
    apiBasePath="/api/judgment/keyword"
    routeBasePath="/oikeuskaytanto/asiasanat"
  />
)

export default KeywordJudgmentList
