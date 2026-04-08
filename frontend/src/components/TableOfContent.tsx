
import type {Headings } from "../types"


const TableOfContent = ({headings}: {headings: Headings[]}) => {

  const data = headings
  const fixedTopBarHeight = 50

  const handleHeadingClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault()

    const targetElement = document.getElementById(id)
    if (!targetElement) {
      return
    }

    const targetY = targetElement.getBoundingClientRect().top + window.scrollY - fixedTopBarHeight
    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth',
    })

    window.history.replaceState(null, '', `#${id}`)
  }

  const tocStyle: React.CSSProperties = {
    display: 'flow',
    width: '100%',
    border: '0px solid blue',
    padding: '0px',
    paddingLeft: '4px'

  }

  const autoscrollStyle: React.CSSProperties = {
    overflow: 'auto',
    height: 'calc(100vh - 100px)',
    width: '100%',
    display: 'flex',
    backgroundColor: '#E7F1FA',
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
                  <a href={`#${section.id}`} onClick={(event) => handleHeadingClick(event, section.id)}>{section.name}</a>
                </div>
                {section.content.map((item) => {
                  return (<div id={item.name} key={item.name} style={h2Style}>
                    <a href={`#${item.id}`} onClick={(event) => handleHeadingClick(event, item.id)}>{item.name}</a>
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
