import { useEffect, useMemo, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import type {Headings } from "../types"

interface TableOfContentProps {
  headings: Headings[]
  lan: string
  collapsedChapterIds: Set<string>
  setCollapsedChapterIds: Dispatch<SetStateAction<Set<string>>>
}

const TableOfContent = ({headings, lan, collapsedChapterIds, setCollapsedChapterIds}: TableOfContentProps) => {

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

  // Maps a section's id back to its parent chapter's id, so navigating into
  // a section can auto-expand a collapsed chapter around it.
  const parentChapterId = useMemo(() => {
    const map: Record<string, string> = {}
    data.forEach((section) => {
      section.content.forEach((item) => { map[item.id] = section.id })
    })
    return map
  }, [data])

  // Keyed only on activeId (not collapsedChapterIds) so this only reacts to
  // navigation/scroll moving the active heading — it must never re-fire and
  // undo a chapter the reader just collapsed by hand while still on it.
  useEffect(() => {
    if (!activeId) {
      return
    }
    const parentId = parentChapterId[activeId]
    if (!parentId) {
      return
    }
    setCollapsedChapterIds((prev) => {
      if (!prev.has(parentId)) {
        return prev
      }
      const next = new Set(prev)
      next.delete(parentId)
      return next
    })
  }, [activeId, parentChapterId, setCollapsedChapterIds])

  const handleToggleChapter = (event: React.MouseEvent, id: string) => {
    event.preventDefault()
    event.stopPropagation()
    setCollapsedChapterIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const getChapterToggleLabel = (isCollapsed: boolean) => {
    if (lan === "fin") {
      return isCollapsed ? "Avaa osio" : "Sulje osio"
    }
    return isCollapsed ? "Öppna avsnitt" : "Stäng avsnitt"
  }

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
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  }
  const chevronButtonStyle: React.CSSProperties = {
    flexShrink: 0,
    width: '22px',
    height: '22px',
    marginLeft: '-4px',
    padding: 0,
    border: 'none',
    borderRadius: '4px',
    background: 'none',
    cursor: 'pointer',
    fontSize: '15px',
    lineHeight: 1,
    color: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
  const chevronPlaceholderStyle: React.CSSProperties = {
    flexShrink: 0,
    width: '18px',
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
            const hasChildren = section.content.length > 0
            const isCollapsed = collapsedChapterIds.has(section.id)
            return (
              <div key={section.name}>
                <div
                  id={section.name}
                  style={section.id === activeId ? { ...h1Style, ...activeEntryStyle } : h1Style}
                  ref={(node) => { entryRefs.current[section.id] = node }}
                >
                  {hasChildren ? (
                    <button
                      type="button"
                      style={chevronButtonStyle}
                      aria-expanded={!isCollapsed}
                      aria-label={getChapterToggleLabel(isCollapsed)}
                      onClick={(event) => handleToggleChapter(event, section.id)}
                    >
                      {isCollapsed ? '▸' : '▾'}
                    </button>
                  ) : (
                    <span style={chevronPlaceholderStyle} aria-hidden="true" />
                  )}
                  <a
                    href={`#${section.id}`}
                    aria-current={section.id === activeId ? 'location' : undefined}
                    onClick={(event) => handleHeadingClick(event, section.id)}
                  >{section.name}</a>
                </div>
                {!isCollapsed && section.content.map((item) => {
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
