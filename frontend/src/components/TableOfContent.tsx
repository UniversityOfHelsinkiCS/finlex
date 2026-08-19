import { useEffect, useMemo, useRef, useState } from "react"
import type {Headings } from "../types"


const TableOfContent = ({headings}: {headings: Headings[]}) => {

  const data = headings
  const fixedTopBarHeight = 50

  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const entryRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [activeId, setActiveId] = useState<string | null>(null)

  // Every heading id in document order, chapters interleaved with their
  // sections, so the spy can walk them top-down and stop at the first one
  // still below the fold.
  const orderedIds = useMemo(() => {
    const ids: string[] = []
    data.forEach((section) => {
      ids.push(section.id)
      section.content.forEach((item) => ids.push(item.id))
    })
    return ids
  }, [data])

  // Track which heading the reader is currently under.
  useEffect(() => {
    if (orderedIds.length < 1) {
      return
    }

    let frame = 0

    const resolveActiveId = () => {
      frame = 0
      // The document body is injected asynchronously, so look the elements up
      // on each pass rather than caching them when the effect runs.
      const threshold = fixedTopBarHeight + 10
      let current: string | null = null

      for (const id of orderedIds) {
        const element = document.getElementById(id)
        if (!element) {
          continue
        }
        if (element.getBoundingClientRect().top > threshold) {
          break
        }
        current = id
      }

      setActiveId(current ?? orderedIds[0])
    }

    const schedule = () => {
      if (frame) {
        return
      }
      frame = window.requestAnimationFrame(resolveActiveId)
    }

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame)
      }
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [orderedIds])

  // Keep the active entry inside the table of contents' own scroll area.
  // This only ever moves the panel, never the page.
  useEffect(() => {
    if (!activeId) {
      return
    }

    const container = scrollContainerRef.current
    const entry = entryRefs.current[activeId]
    if (!container || !entry) {
      return
    }

    const containerRect = container.getBoundingClientRect()
    const entryRect = entry.getBoundingClientRect()
    const margin = 16

    if (entryRect.top < containerRect.top + margin) {
      container.scrollTop -= containerRect.top + margin - entryRect.top
    } else if (entryRect.bottom > containerRect.bottom - margin) {
      container.scrollTop += entryRect.bottom - (containerRect.bottom - margin)
    }
  }, [activeId])

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

    setActiveId(id)
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

  // The transparent border keeps the active accent from shifting the text.
  const h1Style: React.CSSProperties = {
    marginBottom: '6px',
    paddingLeft: '5px',
    borderLeft: '3px solid transparent',
    fontSize: '15px',
    lineHeight: 1.3,
    fontWeight: 'bold',
  }
  const h2Style: React.CSSProperties = {
    paddingLeft: '17px',
    borderLeft: '3px solid transparent',
    marginBottom: '5px',
    fontSize: '13px',
    lineHeight: 1.3,
  }
  // Must restate the whole borderLeft shorthand, not just borderLeftColor:
  // React clears a dropped longhand by setting it to '', which resets
  // border-left-color to currentColor rather than restoring the transparent
  // value from the shorthand — leaving a dark bar on the previously active row.
  const activeEntryStyle: React.CSSProperties = {
    borderLeft: '3px solid #0C6FC0',
    backgroundColor: '#CBE0F5',
    fontWeight: 'bold',
  }

  if (data.length < 1) {
    return <></>
  }
  else {
    const out = (
      <div style={autoscrollStyle} id="autoscrolldiv" ref={scrollContainerRef}>

        <div key="tocdiv" style={tocStyle}>
          {data.map((section) => {
            return (
              <div key={section.name}>
                <div
                  id={section.name}
                  style={section.id === activeId ? { ...h1Style, ...activeEntryStyle } : h1Style}
                  ref={(node) => { entryRefs.current[section.id] = node }}
                >
                  <a
                    href={`#${section.id}`}
                    aria-current={section.id === activeId ? 'location' : undefined}
                    onClick={(event) => handleHeadingClick(event, section.id)}
                  >{section.name}</a>
                </div>
                {section.content.map((item) => {
                  return (<div
                    id={item.name}
                    key={item.name}
                    style={item.id === activeId ? { ...h2Style, ...activeEntryStyle } : h2Style}
                    ref={(node) => { entryRefs.current[item.id] = node }}
                  >
                    <a
                      href={`#${item.id}`}
                      aria-current={item.id === activeId ? 'location' : undefined}
                      onClick={(event) => handleHeadingClick(event, item.id)}
                    >{item.name}</a>
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
