import axios from "axios"
import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"

const YearDocumentList = () => {
  const { year } = useParams<{ year: string }>()

  const [documents, setDocuments] = useState([])

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await axios.get(`/api/statute/${year}`)

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
          {documents.map((doc: any, index: number) => (
            <tr key={index}>
              <td>{doc.docNumber}</td>
              <td><a href={`/lainsaadanto/${doc.docYear}/${doc.docNumber}`}>{doc.docTitle}</a></td>
              <td>{doc.docYear}</td>
              <td>{doc.docVersion || 'N/A'}</td>
              <td>{doc.isEmpty ? 'Empty' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default YearDocumentList
