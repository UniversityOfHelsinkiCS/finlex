import type { KeywordPageType } from '../types'
import KeywordListBase from './KeywordListBase'

const KeywordStatuteList = ({ language }: KeywordPageType) => (
  <KeywordListBase
    language={language}
    apiBasePath="/api/statute/keyword"
    routeBasePath="/lainsaadanto/asiasanat"
  />
)

export default KeywordStatuteList
