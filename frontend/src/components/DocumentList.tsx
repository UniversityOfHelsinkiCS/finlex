import type {DocumentListProps, Document} from "../types"

function getCourtName(level: string, language: string): string {
  if (language === 'swe') {
    return level.toLowerCase() === 'kko' ? 'HD' : 'HFD';
  }
  return level.toUpperCase();
}


const DocumentList = ({laws, frontsection, language}: DocumentListProps) => {


  const listStyle = {
    width: "500px",
    backgroundColor: "#F3F8FC",
    padding: '10px',
    margin: '4px',
  }

  const tagStyle = {
    display: 'inline-block',
    padding: '1px 5px',
    marginRight: '5px',
    color: '#721c24',
    fontSize: '12px',
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '2px',
    whiteSpace: 'normal'
  }

  const inForceStyle = {
    display: 'inline-block',
    padding: '1px 5px',
    marginRight: '5px',
    color: '#155724',
    fontSize: '12px',
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: '2px',
    whiteSpace: 'normal'
  }

  const notInForceStyle = {
    display: 'inline-block',
    padding: '1px 5px',
    marginRight: '5px',
    color: '#721c24',
    fontSize: '12px',
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '2px',
    whiteSpace: 'normal'
  }

  const keywordStyle = {
    display: 'inline-block',
    padding: '1px 5px',
    marginRight: '5px',
    color: 'rgb(51, 51, 51)',
    fontSize: '12px',
    backgroundColor: 'rgb(207, 207, 207)',
    border: '1px solid rgb(136, 136, 136)',
    borderRadius: '2px',
    whiteSpace: 'normal'
  }

  function prepareLink(doc: Document): string {
    return `/${frontsection}/${doc.docYear}/${doc.docNumber}${doc.docLevel ? `/${doc.docLevel}` : ""}`;
  }

  function prepareLabel(doc: Document): string {
    if (doc.docLevel) {
      const courtName = getCourtName(doc.docLevel, language);
      return `${courtName}:${doc.docYear}:${doc.docNumber}`;
    }
    else {
      return `${doc.docNumber}/${doc.docYear}`;
    }
  }

  function prepareKey(doc: Document): string {
    return `${doc.docLevel ? doc.docLevel : ""}${doc.docYear}${doc.docNumber}${language}`;
  }

  const emptyTagName = language === 'fin' ? 'Tyhjä' : 'Tom'
  const inForceName = language === 'fin' ? 'Ajantasainen' : 'Uppdaterad'
  const notInForceName = language === 'fin' ? 'Kumottu' : 'Upphävd'
  return (
    <>
      { laws.map((law) =>
        <div style={listStyle} key={prepareKey(law)} >
          {law.isEmpty ? <span style={tagStyle}>{emptyTagName}</span> : ""}
          {law.isInForce === true ? <span style={inForceStyle}>{inForceName}</span> : ""}
          {law.isInForce === false ? <span style={notInForceStyle}>{notInForceName}</span> : ""}
          <a href={prepareLink(law)}>
            <b>{prepareLabel(law)}</b> {law.docTitle ? `- ${law.docTitle}` : ""}
          </a>
          {law.keywords && law.keywords.length > 0 && (
            <div>
              {law.keywords.map((keyword) => (
                <span key={keyword} style={keywordStyle}>{keyword}</span>
              ))}
            </div>
          )}
        </div>
      )
      }
    </>
  )
}

export default DocumentList
