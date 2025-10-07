import axios from "axios"
import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"

const YearDocumentList = () => {
  const { year } = useParams<{ year: string }>()

  const [documents, setDocuments] = useState([])
  const lang = 'fin'

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await axios.get(`/api/statute/${year}/${lang}`)

        setDocuments(response.data)
      } catch (error) {
        console.error('Error fetching documents:', error)
      }
    }

    fetchDocuments()
  }, [year])

  if (documents.length === 0) {
    return
  }

  const getApiUrl = (number: any, v: any) => `https://opendata.finlex.fi/finlex/avoindata/v1/akn/fi/act/statute-consolidated/${year}/${number}/${lang}@${v ? v : ''}`
  const getFlexUrl = (number: any) => `https://www.finlex.fi/fi/lainsaadanto/saadoskokoelma/${year}/${number}`

  return (
    <div>

      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <h3>Stautues of {year}</h3>
        <p>total: {documents.length}</p>
        <p>empty: {documents.filter((doc: any) => doc.isEmpty).length}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Number</th>
            <th>Title</th>
            <th>Year</th>
            <th>Version</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {documents
            .sort((a: any, b: any) => (b.isEmpty ? 1 : 0) - (a.isEmpty ? 1 : 0))
            .map((doc: any, index: number) => (
              <tr key={index}>
                <td>{doc.docNumber}</td>
                <td><a href={`/lainsaadanto/${doc.docYear}/${doc.docNumber}`}>{doc.docTitle}</a></td>
                <td>{doc.docYear}</td>
                <td>{doc.docVersion || 'N/A'}</td>
                <td>{doc.isEmpty &&
                  <>
                    <a href={getApiUrl(doc.docNumber, doc.docVersion)} target="_blank" rel="noopener noreferrer">
                      API
                    </a>
                    <a href={getFlexUrl(doc.docNumber)} style={{ marginLeft: 10 }} target="_blank" rel="noopener noreferrer">
                      finlex
                    </a>
                  </>
                }
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

export default YearDocumentList
