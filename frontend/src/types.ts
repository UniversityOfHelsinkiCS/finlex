
export interface Law {
  docYear:  string,
  docNumber: string,
  docTitle: string
}

export interface Judgment {
  docYear:  string,
  docNumber: string,
  docLevel: string
}

export interface TopMenuProps {
  language:  string,
  handleSelect: (event: React.SyntheticEvent) => void,
}

export interface Document {
  docYear:  string,
  docNumber: string,
  docLevel?: string,
  docTitle?: string
  isEmpty?: boolean,
  keywords?: string[]
}

export interface DocumentPageProps {
  apipath: string,
  language: string
}

export interface ListDocumentPageProps {
  buttonetext: string,
  placeholdertext: string,
  apisection: string,
  frontsection: string,
  language: string,
  setLanguage: (Status: string) => void
}

export interface DocumentListProps {
  laws: Document[],
  frontsection: string,
  language: string
}

export interface Props {
  search: string,
  handleSearchInputChange: (event: React.SyntheticEvent) => void,
  handleSearchEvent: (event: React.SyntheticEvent) => void,
  buttontext: string
  placeholdertext: string
}

export interface Server {
  server: string,
}

export interface Lang {
  language: string,
  handleSelect: (event: React.SyntheticEvent) => void,
}

export interface Headings {
    name: string,
    id: string,
    content: {
        name: string,
        id: string,
        content: never[]
    }[]
}

export interface KeywordPageType {
  language: string,
}

export interface LawByKey {
  number: string,
  year: string,
  title: string,
  keyword: string
}

export interface JudgmentByKey {
  number: string,
  year: string,
  level: string,
  keyword: string
}

export interface KeysType {
  id: string,
  keyword: string
}
