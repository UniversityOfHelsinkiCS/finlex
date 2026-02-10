
import type {Headings } from "../types"


const TableOfContent = ({headings}: {headings: Headings[]}) => {

  const data = headings

  const tocStyle: React.CSSProperties = {
    display: 'flow',
    width: '100%',
    border: '0px solid blue',
    backgroundColor: '#F3F8FC',
    padding: '0px',
    paddingLeft: '4px'

  }

  const autoscrollStyle: React.CSSProperties = {
    overflow: 'auto',
    height: 'calc(100vh - 80px)',
    position: 'sticky',
    top: '60px',
    left: '0px',
    width: '300px',
    display: 'flex',
    border: '0px solid red',

  }

  const h1Style: React.CSSProperties = {
    marginBottom: '10px',
    paddingLeft: '0px',
    fontSize: '18px',
    fontWeight: 'bold',
  }
  const h2Style: React.CSSProperties = {
    paddingLeft: '15px',
    marginBottom: '10px',
    fontSize: '16px',
  }

  if (data.length < 1) {
    return <></>
  }
  else {
    const out = (
      <div style={autoscrollStyle} id="autoscrolldiv">

        <div key="tocdiv" style={tocStyle}>
          {data.map((section) => {
            return (
              <div key={section.name}>
                <div id={section.name} style={h1Style}>
                  <a href={`#${section.id}`}>{section.name}</a>
                </div>
                {section.content.map((item) => {
                  return (<div id={item.name} key={item.name} style={h2Style}>
                    <a href={`#${item.id}`}>{item.name}</a>
                  </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
    return out
  }
}

export default TableOfContent
