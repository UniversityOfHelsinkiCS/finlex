import axios from "axios"
import { useState, useEffect } from "react"

interface Document {
  docTitle: string
  docNumber: string
  docYear: number
  isEmpty: boolean
  docVersion: string
}

interface YearData {
  year: number
  totalDocuments: number
  documentsWithContent: number
  emptyDocuments: number
  contentPercentage: number
  documents: Document[]
}

const YearsPage = () => {
  const [yearData, setYearData] = useState<YearData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  console.log('YEARS')

  useEffect(() => {
    const fetchAllYears = async () => {
      try {
        setLoading(true)
        const years = Array.from({ length: 76 }, (_, i) => 1950 + i)

        const promises = years.map(async (year) => {
          try {
            const response = await axios.get(`/api/statute/${year}/fin`)
            const documents: Document[] = response.data

            const totalDocuments = documents.length
            const documentsWithContent = documents.filter(doc => !doc.isEmpty).length
            const emptyDocuments = documents.filter(doc => doc.isEmpty).length
            const contentPercentage = totalDocuments > 0 ? Math.round((documentsWithContent / totalDocuments) * 100) : 0

            return {
              year,
              totalDocuments,
              documentsWithContent,
              emptyDocuments,
              contentPercentage,
              documents
            }
          } catch (error) {
            console.error(`Error fetching data for year ${year}:`, error)
            return {
              year,
              totalDocuments: 0,
              documentsWithContent: 0,
              emptyDocuments: 0,
              contentPercentage: 0,
              documents: []
            }
          }
        })

        const results = await Promise.all(promises)
        setYearData(results.sort((a, b) => b.year - a.year)) // Sort by year descending
        setError(null)
      } catch (error) {
        console.error('Error fetching year data:', error)
        setError('Virhe tietojen lataamisessa')
      } finally {
        setLoading(false)
      }
    }

    fetchAllYears()
  }, [])

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '20px',
    backgroundColor: 'white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    borderRadius: '8px',
    overflow: 'hidden'
  }

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#0C6FC0',
    color: 'white',
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: 'bold',
    fontSize: '14px'
  }

  const cellStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid #e0e0e0',
    fontSize: '14px'
  }

  const numberCellStyle: React.CSSProperties = {
    ...cellStyle,
    textAlign: 'center',
    fontFamily: 'monospace',
    fontWeight: 'bold'
  }

  const yearCellStyle: React.CSSProperties = {
    ...cellStyle,
    fontWeight: 'bold',
    color: '#0C6FC0',
    fontSize: '16px'
  }

  const percentageCellStyle: React.CSSProperties = {
    ...cellStyle,
    textAlign: 'center',
    fontWeight: 'bold'
  }

  const getPercentageColor = (percentage: number): string => {
    if (percentage >= 80) return '#00b894'
    if (percentage >= 60) return '#fdcb6e'
    if (percentage >= 40) return '#e17055'
    return '#d63031'
  }

  const totalStats = {
    totalDocuments: yearData.reduce((sum, year) => sum + year.totalDocuments, 0),
    documentsWithContent: yearData.reduce((sum, year) => sum + year.documentsWithContent, 0),
    emptyDocuments: yearData.reduce((sum, year) => sum + year.emptyDocuments, 0)
  }

  const overallPercentage = totalStats.totalDocuments > 0
    ? Math.round((totalStats.documentsWithContent / totalStats.totalDocuments) * 100)
    : 0

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div>Ladataan vuosien 1960-1970 tietoja...</div>
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
          Tämä voi kestää hetken...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#d63031' }}>
        <div>{error}</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px', color: '#333' }}>
        Lainsäädäntö
      </h2>

      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '30px'
      }}>
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0C6FC0' }}>
            {totalStats.totalDocuments}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>Yhteensä dokumentteja</div>
        </div>
        <div style={{
          backgroundColor: '#d1f2eb',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          border: '1px solid #00b894'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#00b894' }}>
            {totalStats.documentsWithContent}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>Sisältöä sisältävät</div>
        </div>
        <div style={{
          backgroundColor: '#ffeaa7',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          border: '1px solid #fdcb6e'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d63031' }}>
            {totalStats.emptyDocuments}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>Tyhjät dokumentit</div>
        </div>
        <div style={{
          backgroundColor: '#ddd6fe',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          border: '1px solid #8b5cf6'
        }}>
          <div style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: getPercentageColor(overallPercentage)
          }}>
            {overallPercentage}%
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>Sisältöprosentti</div>
        </div>
      </div>

      {/* Year-by-year table */}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerStyle}>Vuosi</th>
            <th style={headerStyle}>Yhteensä</th>
            <th style={headerStyle}>Sisältöä</th>
            <th style={headerStyle}>Tyhjiä</th>
            <th style={headerStyle}>Sisältö %</th>
          </tr>
        </thead>
        <tbody>
          {yearData.map((data, index) => (
            <tr
              key={data.year}
              style={{
                backgroundColor: index % 2 === 0 ? '#fafafa' : 'white'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f8ff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#fafafa' : 'white'
              }}
            >
              <td style={yearCellStyle}>{data.year}</td>
              <td style={numberCellStyle}>{data.totalDocuments}</td>
              <td style={numberCellStyle}>{data.documentsWithContent}</td>
              <td style={numberCellStyle}>{data.emptyDocuments}</td>
              <td style={{
                ...percentageCellStyle,
                color: getPercentageColor(data.contentPercentage)
              }}>
                {data.contentPercentage}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {yearData.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Ei tietoja saatavilla
        </div>
      )}
    </div>
  )
}

export default YearsPage
